"""
Retrieval routes (Phase 4A: vector search only -- no reranking, no LLM).
Kept thin -- validation and orchestration live in app/services/retrieval_service.py.
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
        results = retrieval_service.search(db, request.query, request.top_k)
    except RetrievalError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return {"query": request.query, "results": results}
