"""
Pydantic (API) schemas for RAG (Phase 5A). Kept separate from the
SQLAlchemy ORM models, same convention as app/models/document.py and
app/models/retrieval.py.
"""
import uuid
from typing import List, Optional

from pydantic import BaseModel, Field

from app.core.config import settings


class RAGQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="The user's question.")
    top_k: int = Field(
        default_factory=lambda: settings.retrieval_top_k_default,
        ge=1,
        le=settings.retrieval_top_k_max,
        description="Number of evidence chunks to retrieve and re-rank before answering.",
    )


class RAGSource(BaseModel):
    """
    One evidence chunk the answer was (or could have been) grounded in.
    Deliberately contains no filesystem details (no storage_path) -- same
    convention as DocumentOut.
    """

    chunk_id: uuid.UUID
    document_id: uuid.UUID
    page_id: Optional[uuid.UUID] = None
    page_number: int
    chunk_index: int
    text: str
    similarity: Optional[float] = None
    distance: Optional[float] = None
    rerank_score: Optional[float] = None
    citation_valid: Optional[bool] = Field(
        default=None,
        description=(
            "Phase 4 post-LLM citation cross-validation: True if this source's chunk_id was "
            "actually part of the retrieved set the answer was grounded in, False if not "
            "(potential hallucination), None if validation wasn't run."
        ),
    )


class RAGQueryResponse(BaseModel):
    query: str
    answer: str
    sources: List[RAGSource]
