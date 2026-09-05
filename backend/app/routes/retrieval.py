"""
Retrieval routes.
Phase 4A: vector search. Phase 4B: optional cross-encoder re-ranking of
the same candidates (request.rerank, default true). No LLM / RAG / chat
in this router -- those are later phases.
Kept thin -- validation and orchestration live in app/services/retrieval_service.py
and app/services/reranker_service.py (routes -> service -> reranker).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.retrieval import SearchRequest, SearchResponse
from app.services import retrieval_service
from app.services.retrieval_service import RetrievalError

router = APIRouter(prefix="/api/retrieval", tags=["retrieval"])


@router.post("/search", response_model=SearchResponse)
def search(request: SearchRequest, db: Session = Depends(get_db)):
    try:
        results = retrieval_service.search_with_rerank(db, request.query, request.top_k, rerank=request.rerank)
    except RetrievalError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return {"query": request.query, "reranked": request.rerank, "results": results}
