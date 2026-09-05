"""
Tests for app/services/reranker_service.py (Phase 4B: cross-encoder re-ranking).

Every test here except test_real_model_ranks_relevant_text_above_unrelated_text
runs against the autouse fake cross-encoder (see
conftest.py::fake_cross_encoder_model) -- fast, deterministic, no network.
The one real-model test is marked @pytest.mark.real_reranker_model to opt
out of the fake, same convention as test_embedding_service.py's real-model
test. Run it explicitly with:

    ..\\venv\\Scripts\\python.exe -m pytest tests/test_reranker_service.py -v -m real_reranker_model

It downloads cross-encoder/ms-marco-MiniLM-L-6-v2 from Hugging Face the
first time it runs on a machine (requires internet once), then uses the
local cache after that. It is NOT part of the default `pytest` run.
"""
import pytest

from app.services.reranker_service import (
    RerankerModelError,
    RerankerService,
    get_reranker_service,
    reset_reranker_service,
)


class _ControlledCrossEncoder:
    """
    Stand-in whose predict() returns caller-controlled scores, keyed by
    the pair itself, and records exactly which pairs it was called with --
    so ordering-change and pair-construction tests can assert on precise,
    known values instead of the autouse fake's per-hash scores.
    """

    def __init__(self, score_by_pair):
        self._score_by_pair = score_by_pair
        self.calls = []

    def predict(self, pairs, batch_size=None, show_progress_bar=False):
        self.calls.append(list(pairs))
        return [self._score_by_pair[pair] for pair in pairs]


def _chunk(chunk_id, text, similarity=0.5, distance=0.5):
    """A minimal stand-in for a retrieval_service.search() result dict."""
    return {
        "chunk_id": chunk_id,
        "document_id": "doc-1",
        "page_id": "page-1",
        "page_number": 1,
        "chunk_index": 0,
        "text": text,
        "similarity": similarity,
        "distance": distance,
    }


def test_rerank_changes_ordering_by_descending_score(monkeypatch):
    query = "What is the leave policy?"
    chunk_a = _chunk("a", "Unrelated text about the cafeteria menu.")
    chunk_b = _chunk("b", "Employees get fifteen days of paid leave per year.")
    chunk_c = _chunk("c", "Something moderately related to HR policy.")

    fake_model = _ControlledCrossEncoder(
        {
            (query, chunk_a["text"]): -5.0,
            (query, chunk_b["text"]): 8.0,
            (query, chunk_c["text"]): 1.0,
        }
    )
    service = RerankerService()
    monkeypatch.setattr(service, "_get_model", lambda: fake_model)

    # Deliberately fed in pgvector's (arbitrary, non-relevance-sorted) order.
    reranked = service.rerank(query, [chunk_a, chunk_b, chunk_c])

    assert [c["chunk_id"] for c in reranked] == ["b", "c", "a"]


def test_query_chunk_pairs_are_constructed_correctly(monkeypatch):
    query = "leave policy"
    chunk_1 = _chunk("1", "first chunk text")
    chunk_2 = _chunk("2", "second chunk text")

    fake_model = _ControlledCrossEncoder(
        {
            (query, "first chunk text"): 0.1,
            (query, "second chunk text"): 0.2,
        }
    )
    service = RerankerService()
    monkeypatch.setattr(service, "_get_model", lambda: fake_model)

    service.rerank(query, [chunk_1, chunk_2])

    assert len(fake_model.calls) == 1
    assert fake_model.calls[0] == [(query, "first chunk text"), (query, "second chunk text")]


def test_rerank_score_is_attached_to_every_result(monkeypatch):
    query = "anything"
    chunk_1 = _chunk("1", "text one")
    chunk_2 = _chunk("2", "text two")

    fake_model = _ControlledCrossEncoder({(query, "text one"): 3.0, (query, "text two"): 7.0})
    service = RerankerService()
    monkeypatch.setattr(service, "_get_model", lambda: fake_model)

    reranked = service.rerank(query, [chunk_1, chunk_2])

    scores = {c["chunk_id"]: c["rerank_score"] for c in reranked}
    assert scores == {"1": 3.0, "2": 7.0}


def test_rerank_preserves_all_existing_metadata(monkeypatch):
    query = "leave policy"
    original = _chunk("chunk-123", "The leave policy allows fifteen days.", similarity=0.91, distance=0.09)
    original["document_id"] = "doc-xyz"
    original["page_id"] = "page-xyz"
    original["page_number"] = 5
    original["chunk_index"] = 2

    fake_model = _ControlledCrossEncoder({(query, original["text"]): 4.2})
    service = RerankerService()
    monkeypatch.setattr(service, "_get_model", lambda: fake_model)

    [result] = service.rerank(query, [original])

    for key in ("chunk_id", "document_id", "page_id", "page_number", "chunk_index", "text", "similarity", "distance"):
        assert result[key] == original[key]
    assert result["rerank_score"] == 4.2


def test_rerank_does_not_mutate_caller_dicts(monkeypatch):
    query = "anything"
    original = _chunk("1", "some text")
    fake_model = _ControlledCrossEncoder({(query, "some text"): 1.0})
    service = RerankerService()
    monkeypatch.setattr(service, "_get_model", lambda: fake_model)

    service.rerank(query, [original])

    assert "rerank_score" not in original


def test_rerank_empty_list_returns_empty_list_without_loading_model(monkeypatch):
    service = RerankerService()

    def fail_if_called():
        raise AssertionError("Model should never be loaded for an empty candidate list.")

    monkeypatch.setattr(service, "_get_model", fail_if_called)

    assert service.rerank("anything", []) == []


def test_score_empty_texts_returns_empty_list():
    service = RerankerService()
    assert service.score("anything", []) == []


@pytest.mark.parametrize("bad_query", ["", "   ", None])
def test_rerank_rejects_empty_query_when_there_are_candidates(bad_query):
    service = RerankerService()
    with pytest.raises(RerankerModelError, match="[Qq]uery"):
        service.rerank(bad_query, [_chunk("1", "some text")])


def test_model_is_loaded_once_and_reused(monkeypatch):
    import app.services.reranker_service as rs

    load_calls = []
    original_loader = rs._load_cross_encoder

    def counting_loader(model_name, device, cache_folder):
        load_calls.append(1)
        return original_loader(model_name, device, cache_folder)

    monkeypatch.setattr(rs, "_load_cross_encoder", counting_loader)

    service = RerankerService()
    service.score("q1", ["text a"])
    service.score("q2", ["text b"])
    service.rerank("q3", [_chunk("1", "text c")])

    assert len(load_calls) == 1


def test_get_reranker_service_returns_singleton():
    reset_reranker_service()
    try:
        service_a = get_reranker_service()
        service_b = get_reranker_service()
        assert service_a is service_b
    finally:
        reset_reranker_service()


def test_model_load_failure_raises_reranker_model_error(monkeypatch):
    import app.services.reranker_service as rs

    def broken_loader(model_name, device, cache_folder):
        raise RuntimeError("simulated cross-encoder load failure")

    monkeypatch.setattr(rs, "_load_cross_encoder", broken_loader)

    service = RerankerService()
    with pytest.raises(RerankerModelError, match="Failed to load"):
        service.score("query", ["some text"])


def test_predict_failure_raises_reranker_model_error(monkeypatch):
    class BrokenModel:
        def predict(self, pairs, **kwargs):
            raise RuntimeError("simulated scoring failure")

    service = RerankerService()
    monkeypatch.setattr(service, "_get_model", lambda: BrokenModel())

    with pytest.raises(RerankerModelError, match="scoring failed"):
        service.score("query", ["some text"])


def test_reranker_uses_only_local_predict_no_external_calls(monkeypatch):
    """
    Confirms reranking's only path to a score is the local CrossEncoder's
    predict() -- no requests/httpx call, no OpenAI/Groq/hosted inference.
    """
    called = {"local_predict": False}

    class SpyModel:
        def predict(self, pairs, **kwargs):
            called["local_predict"] = True
            return [0.0 for _ in pairs]

    service = RerankerService()
    monkeypatch.setattr(service, "_get_model", lambda: SpyModel())

    service.score("local-only check", ["some text"])

    assert called["local_predict"] is True


@pytest.mark.real_reranker_model
def test_real_model_ranks_relevant_text_above_unrelated_text():
    """
    The one test in the suite that loads the actual
    cross-encoder/ms-marco-MiniLM-L-6-v2 model. Verifies it assigns a
    higher relevance score to a genuinely relevant passage than to an
    unrelated one -- something the fake model can't meaningfully check.
    """
    service = RerankerService()
    query = "What is the company's leave policy?"
    relevant = "Employees are entitled to fifteen days of paid leave per calendar year."
    unrelated = "The quarterly revenue report showed a twelve percent increase."

    scores = service.score(query, [relevant, unrelated])

    assert scores[0] > scores[1]
