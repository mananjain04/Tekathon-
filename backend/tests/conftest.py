"""
Shared pytest fixtures for DB-backed Phase 2 tests.

These tests run against the real local Postgres database (the one Phase 1
set up and migrated) rather than a mocked/sqlite DB, since the models use
Postgres-specific types (UUID, JSONB, pgvector). Every test that creates a
Document is responsible for registering its id with `cleanup_documents` so
the row (and its cascade-deleted pages/chunks) is removed afterward and
tests never accumulate junk in a real database.
"""
import pytest

from app.core.config import settings
from app.db.database import SessionLocal
from app.db.models import Document


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def cleanup_documents(db_session):
    created_ids = []
    yield created_ids
    if created_ids:
        db_session.rollback()  # in case a test left the session mid-transaction
        db_session.query(Document).filter(Document.id.in_(created_ids)).delete(synchronize_session=False)
        db_session.commit()


@pytest.fixture()
def temp_storage(monkeypatch, tmp_path):
    """Redirects document storage to a throwaway directory for the test."""
    monkeypatch.setattr(settings, "storage_dir", str(tmp_path / "storage"))
    return tmp_path / "storage"
