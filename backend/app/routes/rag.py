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

    # Phase 4 (pre-LLM): retrieve chunks to check similarity threshold.
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

    # Run the full RAG pipeline (rag_service re-runs retrieval internally;
    # we pass top_k to keep results consistent).
    try:
        result = rag_service.answer_query(db, request.query, request.top_k)
    except RAGError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    # Phase 4 (post-LLM): cross-validate citations against retrieved chunk IDs.
    retrieved_ids = [c["chunk_id"] for c in ranked_chunks]
    validated_sources = validate_sources(result.get("sources", []), retrieved_ids)

    return RAGQueryResponse(
        query=result["query"],
        answer=result["answer"],
        sources=validated_sources,
    )
