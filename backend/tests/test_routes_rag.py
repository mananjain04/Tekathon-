"""
Route-level tests for app/routes/rag.py using FastAPI's TestClient (Phase 5A).

Retrieval/re-ranking is faked by monkeypatching
app.services.rag_service.search_with_rerank, and the LLM is faked by
monkeypatching app.services.llm_service.get_llm_service (the seam
rag_service.py falls back to when no `llm=` override is given, which is
exactly the route's code path) -- so these tests need no real embedding/
cross-encoder/LLM model, no GGUF file, and never touch the network, while
still exercising real HTTP request/response validation end-to-end.
"""
import uuid

import app.services.llm_service as llm_service_module
import app.services.rag_service as rag_service_module
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class _FakeLLM:
    def __init__(self, answer="This is the grounded answer (page 4)."):
        self._answer = answer

    def generate(self, prompt, **kwargs):
        return self._answer


def _chunk(**overrides):
    base = {
        "chunk_id": uuid.uuid4(),
        "document_id": uuid.uuid4(),
        "page_id": uuid.uuid4(),
        "page_number": 4,
        "chunk_index": 0,
        "text": "Employees get fifteen days of paid leave per year.",
        "similarity": 0.87,
        "distance": 0.13,
        "rerank_score": 6.5,
    }
    base.update(overrides)
    return base


def test_query_returns_answer_and_sources(monkeypatch):
    chunk = _chunk()
    monkeypatch.setattr(rag_service_module, "search_with_rerank", lambda db, query, top_k=None, rerank=True: [chunk])
    monkeypatch.setattr(llm_service_module, "get_llm_service", lambda: _FakeLLM())

    resp = client.post("/api/rag/query", json={"query": "What is the leave policy?", "top_k": 5})

    assert resp.status_code == 200
    body = resp.json()
    assert body["query"] == "What is the leave policy?"
    assert body["answer"] == "This is the grounded answer (page 4)."
    assert len(body["sources"]) == 1
    source = body["sources"][0]
    assert source["chunk_id"] == str(chunk["chunk_id"])
    assert source["document_id"] == str(chunk["document_id"])
    assert source["page_number"] == 4
    assert source["chunk_index"] == 0
    assert source["text"] == chunk["text"]


def test_response_never_exposes_filesystem_or_storage_paths(monkeypatch):
    chunk = _chunk()
    monkeypatch.setattr(rag_service_module, "search_with_rerank", lambda db, query, top_k=None, rerank=True: [chunk])
    monkeypatch.setattr(llm_service_module, "get_llm_service", lambda: _FakeLLM())

    resp = client.post("/api/rag/query", json={"query": "a question"})

    assert resp.status_code == 200
    raw_body = resp.text
    assert "storage_path" not in raw_body
    assert "C:\\" not in raw_body
    assert "/home/" not in raw_body


def test_empty_query_is_rejected_with_422_by_request_validation():
    resp = client.post("/api/rag/query", json={"query": ""})
    assert resp.status_code == 422


def test_missing_query_field_is_rejected_with_422():
    resp = client.post("/api/rag/query", json={})
    assert resp.status_code == 422


def test_top_k_out_of_range_is_rejected_with_422():
    resp = client.post("/api/rag/query", json={"query": "a question", "top_k": 0})
    assert resp.status_code == 422

    resp = client.post("/api/rag/query", json={"query": "a question", "top_k": 100000})
    assert resp.status_code == 422


def test_top_k_defaults_when_omitted(monkeypatch):
    captured = {}

    def fake_search(db, query, top_k=None, rerank=True):
        captured["top_k"] = top_k
        return []

    monkeypatch.setattr(rag_service_module, "search_with_rerank", fake_search)
    monkeypatch.setattr(llm_service_module, "get_llm_service", lambda: _FakeLLM())

    resp = client.post("/api/rag/query", json={"query": "a question"})

    assert resp.status_code == 200
    from app.core.config import settings

    assert captured["top_k"] == settings.retrieval_top_k_default


def test_empty_retrieval_result_still_returns_200_with_empty_sources(monkeypatch):
    monkeypatch.setattr(rag_service_module, "search_with_rerank", lambda db, query, top_k=None, rerank=True: [])
    monkeypatch.setattr(
        llm_service_module, "get_llm_service", lambda: _FakeLLM(answer="Cannot be determined from the documents.")
    )

    resp = client.post("/api/rag/query", json={"query": "nothing indexed for this"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["sources"] == []
    assert body["answer"] == "Cannot be determined from the documents."


def test_missing_llm_model_returns_400_not_a_fake_answer(monkeypatch):
    """
    When the local LLM is unavailable the route must return a clear
    application-level error -- never a fabricated 200 answer.
    This exercises the llama_cpp provider with LLM_MODEL_PATH unset,
    confirming it surfaces as a 400 at the HTTP layer.
    (Ollama connection-failure -> 400 is covered by test_ollama_provider.py.)
    """
    from app.core.config import settings

    monkeypatch.setattr(rag_service_module, "search_with_rerank", lambda db, query, top_k=None, rerank=True: [])
    monkeypatch.setattr(settings, "llm_provider", "llama_cpp")
    monkeypatch.setattr(settings, "llm_model_path", None)
    llm_service_module.reset_llm_service()

    resp = client.post("/api/rag/query", json={"query": "a question"})

    assert resp.status_code == 400
    assert "LLM" in resp.json()["detail"] or "model" in resp.json()["detail"].lower()

    llm_service_module.reset_llm_service()



def test_retrieval_failure_returns_400(monkeypatch):
    from app.services.retrieval_service import RetrievalError

    def broken_search(db, query, top_k=None, rerank=True):
        raise RetrievalError("simulated retrieval failure")

    monkeypatch.setattr(rag_service_module, "search_with_rerank", broken_search)

    resp = client.post("/api/rag/query", json={"query": "a question"})

    assert resp.status_code == 400


def test_no_external_network_dependency_end_to_end(monkeypatch):
    """
    Confirms the whole request path (route -> rag_service -> fake
    retrieval -> fake LLM) never needs any external HTTP call -- both fakes
    here are pure in-process Python, no network access at all, and the
    request still succeeds.
    """
    monkeypatch.setattr(rag_service_module, "search_with_rerank", lambda db, query, top_k=None, rerank=True: [_chunk()])
    monkeypatch.setattr(llm_service_module, "get_llm_service", lambda: _FakeLLM())

    resp = client.post("/api/rag/query", json={"query": "a question"})

    assert resp.status_code == 200


def test_multiple_sources_preserve_order_through_the_http_response(monkeypatch):
    """Task 5 items D/M/N at the route/serialization level (not just the service level)."""
    chunk_a = _chunk(page_number=7, chunk_index=0, text="Evidence page seven.", rerank_score=9.1)
    chunk_b = _chunk(page_number=2, chunk_index=1, text="Evidence page two.", rerank_score=4.4)
    chunk_c = _chunk(page_number=12, chunk_index=3, text="Evidence page twelve.", rerank_score=1.0)
    monkeypatch.setattr(
        rag_service_module, "search_with_rerank", lambda db, query, top_k=None, rerank=True: [chunk_a, chunk_b, chunk_c]
    )
    monkeypatch.setattr(llm_service_module, "get_llm_service", lambda: _FakeLLM())

    resp = client.post("/api/rag/query", json={"query": "a multi-source question"})

    assert resp.status_code == 200
    sources = resp.json()["sources"]
    assert [s["page_number"] for s in sources] == [7, 2, 12]
    assert [s["text"] for s in sources] == ["Evidence page seven.", "Evidence page two.", "Evidence page twelve."]
