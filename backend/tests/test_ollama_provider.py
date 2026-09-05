"""
Unit tests for OllamaProvider (app/services/ollama_provider.py).

All tests mock the httpx HTTP layer -- no real Ollama server is required.
The suite is fully offline and passes as part of the normal `pytest` run.

For a real-server smoke test (opt-in, requires Ollama running locally),
see the marked integration test at the bottom of this file:
    pytest -m real_ollama_model
"""
import pytest
from unittest.mock import MagicMock, patch

from app.services.llm_service import LLMModelError, reset_llm_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_response(status_code: int = 200, json_body=None, text: str = ""):
    """Build a minimal fake httpx.Response."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = text
    if json_body is not None:
        resp.json.return_value = json_body
    else:
        resp.json.side_effect = ValueError("no body")
    return resp


def _make_provider(**kwargs):
    """Create an OllamaProvider with explicit config so tests never read .env."""
    from app.services.ollama_provider import OllamaProvider
    defaults = dict(base_url="http://localhost:11434", model="test-model", timeout=30.0)
    defaults.update(kwargs)
    return OllamaProvider(**defaults)


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

class TestOllamaProviderInit:
    def test_defaults_from_settings(self):
        """Provider reads base_url/model/timeout from settings when not overridden."""
        from app.services.ollama_provider import OllamaProvider
        from app.core.config import settings
        p = OllamaProvider()
        assert p.base_url == settings.ollama_base_url.rstrip("/")
        assert p.model == settings.ollama_model
        assert p.timeout == settings.ollama_timeout

    def test_explicit_overrides(self):
        p = _make_provider(base_url="http://mybox:11434/", model="llama3.1:8b", timeout=60.0)
        assert p.base_url == "http://mybox:11434"  # trailing slash stripped
        assert p.model == "llama3.1:8b"
        assert p.timeout == 60.0

    def test_trailing_slash_stripped(self):
        p = _make_provider(base_url="http://localhost:11434///")
        assert not p.base_url.endswith("/")


# ---------------------------------------------------------------------------
# generate() -- happy path
# ---------------------------------------------------------------------------

class TestOllamaProviderGenerate:
    @patch("httpx.Client")
    def test_successful_generation(self, mock_client_cls):
        resp = _make_response(200, json_body={"response": "  The answer is 42.  "})
        mock_client_cls.return_value.__enter__.return_value.post.return_value = resp

        p = _make_provider()
        result = p.generate("What is the answer?")

        assert result == "The answer is 42."

    @patch("httpx.Client")
    def test_generates_correct_url(self, mock_client_cls):
        resp = _make_response(200, json_body={"response": "ok"})
        mock_http = mock_client_cls.return_value.__enter__.return_value
        mock_http.post.return_value = resp

        p = _make_provider(base_url="http://mybox:11434")
        p.generate("test prompt")

        called_url = mock_http.post.call_args[0][0]
        assert called_url == "http://mybox:11434/api/generate"

    @patch("httpx.Client")
    def test_payload_contains_model_and_stream_false(self, mock_client_cls):
        resp = _make_response(200, json_body={"response": "ok"})
        mock_http = mock_client_cls.return_value.__enter__.return_value
        mock_http.post.return_value = resp

        p = _make_provider(model="qwen2.5:7b")
        p.generate("prompt text")

        payload = mock_http.post.call_args[1]["json"]
        assert payload["model"] == "qwen2.5:7b"
        assert payload["stream"] is False
        assert payload["prompt"] == "prompt text"

    @patch("httpx.Client")
    def test_max_tokens_forwarded_as_num_predict(self, mock_client_cls):
        resp = _make_response(200, json_body={"response": "ok"})
        mock_http = mock_client_cls.return_value.__enter__.return_value
        mock_http.post.return_value = resp

        p = _make_provider()
        p.generate("prompt", max_tokens=256)

        payload = mock_http.post.call_args[1]["json"]
        assert payload["options"]["num_predict"] == 256

    @patch("httpx.Client")
    def test_temperature_forwarded(self, mock_client_cls):
        resp = _make_response(200, json_body={"response": "ok"})
        mock_http = mock_client_cls.return_value.__enter__.return_value
        mock_http.post.return_value = resp

        p = _make_provider()
        p.generate("prompt", temperature=0.1)

        payload = mock_http.post.call_args[1]["json"]
        assert payload["options"]["temperature"] == 0.1


# ---------------------------------------------------------------------------
# generate() -- empty prompt guard
# ---------------------------------------------------------------------------

class TestOllamaProviderEmptyPrompt:
    def test_none_prompt_raises(self):
        p = _make_provider()
        with pytest.raises(LLMModelError):
            p.generate(None)

    def test_whitespace_prompt_raises(self):
        p = _make_provider()
        with pytest.raises(LLMModelError):
            p.generate("   \n\t  ")


# ---------------------------------------------------------------------------
# generate() -- connection failures
# ---------------------------------------------------------------------------

class TestOllamaProviderConnectionErrors:
    @patch("httpx.Client")
    def test_connect_error_raises_llm_model_error(self, mock_client_cls):
        import httpx
        mock_client_cls.return_value.__enter__.return_value.post.side_effect = httpx.ConnectError("refused")

        p = _make_provider()
        with pytest.raises(LLMModelError) as exc_info:
            p.generate("test")

        assert "Ollama is running" in str(exc_info.value)
        assert "ollama serve" in str(exc_info.value)

    @patch("httpx.Client")
    def test_timeout_raises_llm_model_error(self, mock_client_cls):
        import httpx
        mock_client_cls.return_value.__enter__.return_value.post.side_effect = httpx.TimeoutException("timed out")

        p = _make_provider(timeout=5.0)
        with pytest.raises(LLMModelError) as exc_info:
            p.generate("test")

        assert "timed out" in str(exc_info.value).lower()
        assert "5" in str(exc_info.value)

    @patch("httpx.Client")
    def test_generic_exception_raises_llm_model_error(self, mock_client_cls):
        mock_client_cls.return_value.__enter__.return_value.post.side_effect = RuntimeError("socket reset")

        p = _make_provider()
        with pytest.raises(LLMModelError):
            p.generate("test")


# ---------------------------------------------------------------------------
# generate() -- HTTP error codes
# ---------------------------------------------------------------------------

class TestOllamaProviderHttpErrors:
    @patch("httpx.Client")
    def test_404_model_not_found(self, mock_client_cls):
        resp = _make_response(404, text="model not found")
        mock_client_cls.return_value.__enter__.return_value.post.return_value = resp

        p = _make_provider(model="missing-model:7b")
        with pytest.raises(LLMModelError) as exc_info:
            p.generate("test")

        err = str(exc_info.value)
        assert "missing-model:7b" in err
        assert "ollama pull" in err

    @patch("httpx.Client")
    def test_500_server_error(self, mock_client_cls):
        resp = _make_response(500, text="internal server error")
        mock_client_cls.return_value.__enter__.return_value.post.return_value = resp

        p = _make_provider()
        with pytest.raises(LLMModelError) as exc_info:
            p.generate("test")

        assert "500" in str(exc_info.value)

    @patch("httpx.Client")
    def test_503_service_unavailable(self, mock_client_cls):
        resp = _make_response(503, text="service unavailable")
        mock_client_cls.return_value.__enter__.return_value.post.return_value = resp

        p = _make_provider()
        with pytest.raises(LLMModelError):
            p.generate("test")


# ---------------------------------------------------------------------------
# generate() -- unexpected response shape
# ---------------------------------------------------------------------------

class TestOllamaProviderResponseShape:
    @patch("httpx.Client")
    def test_missing_response_key(self, mock_client_cls):
        """Ollama returned JSON but without the 'response' key."""
        resp = _make_response(200, json_body={"done": True})  # no 'response' key
        mock_client_cls.return_value.__enter__.return_value.post.return_value = resp

        p = _make_provider()
        with pytest.raises(LLMModelError) as exc_info:
            p.generate("test")

        assert "unexpected response shape" in str(exc_info.value).lower()

    @patch("httpx.Client")
    def test_invalid_json(self, mock_client_cls):
        """Ollama returned 200 with non-JSON body."""
        resp = MagicMock()
        resp.status_code = 200
        resp.text = "not-json-at-all"
        resp.json.side_effect = ValueError("not valid json")
        mock_client_cls.return_value.__enter__.return_value.post.return_value = resp

        p = _make_provider()
        with pytest.raises(LLMModelError):
            p.generate("test")


# ---------------------------------------------------------------------------
# Provider factory (get_llm_service)
# ---------------------------------------------------------------------------

class TestProviderFactory:
    def setup_method(self):
        reset_llm_service()

    def teardown_method(self):
        reset_llm_service()

    def test_factory_returns_ollama_provider_when_configured(self, monkeypatch):
        from app.core.config import settings
        from app.services.ollama_provider import OllamaProvider
        monkeypatch.setattr(settings, "llm_provider", "ollama")

        from app.services.llm_service import get_llm_service
        service = get_llm_service()
        assert isinstance(service, OllamaProvider)

    def test_factory_returns_llm_service_for_llama_cpp(self, monkeypatch):
        from app.core.config import settings
        from app.services.llm_service import LLMService, get_llm_service
        monkeypatch.setattr(settings, "llm_provider", "llama_cpp")

        service = get_llm_service()
        assert isinstance(service, LLMService)

    def test_factory_raises_for_unknown_provider(self, monkeypatch):
        from app.core.config import settings
        from app.services.llm_service import get_llm_service
        monkeypatch.setattr(settings, "llm_provider", "groq")  # cloud provider -- must be rejected

        with pytest.raises(LLMModelError) as exc_info:
            get_llm_service()

        assert "groq" in str(exc_info.value).lower()

    def test_factory_returns_same_singleton(self, monkeypatch):
        from app.core.config import settings
        from app.services.llm_service import get_llm_service
        monkeypatch.setattr(settings, "llm_provider", "ollama")

        s1 = get_llm_service()
        s2 = get_llm_service()
        assert s1 is s2

    def test_reset_clears_singleton(self, monkeypatch):
        from app.core.config import settings
        from app.services.llm_service import get_llm_service
        monkeypatch.setattr(settings, "llm_provider", "ollama")

        s1 = get_llm_service()
        reset_llm_service()
        s2 = get_llm_service()
        assert s1 is not s2


# ---------------------------------------------------------------------------
# No external LLM API calls (security invariant)
# ---------------------------------------------------------------------------

class TestNoExternalCalls:
    @patch("httpx.Client")
    def test_request_goes_to_configured_base_url_only(self, mock_client_cls):
        """Verify the provider ONLY calls the configured local URL."""
        resp = _make_response(200, json_body={"response": "answer"})
        mock_http = mock_client_cls.return_value.__enter__.return_value
        mock_http.post.return_value = resp

        p = _make_provider(base_url="http://localhost:11434")
        p.generate("test")

        assert mock_http.post.call_count == 1
        called_url = mock_http.post.call_args[0][0]
        assert called_url.startswith("http://localhost:11434")
        # Must NOT contact any known external API
        for external in ("openai.com", "anthropic.com", "groq.com", "googleapis.com"):
            assert external not in called_url


# ---------------------------------------------------------------------------
# Integration test (opt-in: requires real Ollama server)
# ---------------------------------------------------------------------------

@pytest.mark.real_ollama_model
class TestOllamaProviderIntegration:
    """
    Smoke test against a real running Ollama server.

    Run with:
        pytest -m real_ollama_model -v

    Requires:
        - `ollama serve` running
        - The configured OLLAMA_MODEL pulled locally
    """

    def test_real_generation_returns_non_empty_string(self):
        from app.services.ollama_provider import OllamaProvider
        from app.core.config import settings

        p = OllamaProvider()
        result = p.generate("Reply with the single word: OK")

        assert isinstance(result, str)
        assert len(result.strip()) > 0
