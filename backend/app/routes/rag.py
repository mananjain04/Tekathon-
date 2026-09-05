"""
RAG routes (Phase 5A). Kept thin -- retrieval, re-ranking, context
building, prompt assembly, and LLM invocation all live in
app/services/rag_service.py (and the services it calls in turn). This
router only translates HTTP <-> RAGError; no LLM logic lives here.

    route -> rag_service -> retrieval_service -> reranker_service -> llm_service
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.rag import RAGQueryRequest, RAGQueryResponse
from app.services import rag_service
from app.services.rag_service import RAGError

router = APIRouter(prefix="/api/rag", tags=["rag"])


@router.post("/query", response_model=RAGQueryResponse)
def query(request: RAGQueryRequest, db: Session = Depends(get_db)):
    """
    Runs the full RAG pipeline (retrieval -> re-ranking -> context ->
    local LLM) for one question. Returns 400 for any diagnosed failure --
    an empty/whitespace query, a retrieval/re-ranking failure, or the
    local LLM being unavailable/misconfigured (e.g. LLM_MODEL_PATH not
    set, or the configured GGUF file missing) -- with a clear message and
    no fabricated answer. Mirrors the existing retrieval route's
    RetrievalError -> 400 convention (app/routes/retrieval.py) for
    consistency across the API.
    """
    try:
        result = rag_service.answer_query(db, request.query, request.top_k)
    except RAGError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return result
