"""
tests/test_rag_single_retrieval.py — regression test for the RAG
double-retrieval bug: routes/rag.py used to call search_with_rerank()
once for the pre-LLM similarity-threshold check, then rag_service.answer_query()
called it again internally, so the LLM's context could in principle be
built from a different retrieval snapshot than the one the threshold
check and citation validation saw.

These tests count actual calls to retrieval_service.search_with_rerank()
(the one function that does the real embedding + pgvector + re-ranking
work) to prove it's invoked exactly once per /api/rag/query request.
"""
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.db.database import get_db
from app.db.user_models import User, UserRole
from app.main import app
from app.services import rag_service
from app.services.auth_service import get_current_user
from app.services.llm_service import LLMModelError


def _fake_user(role: UserRole = UserRole.VIEWER) -> User:
    u = User()
    u.id = uuid.uuid4()
    u.username = f"{role.value.lower()}_single_retrieval_test"
    u.role = role
    u.is_active = "Y"
    u.department = None
    u.clearance_level = 1
    return u


def _fake_chunk(text="Some retrieved evidence text."):
    return {
        "chunk_id": uuid.uuid4(),
        "document_id": uuid.uuid4(),
        "page_id": uuid.uuid4(),
        "page_number": 1,
        "chunk_index": 0,
        "text": text,
        "similarity": 0.9,
        "distance": 0.1,
        "rerank_score": 5.0,
    }


class _FakeLLM:
    def generate(self, prompt, **kwargs):
        return "A grounded answer."


@pytest.fixture()
def client_with_fakes():
    user = _fake_user()
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: MagicMock()
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


class TestRetrievalCalledOnce:
    def test_search_with_rerank_called_exactly_once_per_rag_query(self, client_with_fakes):
        chunks = [_fake_chunk("Relevant evidence.")]

        with patch(
            "app.routes.rag.search_with_rerank", return_value=chunks
        ) as mock_route_search, patch.object(
            rag_service, "search_with_rerank", return_value=chunks
        ) as mock_service_search, patch.object(
            rag_service.llm_service, "get_llm_service", return_value=_FakeLLM()
        ):
            resp = client_with_fakes.post("/api/rag/query", json={"query": "What is the policy?"})

        assert resp.status_code == 200
        # The route's own retrieval call happens exactly once...
        assert mock_route_search.call_count == 1
        # ...and rag_service must NOT retrieve again internally, since the
        # route now passes ranked_chunks= through to answer_query().
        assert mock_service_search.call_count == 0

    def test_context_and_citation_check_use_the_same_chunk_set(self, client_with_fakes):
        """
        The chunk_id in the response's sources must be one of the IDs from
        the single retrieval call -- proving citation validation and
        context building saw the identical snapshot.
        """
        chunk = _fake_chunk("The only piece of evidence.")

        with patch("app.routes.rag.search_with_rerank", return_value=[chunk]), patch.object(
            rag_service, "search_with_rerank"
        ) as mock_service_search, patch.object(
            rag_service.llm_service, "get_llm_service", return_value=_FakeLLM()
        ):
            resp = client_with_fakes.post("/api/rag/query", json={"query": "test question"})

        assert resp.status_code == 200
        mock_service_search.assert_not_called()
        body = resp.json()
        assert body["sources"][0]["chunk_id"] == str(chunk["chunk_id"])
        assert body["sources"][0]["citation_valid"] is True

    def test_empty_retrieval_short_circuits_without_calling_llm(self, client_with_fakes):
        with patch("app.routes.rag.search_with_rerank", return_value=[]), patch.object(
            rag_service, "search_with_rerank"
        ) as mock_service_search, patch.object(
            rag_service.llm_service, "get_llm_service"
        ) as mock_get_llm:
            resp = client_with_fakes.post("/api/rag/query", json={"query": "no evidence for this"})

        assert resp.status_code == 200
        mock_service_search.assert_not_called()
        mock_get_llm.assert_not_called()
        assert resp.json()["sources"] == []


class TestAnswerQueryAcceptsPrecomputedChunks:
    """Unit-level check on rag_service.answer_query() itself (no HTTP layer)."""

    def test_ranked_chunks_kwarg_skips_internal_retrieval(self, monkeypatch):
        chunk = _fake_chunk("precomputed evidence")

        def fail_if_called(*args, **kwargs):
            raise AssertionError("search_with_rerank must not be called when ranked_chunks is provided")

        monkeypatch.setattr(rag_service, "search_with_rerank", fail_if_called)

        result = rag_service.answer_query(
            db=MagicMock(), query="test", llm=_FakeLLM(), ranked_chunks=[chunk]
        )

        assert result["sources"][0]["chunk_id"] == chunk["chunk_id"]
        assert result["answer"] == "A grounded answer."

    def test_ranked_chunks_none_still_retrieves_internally(self, monkeypatch):
        """Backward compatibility: existing callers that don't pass ranked_chunks are unaffected."""
        chunk = _fake_chunk("internally retrieved evidence")
        calls = []

        def fake_search(db, query, top_k=None, rerank=True):
            calls.append(1)
            return [chunk]

        monkeypatch.setattr(rag_service, "search_with_rerank", fake_search)

        result = rag_service.answer_query(db=MagicMock(), query="test", llm=_FakeLLM())

        assert len(calls) == 1
        assert result["sources"][0]["chunk_id"] == chunk["chunk_id"]
