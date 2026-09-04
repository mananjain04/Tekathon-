"""
Pydantic (API) schemas for retrieval (Phase 4A: vector search only).
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


class SearchResult(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    page_id: Optional[uuid.UUID] = None
    page_number: int
    chunk_index: int
    text: str
    similarity: float
    distance: float


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
