"""
Route-level tests for app/routes/retrieval.py using FastAPI's TestClient
(real HTTP request/response cycle). Runs against the real Postgres DB
(see conftest.py) -- indexed_chunk_factory commits so these rows are
visible to the separate DB session the app's own get_db() dependency uses.
"""
import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.services import retrieval_service

client = TestClient(app)


class _FixedVectorService:
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


def test_search_route_returns_ranked_results(indexed_chunk_factory, monkeypatch):
    query_vector = _unit_vector(0)
    monkeypatch.setattr(retrieval_service, "get_embedding_service", lambda: _FixedVectorService(query_vector))

    document, chunk = indexed_chunk_factory(
        "The leave policy allows fifteen days of paid leave per year.",
        query_vector,
        page_number=5,
        chunk_index=2,
    )

    resp = client.post("/api/retrieval/search", json={"query": "What is the leave policy?", "top_k": 5})
    assert resp.status_code == 200
    body = resp.json()

    assert body["query"] == "What is the leave policy?"
    assert len(body["results"]) == 1
    result = body["results"][0]
    assert result["chunk_id"] == str(chunk.id)
    assert result["document_id"] == str(document.id)
    assert result["page_number"] == 5
    assert result["chunk_index"] == 2
    assert result["similarity"] == _approx_one(result["similarity"])


def _approx_one(value):
    # Local helper (not a pytest fixture) so this file doesn't need a
    # pytest import purely for one approx() call.
    assert abs(value - 1.0) < 1e-6
    return value


def test_search_route_rejects_empty_query():
    resp = client.post("/api/retrieval/search", json={"query": "", "top_k": 5})
    assert resp.status_code in (400, 422)  # 422 if Pydantic's min_length=1 catches it first


def test_search_route_rejects_out_of_range_top_k():
    resp = client.post("/api/retrieval/search", json={"query": "valid query", "top_k": 0})
    assert resp.status_code == 422  # Pydantic Field(ge=1) catches this before the service does


def test_search_route_on_empty_database_returns_empty_results():
    resp = client.post("/api/retrieval/search", json={"query": "nothing indexed for this exact query yet", "top_k": 5})
    assert resp.status_code == 200
    assert resp.json()["results"] == []


def test_search_route_exposed_in_openapi_schema():
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    schema = resp.json()
    assert "/api/retrieval/search" in schema["paths"]
    assert "post" in schema["paths"]["/api/retrieval/search"]


# ---------------------------------------------------------------------------
# Phase 4B: cross-encoder re-ranking via the same route (request.rerank,
# response.reranked / result.rerank_score). All of the above Phase 4A tests
# still pass unmodified since rerank defaults to true and the autouse fake
# cross-encoder (conftest.py) keeps them offline and fast.
# ---------------------------------------------------------------------------


def test_search_route_default_reranks_and_attaches_score(indexed_chunk_factory, monkeypatch):
    query_vector = _unit_vector(0)
    monkeypatch.setattr(retrieval_service, "get_embedding_service", lambda: _FixedVectorService(query_vector))
    indexed_chunk_factory("The leave policy allows fifteen days of paid leave.", query_vector)

    resp = client.post("/api/retrieval/search", json={"query": "leave policy", "top_k": 5})
    assert resp.status_code == 200
    body = resp.json()

    assert body["reranked"] is True
    assert len(body["results"]) == 1
    assert isinstance(body["results"][0]["rerank_score"], float)


def test_search_route_rerank_false_returns_null_rerank_score(indexed_chunk_factory, monkeypatch):
    query_vector = _unit_vector(0)
    monkeypatch.setattr(retrieval_service, "get_embedding_service", lambda: _FixedVectorService(query_vector))
    indexed_chunk_factory("Some chunk text", query_vector)

    resp = client.post("/api/retrieval/search", json={"query": "anything", "top_k": 5, "rerank": False})
    assert resp.status_code == 200
    body = resp.json()

    assert body["reranked"] is False
    assert all(r["rerank_score"] is None for r in body["results"])


def test_search_route_rerank_field_defaults_to_true_when_omitted():
    resp = client.post("/api/retrieval/search", json={"query": "anything", "top_k": 5})
    assert resp.status_code == 200
    assert resp.json()["reranked"] is True
