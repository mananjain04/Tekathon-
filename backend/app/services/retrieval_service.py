"""
Phase 4A: vector-only retrieval. Phase 4B: optional cross-encoder re-ranking.

search() (Phase 4A, UNCHANGED by Phase 4B): embeds a user query with the
exact same local EmbeddingService used in Phase 3 (no second embedding
implementation, no external API), then finds the top-K nearest chunks in
PostgreSQL via pgvector cosine distance -- using the existing
ix_chunks_embedding_hnsw HNSW index from the Phase 1 migration. No new
table, no new index.

search_with_rerank() (Phase 4B, new): calls search() unchanged to get the
same vector-ranked candidates, then -- if requested and there are any
results -- hands them to the local cross-encoder reranker
(app/services/reranker_service.py) to re-sort them and attach
`rerank_score`. It never fetches candidates itself and never bypasses
pgvector retrieval; it's a purely additive layer on top of search().

Deliberately stops here: no RAG prompt construction, no LLM call. Callers
get raw ranked chunks with enough metadata (document_id,
page_id/page_number, chunk_index, text) for later citation generation.
"""
import uuid
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Chunk, Document, DocumentStatus
from app.services import reranker_service
from app.services.embedding_service import EmbeddingModelError, get_embedding_service
from app.services.reranker_service import RerankerModelError


class RetrievalError(Exception):
    """A clearly-diagnosed retrieval failure (empty query, invalid top_k, embedding
    failure, or -- for search_with_rerank() -- a cross-encoder load/scoring failure).
    """


def _validate_top_k(top_k: int) -> None:
    if top_k < 1 or top_k > settings.retrieval_top_k_max:
        raise RetrievalError(f"top_k must be between 1 and {settings.retrieval_top_k_max} (got {top_k}).")


def search(
    db: Session,
    query: str,
    top_k: Optional[int] = None,
    document_id: Optional[uuid.UUID] = None,
) -> List[Dict]:
    """
    Returns a list of dicts, ranked most-similar-first, each with:
    chunk_id, document_id, page_id, page_number, chunk_index, text,
    similarity (1 - cosine_distance; 1.0 = identical, -1.0 = opposite),
    and distance (the raw cosine distance, kept for debugging).

    Only considers chunks with a non-null embedding belonging to a
    document whose status is INDEXED. If document_id is specified, filters
    results strictly to that document.
    """
    if query is None or not query.strip():
        raise RetrievalError("Query must not be empty.")

    if top_k is None:
        top_k = settings.retrieval_top_k_default
    _validate_top_k(top_k)

    try:
        query_vector = get_embedding_service().embed_text(query.strip())
    except EmbeddingModelError as exc:
        raise RetrievalError(f"Query embedding failed: {exc}") from exc

    distance_col = Chunk.embedding.cosine_distance(query_vector).label("distance")
    stmt = (
        select(Chunk, distance_col)
        .join(Document, Chunk.document_id == Document.id)
        .where(Chunk.embedding.is_not(None))
        .where(Document.status == DocumentStatus.INDEXED)
    )
    if document_id is not None:
        stmt = stmt.where(Chunk.document_id == document_id)

    stmt = stmt.order_by(distance_col.asc()).limit(top_k)

    rows = db.execute(stmt).all()

    results: List[Dict] = []
    for chunk, distance in rows:
        distance = float(distance)
        results.append(
            {
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "page_id": chunk.page_id,
                "page_number": chunk.page_number,
                "chunk_index": chunk.chunk_index,
                "text": chunk.text,
                "similarity": 1.0 - distance,
                "distance": distance,
            }
        )
    return results


def search_with_rerank(
    db: Session,
    query: str,
    top_k: Optional[int] = None,
    rerank: bool = True,
    document_id: Optional[uuid.UUID] = None,
) -> List[Dict]:
    """
    Phase 4B orchestration layer: runs search() with optional document_id filter,
    then passes candidates through local cross-encoder reranker if rerank=True.
    """
    results = search(db, query, top_k, document_id=document_id)

    if not rerank or not results:
        for result in results:
            result["rerank_score"] = None
        return results

    try:
        return reranker_service.get_reranker_service().rerank(query, results)
    except RerankerModelError as exc:
        raise RetrievalError(f"Re-ranking failed: {exc}") from exc
