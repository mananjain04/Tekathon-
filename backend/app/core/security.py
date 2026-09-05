"""
app/core/security.py — Authentication primitives for KAVACH.

Argon2id password hashing via passlib (bcrypt fallback disabled; argon2 is
the current OWASP recommendation for password hashing).

JWT generation and validation via python-jose. The JWT secret is loaded from
settings (never hardcoded). Tokens carry: sub (username), role, and exp.

Rules:
- Never log or return plaintext passwords.
- Never log the JWT secret.
- Fail closed: any decode error raises credentials_exception immediately.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ---------------------------------------------------------------------------
# Password hashing — Argon2id (OWASP recommended, NIST SP 800-63B compliant)
# ---------------------------------------------------------------------------
_pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Return Argon2id hash of plain password. Never call with empty string."""
    if not plain:
        raise ValueError("Password must not be empty.")
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True iff plain password matches the stored Argon2id hash."""
    try:
        return _pwd_context.verify(plain, hashed)
    except Exception:  # noqa: BLE001 — passlib raises several error types
        return False


# ---------------------------------------------------------------------------
# JWT — signed, expiring bearer tokens
# ---------------------------------------------------------------------------
_ALGORITHM = "HS256"


def create_access_token(
    *,
    username: str,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT containing sub (username), role, and exp.

    `expires_delta` defaults to settings.jwt_access_token_expire_minutes.
    The secret is settings.jwt_secret_key — never hardcoded here.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)

    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT. Returns the payload dict on success.
    Raises jose.JWTError (which callers convert to HTTP 401) on any failure:
    invalid signature, expired, malformed, wrong algorithm.
    """
    # Raises JWTError on any validation failure — fail closed.
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[_ALGORITHM])
