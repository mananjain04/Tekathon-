"""
Pydantic (API) schemas for retrieval.
Phase 4A: vector search only. Phase 4B adds optional cross-encoder
re-ranking of the same candidates (SearchRequest.rerank, plus the
additive SearchResult.rerank_score / SearchResponse.reranked fields).
Kept separate from the SQLAlchemy ORM models, same convention as
app/models/document.py.
"""
import uuid
from typing import List, Optional

from pydantic import BaseModel, Field

from app.core.config import settings


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="The user's search query.")
    top_k: int = Field(
        default_factory=lambda: settings.retrieval_top_k_default,
        ge=1,
        le=settings.retrieval_top_k_max,
        description="Number of top chunks to return.",
    )
    rerank: bool = Field(
        default=True,
        description=(
            "If true (default), Phase 4B re-ranks the vector-retrieved candidates "
            "with the local cross-encoder before returning them. Set false to get "
            "the raw Phase 4A pgvector-ranked results only (unchanged behavior)."
        ),
    )


class SearchResult(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    page_id: Optional[uuid.UUID] = None
    page_number: int
    chunk_index: int
    text: str
    similarity: float
    distance: float
    rerank_score: Optional[float] = Field(
        default=None,
        description=(
            "Cross-encoder relevance score (Phase 4B), higher = more relevant. "
            "None when rerank=false was requested."
        ),
    )


class SearchResponse(BaseModel):
    query: str
    reranked: bool = Field(
        description="Whether the results below were re-ranked by the Phase 4B cross-encoder."
    )
    results: List[SearchResult]
