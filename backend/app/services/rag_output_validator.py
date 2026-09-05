"""
app/services/rag_output_validator.py — Phase 4: RAG output validation.

Validates the retrieval result BEFORE the LLM is called and validates
the sources AFTER the LLM answers, without touching rag_service.py logic.

Controls:
1. Similarity threshold gate — if all retrieved chunks are below the
   minimum similarity, return an "insufficient evidence" response
   immediately and never call the LLM.
2. Citation cross-validator — after the LLM answers, verify every source
   dict in the response actually came from the retrieved set (by chunk_id).
   Flag any mismatches rather than silently returning hallucinated sources.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple
from uuid import UUID

from app.core.config import settings


def check_evidence_threshold(chunks: List[Dict]) -> Tuple[bool, str]:
    """
    Returns (has_sufficient_evidence, reason_message).

    Insufficient evidence conditions:
    - No chunks at all.
    - All chunk similarity scores below settings.rag_min_similarity_threshold.
    """
    if not chunks:
        return False, "No document evidence was retrieved for this query."

    threshold = settings.rag_min_similarity_threshold
    best_similarity = max(
        (c.get("similarity") or 0.0) for c in chunks
    )
    if best_similarity < threshold:
        return (
            False,
            f"Retrieved evidence similarity ({best_similarity:.3f}) is below the "
            f"minimum threshold ({threshold}). Cannot provide a grounded answer.",
        )

    return True, ""


INSUFFICIENT_EVIDENCE_ANSWER = (
    "I cannot answer this question from the available documents. "
    "No sufficiently relevant evidence was found in the knowledge base."
)


def validate_sources(
    returned_sources: List[Dict],
    retrieved_chunk_ids: List[UUID],
) -> List[Dict]:
    """
    Cross-check every source in `returned_sources` against the set of
    chunk UUIDs actually retrieved in this request.

    Returns the same list with an added `"citation_valid"` boolean field:
    - True  → chunk_id was in the retrieved set (grounded).
    - False → chunk_id was NOT in the retrieved set (potential hallucination).

    This never removes sources — it annotates them so the caller/API can
    surface the warning to clients or log it.
    """
    valid_ids = {str(cid) for cid in retrieved_chunk_ids}
    for source in returned_sources:
        chunk_id = str(source.get("chunk_id", ""))
        source["citation_valid"] = chunk_id in valid_ids
    return returned_sources
