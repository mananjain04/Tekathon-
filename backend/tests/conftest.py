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
from app.db.models import Chunk, Document, DocumentStatus, Page
from app.services import embedding_service, reranker_service


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


class _FakeCrossEncoder:
    """
    Deterministic stand-in for a real CrossEncoder: given a list of
    (query, text) pairs, returns a score derived from a hash of each pair
    -- correct interface shape (predict(pairs) -> a sequence of floats),
    without loading torch/transformers or touching the network. Good
    enough to exercise reranker orchestration, sorting, and error
    handling; not a substitute for the real cross-encoder's semantic
    relevance judgments (see test_reranker_service.py's one real-model
    test for that).
    """

    def predict(self, pairs, batch_size=None, show_progress_bar=False):
        scores = []
        for query, text in pairs:
            rng = np.random.default_rng(abs(hash((query, text))) % (2**32))
            scores.append(float(rng.uniform(-10.0, 10.0)))
        return np.array(scores)


@pytest.fixture(autouse=True)
def fake_cross_encoder_model(request, monkeypatch):
    """
    Patches the one seam reranker_service.py exposes for this purpose
    (_load_cross_encoder) with a fast deterministic fake, for every test
    by default -- so the whole suite (including retrieval route tests,
    which now go through re-ranking by default) runs offline and fast,
    with no dependency on downloading cross-encoder/ms-marco-MiniLM-L-6-v2.
    The one test that needs the real model opts out with
    @pytest.mark.real_reranker_model.
    """
    if request.node.get_closest_marker("real_reranker_model"):
        yield
        return

    monkeypatch.setattr(
        reranker_service,
        "_load_cross_encoder",
        lambda model_name, device, cache_folder: _FakeCrossEncoder(),
    )
    reranker_service.reset_reranker_service()
    yield
    reranker_service.reset_reranker_service()


@pytest.fixture()
def indexed_chunk_factory(db_session, cleanup_documents):
    """
    Factory fixture for retrieval tests: creates a Document/Page/Chunk
    directly (skipping the whole upload/extract/chunk/embed pipeline)
    with a caller-controlled embedding vector, so retrieval ranking can be
    tested against exact, known cosine distances instead of depending on
    the fake model's per-text-hash vectors. Commits (not just flushes) so
    the rows are visible to a *different* session/connection too -- needed
    for route-level tests that go through FastAPI's own `get_db` session.

    Usage: indexed_chunk_factory(text, embedding, ...) -> (document, chunk)
    Pass an existing document's id via document_id= to add another chunk
    to the same document instead of creating a new one each call.
    """

    def _make(
        text,
        embedding,
        *,
        document_id=None,
        page_number=1,
        chunk_index=0,
        status=DocumentStatus.INDEXED,
    ):
        if document_id is None:
            document = Document(
                filename="retrieval_test.pdf",
                storage_path="retrieval_test.pdf",
                content_type="application/pdf",
                status=status,
            )
            db_session.add(document)
            db_session.flush()
            cleanup_documents.append(document.id)
        else:
            document = db_session.get(Document, document_id)

        page = Page(document_id=document.id, page_number=page_number, text=text, ocr_used=False)
        db_session.add(page)
        db_session.flush()

        chunk = Chunk(
            document_id=document.id,
            page_id=page.id,
            page_number=page_number,
            chunk_index=chunk_index,
            text=text,
            token_count=len(text.split()) or None,
            chunk_metadata={},
            embedding=embedding,
        )
        db_session.add(chunk)
        db_session.commit()
        db_session.refresh(chunk)
        return document, chunk

    return _make
