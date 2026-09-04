"""
Tests for app/services/retrieval_service.py (Phase 4A: vector search only).

Similarity-ordering tests use indexed_chunk_factory (see conftest.py) to
insert chunks with exact, known embedding vectors, and monkeypatch the
query embedding to a matching fixed vector -- so cosine distances are
exact/known instead of depending on the fake model's per-text-hash
vectors used elsewhere in the suite. This keeps ordering assertions exact
rather than "probably close", regardless of what the fake or real
embedding model would produce for arbitrary text.
"""
import numpy as np
import pytest

from app.db.models import DocumentStatus
from app.services import embedding_service, retrieval_service
from app.services.retrieval_service import RetrievalError


class _FixedVectorService:
    """Stand-in for EmbeddingService that always returns the same vector, regardless of input text."""

    def __init__(self, vector):
        self._vector = vector

    def embed_text(self, text):
        return self._vector

    def embed_texts(self, texts):
        return [self._vector for _ in texts]


def _unit_vector(index, dim=384):
    v = np.zeros(dim)
    v[index] = 1.0
    return v.tolist()


def test_search_returns_results_ordered_by_similarity(db_session, indexed_chunk_factory, monkeypatch):
    query_vector = _unit_vector(0)
    monkeypatch.setattr(retrieval_service, "get_embedding_service", lambda: _FixedVectorService(query_vector))

    _, chunk_exact = indexed_chunk_factory("Exact match chunk", query_vector, chunk_index=0)
    _, chunk_orthogonal = indexed_chunk_factory("Orthogonal chunk", _unit_vector(1), chunk_index=1)
    _, chunk_opposite = indexed_chunk_factory(
        "Opposite chunk", (-np.array(query_vector)).tolist(), chunk_index=2
    )

    results = retrieval_service.search(db_session, "anything", top_k=10)

    assert [r["chunk_id"] for r in results] == [chunk_exact.id, chunk_orthogonal.id, chunk_opposite.id]
    assert results[0]["similarity"] == pytest.approx(1.0, abs=1e-6)
    assert results[1]["similarity"] == pytest.approx(0.0, abs=1e-6)
    assert results[2]["similarity"] == pytest.approx(-1.0, abs=1e-6)


def test_search_preserves_document_page_and_text(db_session, indexed_chunk_factory, monkeypatch):
    query_vector = _unit_vector(0)
    monkeypatch.setattr(retrieval_service, "get_embedding_service", lambda: _FixedVectorService(query_vector))

    document, chunk = indexed_chunk_factory(
        "The leave policy allows fifteen days of paid leave per year.",
        query_vector,
        page_number=5,
        chunk_index=2,
    )

    results = retrieval_service.search(db_session, "leave policy", top_k=5)

    assert len(results) == 1
    result = results[0]
    assert result["document_id"] == document.id
    assert result["page_id"] == chunk.page_id
    assert result["page_number"] == 5
    assert result["chunk_index"] == 2
    assert result["text"] == chunk.text


def test_query_embedding_has_dimension_384():
    vector = embedding_service.get_embedding_service().embed_text("dimension check query")
    assert len(vector) == 384


def test_top_k_is_respected(db_session, indexed_chunk_factory, monkeypatch):
    query_vector = _unit_vector(0)
    monkeypatch.setattr(retrieval_service, "get_embedding_service", lambda: _FixedVectorService(query_vector))

    for i in range(5):
        indexed_chunk_factory(f"Chunk number {i}", _unit_vector(i % 10), chunk_index=i)

    results = retrieval_service.search(db_session, "anything", top_k=3)
    assert len(results) == 3


@pytest.mark.parametrize("bad_top_k", [0, -1, 101, 1000])
def test_top_k_validation_rejects_out_of_range_values(db_session, bad_top_k):
    with pytest.raises(RetrievalError, match="top_k"):
        retrieval_service.search(db_session, "some query", top_k=bad_top_k)


@pytest.mark.parametrize("bad_query", ["", "   ", None])
def test_empty_query_is_rejected(db_session, bad_query):
    with pytest.raises(RetrievalError, match="[Qq]uery"):
        retrieval_service.search(db_session, bad_query, top_k=5)


def test_empty_database_returns_empty_list_cleanly(db_session):
    results = retrieval_service.search(db_session, "no chunks exist yet", top_k=10)
    assert results == []


def test_chunks_with_null_embedding_are_ignored(db_session, indexed_chunk_factory, monkeypatch):
    query_vector = _unit_vector(0)
    monkeypatch.setattr(retrieval_service, "get_embedding_service", lambda: _FixedVectorService(query_vector))

    _, embedded_chunk = indexed_chunk_factory("Has an embedding", query_vector, chunk_index=0)
    _, null_chunk = indexed_chunk_factory("No embedding at all", None, chunk_index=1)

    results = retrieval_service.search(db_session, "anything", top_k=10)

    result_ids = [r["chunk_id"] for r in results]
    assert embedded_chunk.id in result_ids
    assert null_chunk.id not in result_ids


def test_chunks_from_non_indexed_documents_are_excluded(db_session, indexed_chunk_factory, monkeypatch):
    query_vector = _unit_vector(0)
    monkeypatch.setattr(retrieval_service, "get_embedding_service", lambda: _FixedVectorService(query_vector))

    _, ready_chunk = indexed_chunk_factory("From an indexed document", query_vector, status=DocumentStatus.INDEXED)
    _, failed_chunk = indexed_chunk_factory(
        "From a failed document but somehow has a vector", query_vector, status=DocumentStatus.FAILED
    )

    results = retrieval_service.search(db_session, "anything", top_k=10)

    result_ids = [r["chunk_id"] for r in results]
    assert ready_chunk.id in result_ids
    assert failed_chunk.id not in result_ids


def test_search_uses_only_local_embedding_service_no_external_calls(db_session, monkeypatch):
    """
    Confirms retrieval's only embedding path is the exact same local,
    offline EmbeddingService used in Phase 3 -- not a second embedding
    implementation, not OpenAI/Groq/any hosted inference API.
    """
    called = {"local_embed": False}
    original_embed_text = embedding_service.EmbeddingService.embed_text

    def spy_embed_text(self, text):
        called["local_embed"] = True
        return original_embed_text(self, text)

    monkeypatch.setattr(embedding_service.EmbeddingService, "embed_text", spy_embed_text)

    retrieval_service.search(db_session, "local-only check", top_k=1)

    assert called["local_embed"] is True


def test_query_embedding_failure_raises_retrieval_error(db_session, monkeypatch):
    def broken_loader(model_name, device, cache_folder):
        raise RuntimeError("simulated embedding failure during retrieval")

    monkeypatch.setattr(embedding_service, "_load_sentence_transformer", broken_loader)
    embedding_service.reset_embedding_service()

    with pytest.raises(RetrievalError, match="Query embedding failed"):
        retrieval_service.search(db_session, "this will fail to embed", top_k=5)

    embedding_service.reset_embedding_service()
