"""
app/services/permissions.py — Centralized RBAC permission checking for KAVACH.

ALL role checks go through this single module. Route handlers MUST NOT
scatter inline role comparisons — they call require_role() or require_any_role()
instead.  This makes the permission model auditable at a glance.

Role hierarchy (least to most privileged):
  VIEWER  < ANALYST < ADMIN

Permission matrix:
  Action                           VIEWER  ANALYST  ADMIN
  POST /api/retrieval/search       Yes     Yes      Yes
  POST /api/rag/query              Yes     Yes      Yes
  POST /api/documents/upload       No      Yes      Yes
  GET  /api/documents              No      Yes      Yes
  GET  /api/documents/{id}         No      Yes      Yes
  POST /api/documents/{id}/process No      Yes      Yes
  GET  /api/health/db              No      No       Yes
  POST /api/auth/register          No      No       Yes
"""
from __future__ import annotations

from fastapi import HTTPException, status

from app.db.user_models import User, UserRole

_FORBIDDEN = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="You do not have permission to perform this action.",
)

# Role hierarchy for comparison
_ROLE_RANK = {
    UserRole.VIEWER: 0,
    UserRole.ANALYST: 1,
    UserRole.ADMIN: 2,
}


def require_role(user: User, minimum_role: UserRole) -> None:
    """
    Raise HTTP 403 if the user's role rank is below `minimum_role`.
    Call this at the start of any route that needs a minimum permission level.

    Example:
        require_role(current_user, UserRole.ANALYST)
    """
    if _ROLE_RANK.get(user.role, -1) < _ROLE_RANK[minimum_role]:
        raise _FORBIDDEN


def require_any_role(user: User, *roles: UserRole) -> None:
    """
    Raise HTTP 403 if the user's role is not in the provided set.
    Use this for non-hierarchical permission checks (exact role membership).
    """
    if user.role not in roles:
        raise _FORBIDDEN
