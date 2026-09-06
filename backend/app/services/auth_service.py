"""
app/services/auth_service.py — User CRUD and token validation logic for KAVACH.

Centralizes all database interaction for authentication so routes stay thin.
Never logs or returns plaintext passwords or raw JWT strings.
"""
from __future__ import annotations

from typing import Optional

from jose import JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token, hash_password, verify_password
from app.db.database import get_db
from app.db.user_models import User, UserRole

# The tokenUrl must match the login route path exactly.
_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

_credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials.",
    headers={"WWW-Authenticate": "Bearer"},
)

_inactive_exception = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Account is disabled.",
)


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    if not username:
        return None
    user = db.query(User).filter(User.username == username).first()
    if not user and "@" in username:
        # Also resolve email-style identifiers (e.g. admin@kavach.local -> admin)
        prefix = username.split("@")[0].strip()
        user = db.query(User).filter(User.username == prefix).first()
    return user



def create_user(db: Session, *, username: str, plain_password: str, role: UserRole = UserRole.VIEWER) -> User:
    """Create and commit a new user. Raises ValueError if username taken."""
    if get_user_by_username(db, username):
        raise ValueError(f"Username '{username}' is already taken.")
    user = User(
        username=username,
        hashed_password=hash_password(plain_password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """
    Return the User if credentials are valid, else None.
    Uses constant-time comparison (passlib) to resist timing attacks.
    """
    user = get_user_by_username(db, username)
    if user is None:
        # Run a dummy verify to prevent username-enumeration via timing.
        hash_password("dummy_timing_guard_do_not_use")
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


# ---------------------------------------------------------------------------
# FastAPI dependency — used on every protected route
# ---------------------------------------------------------------------------

def get_current_user(
    token: str = Depends(_oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency: decodes the Bearer JWT, looks up the user, and
    returns the User ORM object.  Raises HTTP 401 on any token error and
    HTTP 403 if the account is disabled.

    Inject this into any route with:
        current_user: User = Depends(get_current_user)
    """
    try:
        payload = decode_access_token(token)
        username: str = payload.get("sub")
        if not username:
            raise _credentials_exception
    except JWTError:
        raise _credentials_exception

    user = get_user_by_username(db, username)
    if user is None:
        raise _credentials_exception
    if user.is_active != "Y":
        raise _inactive_exception
    return user
