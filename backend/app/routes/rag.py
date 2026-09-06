"""
RAG routes (Phase 5A). Kept thin -- retrieval, re-ranking, context
building, prompt assembly, and LLM invocation all live in
app/services/rag_service.py (and the services it calls in turn). This
router only translates HTTP <-> RAGError; no LLM logic lives here.

Phase 1 (Auth): JWT required on /api/rag/query.
Phase 2 (RBAC): VIEWER minimum (read-only query).
Phase 4 (Output Validation): similarity threshold gate + citation validation.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.user_models import User, UserRole
from app.models.rag import RAGQueryRequest, RAGQueryResponse
from app.services import auth_service, rag_service
from app.services.permissions import require_role
from app.services.rag_output_validator import (
    INSUFFICIENT_EVIDENCE_ANSWER,
    check_evidence_threshold,
    validate_sources,
)
from app.services.rag_service import RAGError
from app.services.retrieval_service import RetrievalError, search_with_rerank

router = APIRouter(prefix="/api/rag", tags=["rag"])


@router.post("/query", response_model=RAGQueryResponse)
def query(
    request: RAGQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_user),
):
    """
    Runs the full RAG pipeline (retrieval -> re-ranking -> context ->
    local LLM) for one question.

    Phase 4 additions:
    - Pre-LLM: similarity threshold gate. If no chunk is above the minimum
      similarity, returns "insufficient evidence" without calling the LLM.
    - Post-LLM: citation cross-validation annotates each source with
      citation_valid=True/False.
    """
    # Phase 2: VIEWER minimum — querying is the least-privileged operation.
    require_role(current_user, UserRole.VIEWER)

    # Retrieve + re-rank exactly ONCE for this request. The same
    # `ranked_chunks` snapshot is used for the pre-LLM similarity
    # threshold gate below, for building the LLM's context (inside
    # rag_service.answer_query), and for the post-LLM citation
    # cross-validation -- avoiding the double retrieval/re-ranking that
    # used to happen here (one call here + a second internal call inside
    # answer_query), which risked the context/citation check being built
    # from a different chunk set than the threshold check saw.
    try:
        ranked_chunks = search_with_rerank(db, request.query, top_k=request.top_k, rerank=True)
    except RetrievalError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    sufficient, reason = check_evidence_threshold(ranked_chunks)
    if not sufficient:
        return RAGQueryResponse(
            query=request.query,
            answer=INSUFFICIENT_EVIDENCE_ANSWER,
            sources=[],
        )

    # Run the rest of the RAG pipeline (context -> prompt -> LLM) against
    # this exact same ranked_chunks snapshot -- rag_service.answer_query()
    # does NOT retrieve again when given ranked_chunks explicitly.
    try:
        result = rag_service.answer_query(db, request.query, request.top_k, ranked_chunks=ranked_chunks)
    except RAGError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    # Phase 4 (post-LLM): cross-validate citations against the SAME
    # retrieved chunk IDs the context was built from.
    retrieved_ids = [c["chunk_id"] for c in ranked_chunks]
    validated_sources = validate_sources(result.get("sources", []), retrieved_ids)

    return RAGQueryResponse(
        query=result["query"],
        answer=result["answer"],
        sources=validated_sources,
    )
