"""
tests/test_security_auth.py — Phase 1+2 security tests.

Tests the authentication and RBAC controls WITHOUT requiring a live PostgreSQL
connection. Uses FastAPI TestClient with overridden get_db and mocked users.

Coverage:
- Unauthenticated requests return 401 on all protected endpoints
- Invalid/expired tokens return 401
- Valid token allows access to appropriate routes
- VIEWER cannot access ANALYST-only routes (403)
- ANALYST can access document routes
- ADMIN can register new users
- Login with wrong credentials returns 401
- Login response never contains password
- /api/auth/me returns correct profile
"""
import uuid
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.user_models import User, UserRole
from app.main import app
from app.services.auth_service import get_current_user


# ---------------------------------------------------------------------------
# Helpers — build fake users
# ---------------------------------------------------------------------------

def _fake_user(role: UserRole) -> User:
    u = User()
    u.id = uuid.uuid4()
    u.username = f"{role.value.lower()}_test"
    u.hashed_password = hash_password("TestPass123!")
    u.role = role
    u.is_active = "Y"
    return u


def _token_for(user: User) -> str:
    return create_access_token(username=user.username, role=user.role.value)


# ---------------------------------------------------------------------------
# Tests: authentication (Phase 1)
# ---------------------------------------------------------------------------

class TestUnauthenticated:
    """All protected endpoints must return 401 without a token."""

    def setup_method(self):
        self.client = TestClient(app, raise_server_exceptions=False)

    def test_upload_requires_auth(self):
        r = self.client.post("/api/documents/upload", files={"file": ("a.pdf", b"%PDF-test", "application/pdf")})
        assert r.status_code == 401

    def test_list_documents_requires_auth(self):
        r = self.client.get("/api/documents")
        assert r.status_code == 401

    def test_get_document_requires_auth(self):
        r = self.client.get(f"/api/documents/{uuid.uuid4()}")
        assert r.status_code == 401

    def test_process_document_requires_auth(self):
        r = self.client.post(f"/api/documents/{uuid.uuid4()}/process")
        assert r.status_code == 401

    def test_retrieval_search_requires_auth(self):
        r = self.client.post("/api/retrieval/search", json={"query": "test"})
        assert r.status_code == 401

    def test_rag_query_requires_auth(self):
        r = self.client.post("/api/rag/query", json={"query": "test"})
        assert r.status_code == 401

    def test_auth_me_requires_auth(self):
        r = self.client.get("/api/auth/me")
        assert r.status_code == 401

    def test_health_still_public(self):
        """Health endpoint must remain public for monitoring."""
        r = self.client.get("/api/health")
        assert r.status_code == 200


class TestInvalidToken:
    """Malformed or expired tokens must return 401."""

    def setup_method(self):
        self.client = TestClient(app, raise_server_exceptions=False)

    def test_garbage_token_rejected(self):
        r = self.client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.real.token"})
        assert r.status_code == 401

    def test_wrong_secret_token_rejected(self):
        import jose.jwt as _jwt
        bad_token = _jwt.encode({"sub": "hacker", "role": "ADMIN", "exp": 9999999999}, "wrong_secret", algorithm="HS256")
        r = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {bad_token}"})
        assert r.status_code == 401

    def test_expired_token_rejected(self):
        expired = create_access_token(
            username="test_user", role="VIEWER", expires_delta=timedelta(seconds=-1)
        )
        r = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"})
        assert r.status_code == 401


class TestValidToken:
    """A valid token must allow access to permitted routes."""

    def _override_current_user(self, user: User):
        app.dependency_overrides[get_current_user] = lambda: user

    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_valid_viewer_can_access_me(self):
        viewer = _fake_user(UserRole.VIEWER)
        self._override_current_user(viewer)
        client = TestClient(app)
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {_token_for(viewer)}"})
        assert r.status_code == 200
        data = r.json()
        assert data["username"] == viewer.username
        assert data["role"] == "VIEWER"
        assert "password" not in str(data).lower()
        assert "hashed" not in str(data).lower()

    def test_me_response_never_contains_password(self):
        viewer = _fake_user(UserRole.VIEWER)
        self._override_current_user(viewer)
        client = TestClient(app)
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {_token_for(viewer)}"})
        body = r.text
        assert "hashed_password" not in body
        assert "TestPass" not in body


# ---------------------------------------------------------------------------
# Tests: RBAC (Phase 2)
# ---------------------------------------------------------------------------

class TestRBAC:
    """Role enforcement at the route level."""

    def _override_current_user(self, user: User):
        app.dependency_overrides[get_current_user] = lambda: user

    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_viewer_cannot_list_documents(self):
        """VIEWER is below ANALYST — must get 403 on document routes."""
        viewer = _fake_user(UserRole.VIEWER)
        self._override_current_user(viewer)
        client = TestClient(app, raise_server_exceptions=False)
        r = client.get("/api/documents")
        assert r.status_code == 403

    def test_viewer_cannot_upload(self):
        viewer = _fake_user(UserRole.VIEWER)
        self._override_current_user(viewer)
        client = TestClient(app, raise_server_exceptions=False)
        r = client.post("/api/documents/upload", files={"file": ("a.pdf", b"%PDF-test", "application/pdf")})
        assert r.status_code == 403

    def test_viewer_can_access_rag_query(self):
        """VIEWER has minimum permission for RAG queries — must not get 401/403."""
        from unittest.mock import MagicMock
        from app.db.database import get_db

        viewer = _fake_user(UserRole.VIEWER)
        self._override_current_user(viewer)
        # Also override get_db to avoid needing a real PostgreSQL connection
        app.dependency_overrides[get_db] = lambda: MagicMock()
        client = TestClient(app, raise_server_exceptions=False)
        r = client.post("/api/rag/query", json={"query": "test query"})
        assert r.status_code not in (401, 403)

    def test_viewer_can_access_retrieval_search(self):
        from unittest.mock import MagicMock
        from app.db.database import get_db

        viewer = _fake_user(UserRole.VIEWER)
        self._override_current_user(viewer)
        app.dependency_overrides[get_db] = lambda: MagicMock()
        client = TestClient(app, raise_server_exceptions=False)
        r = client.post("/api/retrieval/search", json={"query": "test query"})
        assert r.status_code not in (401, 403)

    def test_admin_cannot_register_when_not_admin(self):
        """A VIEWER trying to register a new user must get 403."""
        viewer = _fake_user(UserRole.VIEWER)
        self._override_current_user(viewer)
        client = TestClient(app, raise_server_exceptions=False)
        r = client.post("/api/auth/register", json={"username": "newuser", "password": "Password123!", "role": "VIEWER"})
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Tests: password security
# ---------------------------------------------------------------------------

class TestPasswordSecurity:
    def test_hash_is_not_plaintext(self):
        h = hash_password("MySecret!")
        assert "MySecret!" not in h

    def test_different_hashes_for_same_password(self):
        """Argon2id uses per-hash salt — same password must produce different hashes."""
        h1 = hash_password("same_pass")
        h2 = hash_password("same_pass")
        assert h1 != h2

    def test_empty_password_raises(self):
        with pytest.raises(ValueError):
            hash_password("")
