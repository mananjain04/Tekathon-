"""
Retrieval routes.
Phase 4A: vector search. Phase 4B: optional cross-encoder re-ranking.
Phase 1 (Auth): JWT required. Phase 2 (RBAC): VIEWER minimum.
Kept thin -- validation and orchestration live in app/services/retrieval_service.py.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.user_models import User, UserRole
from app.models.retrieval import SearchRequest, SearchResponse
from app.services import auth_service, retrieval_service
from app.services.permissions import require_role
from app.services.retrieval_service import RetrievalError

router = APIRouter(prefix="/api/retrieval", tags=["retrieval"])


@router.post("/search", response_model=SearchResponse)
def search(
    request: SearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_user),
):
    require_role(current_user, UserRole.VIEWER)
    try:
        results = retrieval_service.search_with_rerank(db, request.query, request.top_k, rerank=request.rerank)
    except RetrievalError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return {"query": request.query, "reranked": request.rerank, "results": results}
