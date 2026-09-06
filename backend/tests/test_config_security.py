"""
tests/test_config_security.py — focused tests for app/core/config.py's
JWT secret validation and the security-related default values.

These tests construct Settings(_env_file=None, ...) directly so they:
  - never read/depend on the developer's real backend/.env file
  - never write a secret anywhere
  - use only generated, test-only secret values (never a real/production one)

This is deliberate: JWT_SECRET_KEY is a required field with no default
(see config.py), so the module-level `settings = get_settings()` will
raise at import time if the environment doesn't provide a valid one --
these tests exercise that validator in isolation, without needing the
whole app (and its real .env) to be importable.
"""
import secrets

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def _settings(monkeypatch, **overrides):
    """
    Builds a Settings instance from ONLY the given overrides plus
    pydantic's own field defaults -- no .env file, and with the real
    process environment's JWT_SECRET_KEY / *_OFFLINE_MODE vars (if any)
    removed first, so these tests are isolated from whatever the
    developer happens to have set locally.
    """
    for var in ("JWT_SECRET_KEY", "EMBEDDING_OFFLINE_MODE", "RERANKER_OFFLINE_MODE"):
        monkeypatch.delenv(var, raising=False)
    return Settings(_env_file=None, **overrides)


# ---------------------------------------------------------------------------
# JWT_SECRET_KEY validation
# ---------------------------------------------------------------------------


def test_missing_jwt_secret_key_is_rejected(monkeypatch):
    """No JWT_SECRET_KEY at all -- required field must fail closed."""
    with pytest.raises(ValidationError, match="jwt_secret_key"):
        _settings(monkeypatch)


@pytest.mark.parametrize("blank_value", ["", "   ", "\t\n"])
def test_empty_or_whitespace_jwt_secret_key_is_rejected(monkeypatch, blank_value):
    with pytest.raises(ValidationError, match="must be set"):
        _settings(monkeypatch, jwt_secret_key=blank_value)


@pytest.mark.parametrize(
    "placeholder",
    [
        "CHANGE_ME_generate_with_secrets_token_hex_32",
        "change_me_generate_with_secrets_token_hex_32",  # lowercase
        "Change_Me_Generate_With_Secrets_Token_Hex_32",  # mixed case
        "CHANGEME",
        "secret",
        "SuperSecret",  # -> lowercased to "supersecret", a known weak value
    ],
)
def test_known_placeholder_jwt_secret_key_is_rejected_case_insensitively(monkeypatch, placeholder):
    with pytest.raises(ValidationError, match="placeholder|weak"):
        _settings(monkeypatch, jwt_secret_key=placeholder)


def test_short_jwt_secret_key_is_rejected(monkeypatch):
    """31 characters -- one under the 32-char minimum."""
    short_secret = secrets.token_hex(15) + "a"  # 30 hex chars + 1 = 31 chars
    assert len(short_secret) == 31
    with pytest.raises(ValidationError, match="too short"):
        _settings(monkeypatch, jwt_secret_key=short_secret)


def test_low_entropy_jwt_secret_key_is_rejected(monkeypatch):
    """32 characters, but only 1 distinct character -- long enough, not random enough."""
    low_entropy_secret = "a" * 32
    with pytest.raises(ValidationError, match="character variety"):
        _settings(monkeypatch, jwt_secret_key=low_entropy_secret)


def test_strong_32_char_jwt_secret_key_is_accepted(monkeypatch):
    strong_secret = secrets.token_hex(16)  # exactly 32 hex characters, test-only/generated
    result = _settings(monkeypatch, jwt_secret_key=strong_secret)
    assert result.jwt_secret_key == strong_secret


def test_strong_64_char_token_hex_32_style_secret_is_accepted(monkeypatch):
    """Mirrors the documented generation command: secrets.token_hex(32) -> 64 hex chars."""
    strong_secret = secrets.token_hex(32)
    assert len(strong_secret) == 64
    result = _settings(monkeypatch, jwt_secret_key=strong_secret)
    assert result.jwt_secret_key == strong_secret


def test_validation_error_never_includes_the_secret_value(monkeypatch):
    """The rejected secret's actual value must never appear in the error output."""
    sensitive_value = "A" * 64  # long enough (64 >= 32) but low-entropy -- guaranteed rejected
    with pytest.raises(ValidationError) as exc_info:
        _settings(monkeypatch, jwt_secret_key=sensitive_value)
    assert sensitive_value not in str(exc_info.value)


# ---------------------------------------------------------------------------
# Offline-mode secure defaults
# ---------------------------------------------------------------------------


def test_embedding_offline_mode_defaults_to_true(monkeypatch):
    strong_secret = secrets.token_hex(32)
    result = _settings(monkeypatch, jwt_secret_key=strong_secret)
    assert result.embedding_offline_mode is True


def test_reranker_offline_mode_defaults_to_true(monkeypatch):
    strong_secret = secrets.token_hex(32)
    result = _settings(monkeypatch, jwt_secret_key=strong_secret)
    assert result.reranker_offline_mode is True
