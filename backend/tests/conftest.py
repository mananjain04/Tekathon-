"""
Shared pytest fixtures for DB-backed Phase 2/3 tests.

These tests run against the real local Postgres database (the one Phase 1
set up and migrated) rather than a mocked/sqlite DB, since the models use
Postgres-specific types (UUID, JSONB, pgvector). Every test that creates a
Document is responsible for registering its id with `cleanup_documents` so
the row (and its cascade-deleted pages/chunks) is removed afterward and
tests never accumulate junk in a real database.
"""
import numpy as np
import pytest

from app.core.config import settings
from app.db.database import SessionLocal
from app.db.models import Document
from app.services import embedding_service


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


class _FakeSentenceTransformer:
    """
    Deterministic stand-in for a real sentence-transformers model: same
    input text always -> same output vector (seeded from a hash of the
    text), correct dimension, L2-normalized when asked -- everything the
    real model contract guarantees, without loading torch or touching the
    network. Good enough to exercise chunking/storage/status-transition
    logic; not a substitute for the real semantic-similarity behavior (see
    test_embedding_service.py's real-model test for that).
    """

    def encode(self, texts, batch_size=None, convert_to_numpy=True, normalize_embeddings=True, show_progress_bar=False):
        vectors = []
        for text in texts:
            rng = np.random.default_rng(abs(hash(text)) % (2**32))
            vector = rng.standard_normal(embedding_service.settings.embedding_dim)
            if normalize_embeddings:
                norm = np.linalg.norm(vector)
                if norm > 0:
                    vector = vector / norm
            vectors.append(vector)
        return np.array(vectors)


@pytest.fixture(autouse=True)
def fake_embedding_model(request, monkeypatch):
    """
    Patches the one seam embedding_service.py exposes for this purpose
    (_load_sentence_transformer) with a fast deterministic fake, for every
    test by default -- so the whole suite runs offline and fast, with no
    dependency on downloading all-MiniLM-L6-v2. Tests that need the real
    model (there should be exactly one, see test_embedding_service.py)
    opt out with @pytest.mark.real_embedding_model.
    """
    if request.node.get_closest_marker("real_embedding_model"):
        yield
        return

    monkeypatch.setattr(
        embedding_service,
        "_load_sentence_transformer",
        lambda model_name, device, cache_folder: _FakeSentenceTransformer(),
    )
    embedding_service.reset_embedding_service()
    yield
    embedding_service.reset_embedding_service()
