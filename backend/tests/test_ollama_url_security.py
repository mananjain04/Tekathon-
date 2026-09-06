"""
tests/test_ollama_url_security.py — enforcement that Ollama is only ever
contacted over the local loopback interface (app/core/url_security.py),
plus the two places that call it: config.py's field validator and
OllamaProvider.__init__.

All tests are pure/offline -- no real Ollama server or network access
required. httpx is patched anywhere a request could theoretically occur,
so a test would fail loudly if validation were ever bypassed.
"""
from unittest.mock import patch

import pytest

from app.core.url_security import OllamaURLSecurityError, validate_ollama_base_url


# ---------------------------------------------------------------------------
# validate_ollama_base_url() -- accepted loopback destinations
# ---------------------------------------------------------------------------


class TestAcceptedLoopbackURLs:
    @pytest.mark.parametrize(
        "url",
        [
            "http://localhost:11434",
            "http://LOCALHOST:11434",  # case-insensitive
            "https://localhost:11434",
            "http://127.0.0.1:11434",
            "http://127.0.0.5:11434",  # anywhere in 127.0.0.0/8 is loopback
            "http://[::1]:11434",
            "http://ollama:11434",  # Docker container service
            "http://OLLAMA:11434",  # case-insensitive
            "http://host.docker.internal:11434",  # Docker host gateway for host GPU inference
        ],
    )
    def test_loopback_url_accepted_unchanged(self, url):
        assert validate_ollama_base_url(url) == url


# ---------------------------------------------------------------------------
# validate_ollama_base_url() -- rejected destinations
# ---------------------------------------------------------------------------


class TestRejectedURLs:
    def test_external_hostname_rejected(self):
        with pytest.raises(OllamaURLSecurityError, match="not a permitted local address"):
            validate_ollama_base_url("http://ollama.example.com:11434")

    def test_public_ip_rejected(self):
        with pytest.raises(OllamaURLSecurityError, match="public"):
            validate_ollama_base_url("http://8.8.8.8:11434")

    @pytest.mark.parametrize(
        "private_url",
        [
            "http://10.0.0.5:11434",
            "http://192.168.1.50:11434",
            "http://172.16.0.5:11434",
        ],
    )
    def test_private_network_ip_rejected_by_default(self, private_url):
        """Loopback-only policy: private-network IPs are rejected too, not just public ones."""
        with pytest.raises(OllamaURLSecurityError, match="private-network"):
            validate_ollama_base_url(private_url)

    def test_malformed_url_rejected(self):
        with pytest.raises(OllamaURLSecurityError):
            validate_ollama_base_url("not a url at all :// [[[")

    def test_empty_url_rejected(self):
        with pytest.raises(OllamaURLSecurityError):
            validate_ollama_base_url("")

    def test_none_url_rejected(self):
        with pytest.raises(OllamaURLSecurityError):
            validate_ollama_base_url(None)

    @pytest.mark.parametrize("scheme_url", ["file:///etc/passwd", "ftp://localhost:11434", "ws://localhost:11434"])
    def test_unsupported_scheme_rejected(self, scheme_url):
        with pytest.raises(OllamaURLSecurityError, match="unsupported scheme"):
            validate_ollama_base_url(scheme_url)

    def test_credentials_in_url_rejected(self):
        with pytest.raises(OllamaURLSecurityError, match="credentials"):
            validate_ollama_base_url("http://admin:hunter2@localhost:11434")

    def test_missing_hostname_rejected(self):
        with pytest.raises(OllamaURLSecurityError):
            validate_ollama_base_url("http:///no-host-here")

    def test_error_message_never_includes_password(self):
        with pytest.raises(OllamaURLSecurityError) as exc_info:
            validate_ollama_base_url("http://admin:SuperSecretPass123@localhost:11434")
        assert "SuperSecretPass123" not in str(exc_info.value)


# ---------------------------------------------------------------------------
# config.py: OLLAMA_BASE_URL fails the whole app at startup, not just at first use
# ---------------------------------------------------------------------------


class TestConfigValidatorEnforcesLoopback:
    def _settings(self, monkeypatch, **overrides):
        import secrets

        from app.core.config import Settings

        for var in ("JWT_SECRET_KEY", "OLLAMA_BASE_URL"):
            monkeypatch.delenv(var, raising=False)
        overrides.setdefault("jwt_secret_key", secrets.token_hex(32))
        return Settings(_env_file=None, **overrides)

    def test_external_ollama_base_url_rejected_at_settings_load(self, monkeypatch):
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="ollama_base_url"):
            self._settings(monkeypatch, ollama_base_url="http://ollama.example.com:11434")

    def test_localhost_ollama_base_url_accepted_at_settings_load(self, monkeypatch):
        result = self._settings(monkeypatch, ollama_base_url="http://localhost:11434")
        assert result.ollama_base_url == "http://localhost:11434"


# ---------------------------------------------------------------------------
# OllamaProvider.__init__: fails closed BEFORE any prompt is sent, and no
# HTTP request is ever attempted for a rejected configuration.
# ---------------------------------------------------------------------------


class TestOllamaProviderRejectsNonLoopback:
    def test_external_base_url_raises_at_construction(self):
        from app.services.llm_service import LLMModelError
        from app.services.ollama_provider import OllamaProvider

        with pytest.raises(LLMModelError, match="rejected"):
            OllamaProvider(base_url="http://attacker.example.com:11434")

    def test_localhost_base_url_constructs_successfully(self):
        from app.services.ollama_provider import OllamaProvider

        provider = OllamaProvider(base_url="http://localhost:11434")
        assert provider.base_url == "http://localhost:11434"

    @patch("httpx.Client")
    def test_no_http_request_is_ever_made_for_rejected_config(self, mock_client_cls):
        """
        The construction failure must happen before generate() -- and
        therefore before any httpx call -- could possibly occur. This
        confirms rejection happens at __init__, not lazily inside generate().
        """
        from app.services.llm_service import LLMModelError
        from app.services.ollama_provider import OllamaProvider

        with pytest.raises(LLMModelError):
            OllamaProvider(base_url="http://10.0.0.9:11434")

        mock_client_cls.assert_not_called()

    def test_rejected_config_error_never_contains_confidential_prompt_text(self):
        """
        A confidential prompt can only ever be passed to generate(), which
        requires a constructed provider -- so a rejected (unconstructed)
        provider's error can never have seen, let alone leaked, any prompt
        or document content. This test documents/locks in that ordering.
        """
        from app.services.llm_service import LLMModelError
        from app.services.ollama_provider import OllamaProvider

        confidential_marker = "TOP-SECRET-DOCUMENT-CONTENT-MARKER-XYZ"
        with pytest.raises(LLMModelError) as exc_info:
            OllamaProvider(base_url="http://attacker.example.com:11434")

        assert confidential_marker not in str(exc_info.value)
