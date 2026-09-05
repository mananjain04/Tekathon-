"""
app/routes/auth.py — Authentication endpoints for KAVACH.

POST /api/auth/login   — OAuth2 password flow; returns signed JWT.
POST /api/auth/logout  — Stateless logout (instructs client to drop token).
GET  /api/auth/me      — Returns current user profile (no passwords/tokens).
POST /api/auth/register — Admin-only: create a new user with a given role.

Security rules applied here:
- Passwords are never logged or returned.
- JWT tokens are never stored server-side (stateless).
- Login response never includes the hashed password.
- Registration is ADMIN-only (enforced via require_role).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.database import get_db
from app.db.user_models import User, UserRole
from app.services import auth_service
from app.services.permissions import require_role

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Request / Response schemas (Pydantic)
# ---------------------------------------------------------------------------

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserProfile(BaseModel):
    username: str
    role: UserRole

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole = UserRole.VIEWER


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate with username + password, receive a signed JWT.
    Returns 401 on any credential mismatch (intentionally no detail
    distinguishing "user not found" from "wrong password" to prevent
    username enumeration).
    """
    user = auth_service.authenticate_user(db, form_data.username, form_data.password)
    if user is None:
        # Generic message — never reveal which part of the credentials failed.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(username=user.username, role=user.role.value)
    return TokenResponse(access_token=token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    _: User = Depends(auth_service.get_current_user),
) -> None:
    """
    Stateless logout: the server cannot invalidate JWTs without a token
    blocklist (deferred to roadmap). Instructs the client to discard the
    token. Returns 204 No Content.
    """
    # Nothing to do server-side; client discards the token.
    return None


@router.get("/me", response_model=UserProfile)
def me(
    current_user: User = Depends(auth_service.get_current_user),
) -> UserProfile:
    """Return the authenticated user'\''s profile. Never returns password or token."""
    return UserProfile.model_validate(current_user)


@router.post("/register", response_model=UserProfile, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest,
    current_user: User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db),
) -> UserProfile:
    """
    Create a new user. Requires ADMIN role.
    Fails with 409 if the username is already taken.
    """
    require_role(current_user, UserRole.ADMIN)
    try:
        new_user = auth_service.create_user(
            db, username=body.username, plain_password=body.password, role=body.role
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return UserProfile.model_validate(new_user)
