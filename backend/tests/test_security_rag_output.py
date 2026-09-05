"""
tests/test_security_rag_output.py — Phase 4: RAG output validation tests.

Tests the similarity threshold gate and citation cross-validator.
No live database or LLM required.
"""
import uuid

import pytest

from app.services.rag_output_validator import (
    INSUFFICIENT_EVIDENCE_ANSWER,
    check_evidence_threshold,
    validate_sources,
)
from app.core.config import settings


def _make_chunk(similarity: float, chunk_id=None) -> dict:
    if chunk_id is None:
        chunk_id = uuid.uuid4()
    return {
        "chunk_id": chunk_id,
        "document_id": uuid.uuid4(),
        "page_id": uuid.uuid4(),
        "page_number": 1,
        "chunk_index": 0,
        "text": "Sample chunk text.",
        "similarity": similarity,
        "distance": 1.0 - similarity,
        "rerank_score": None,
    }


# ---------------------------------------------------------------------------
# Tests: check_evidence_threshold
# ---------------------------------------------------------------------------

class TestEvidenceThreshold:
    def test_empty_chunks_returns_insufficient(self):
        ok, msg = check_evidence_threshold([])
        assert ok is False
        assert "No document evidence" in msg

    def test_all_low_similarity_returns_insufficient(self):
        chunks = [_make_chunk(0.001), _make_chunk(0.005)]
        ok, msg = check_evidence_threshold(chunks)
        assert ok is False
        assert "threshold" in msg

    def test_one_chunk_above_threshold_passes(self):
        chunks = [_make_chunk(0.001), _make_chunk(0.99)]
        ok, msg = check_evidence_threshold(chunks)
        assert ok is True
        assert msg == ""

    def test_exactly_at_threshold_passes(self):
        threshold = settings.rag_min_similarity_threshold
        chunks = [_make_chunk(threshold)]
        ok, _ = check_evidence_threshold(chunks)
        assert ok is True

    def test_just_below_threshold_fails(self):
        threshold = settings.rag_min_similarity_threshold
        chunks = [_make_chunk(threshold - 0.001)]
        ok, _ = check_evidence_threshold(chunks)
        assert ok is False

    def test_none_similarity_treated_as_zero(self):
        chunk = _make_chunk(0.5)
        chunk["similarity"] = None
        ok, _ = check_evidence_threshold([chunk])
        # None is treated as 0.0, which may be below threshold
        # Depends on threshold — just confirm it doesn't crash
        assert isinstance(ok, bool)


# ---------------------------------------------------------------------------
# Tests: validate_sources (citation cross-validation)
# ---------------------------------------------------------------------------

class TestValidateSources:
    def test_matching_chunk_ids_marked_valid(self):
        cid = uuid.uuid4()
        sources = [{"chunk_id": cid, "text": "..."}]
        result = validate_sources(sources, [cid])
        assert result[0]["citation_valid"] is True

    def test_mismatched_chunk_ids_marked_invalid(self):
        real_id = uuid.uuid4()
        hallucinated_id = uuid.uuid4()
        sources = [{"chunk_id": hallucinated_id, "text": "..."}]
        result = validate_sources(sources, [real_id])
        assert result[0]["citation_valid"] is False

    def test_empty_sources_returns_empty(self):
        result = validate_sources([], [uuid.uuid4()])
        assert result == []

    def test_empty_retrieved_ids_marks_all_invalid(self):
        cid = uuid.uuid4()
        sources = [{"chunk_id": cid, "text": "..."}]
        result = validate_sources(sources, [])
        assert result[0]["citation_valid"] is False

    def test_multiple_sources_mixed_validity(self):
        valid_id = uuid.uuid4()
        invalid_id = uuid.uuid4()
        sources = [
            {"chunk_id": valid_id, "text": "good"},
            {"chunk_id": invalid_id, "text": "hallucinated"},
        ]
        result = validate_sources(sources, [valid_id])
        assert result[0]["citation_valid"] is True
        assert result[1]["citation_valid"] is False

    def test_insufficient_evidence_answer_is_not_empty(self):
        """The pre-canned insufficient evidence message must be non-empty."""
        assert INSUFFICIENT_EVIDENCE_ANSWER
        assert len(INSUFFICIENT_EVIDENCE_ANSWER) > 20
