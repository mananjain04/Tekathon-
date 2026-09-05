"""
Phase 4B: local cross-encoder re-ranking.

Takes the (query, chunk_text) pairs for chunks that Phase 4A's pgvector
cosine search (app/services/retrieval_service.py::search) has already
retrieved, and re-scores/re-sorts them with a local, offline cross-encoder
model (default: cross-encoder/ms-marco-MiniLM-L-6-v2) via
sentence-transformers' CrossEncoder wrapper.

This module is a pure re-ranking step over an EXISTING candidate set:
- It never fetches candidates itself (that's retrieval_service.search()).
- It never talks to an external API (OpenAI/Groq/hosted inference) --
  the only "network" cost is the one-time Hugging Face model download,
  exactly like embedding_service.py.
- It never replaces or duplicates the pgvector search.

Mirrors the structure/conventions of embedding_service.py deliberately
(same _load_*/_resolve_device/singleton pattern) so the two local model
wrappers stay consistent and easy to reason about together.
"""
import os
import threading
from typing import Dict, List, Optional

from app.core.config import settings
from app.services.embedding_service import _resolve_device


class RerankerModelError(Exception):
    """The local cross-encoder model could not be loaded, or failed to score a batch."""


def _load_cross_encoder(model_name: str, device: str, cache_folder: Optional[str]):
    """
    Thin wrapper around the sentence-transformers CrossEncoder import +
    constructor call. Kept as a single, separate seam (same pattern as
    embedding_service._load_sentence_transformer) so tests can monkeypatch
    this one function with a fake model to simulate load failures, without
    mocking the whole sentence-transformers/torch stack.
    """
    from sentence_transformers import CrossEncoder  # imported lazily: heavy, optional at import time

    kwargs = {"device": device, "max_length": 512}
    if cache_folder:
        # CrossEncoder doesn't take a top-level cache_folder kwarg (unlike
        # SentenceTransformer) -- it's threaded through to the underlying
        # HF model/tokenizer loaders instead.
        kwargs["automodel_args"] = {"cache_dir": cache_folder}
        kwargs["tokenizer_args"] = {"cache_dir": cache_folder}
    return CrossEncoder(model_name, **kwargs)


class RerankerService:
    """
    Local cross-encoder re-ranking for a single configured model.

    score() / rerank() are the only two operations. rerank() is the one
    retrieval_service.py calls: given the query and the list of chunk
    dicts that Phase 4A's search() already produced, it returns a NEW
    list (originals untouched), sorted most-relevant-first, each with an
    added "rerank_score" key -- every other key (chunk_id, document_id,
    page_id, page_number, chunk_index, text, similarity, distance) is
    preserved exactly as retrieval_service.search() produced it.
    """

    def __init__(
        self,
        model_name: Optional[str] = None,
        device: Optional[str] = None,
        batch_size: Optional[int] = None,
        cache_folder: Optional[str] = None,
    ):
        self.model_name = model_name or settings.reranker_model_name
        self.device = _resolve_device(device if device is not None else settings.reranker_device)
        self.batch_size = batch_size or settings.reranker_batch_size
        self.cache_folder = cache_folder if cache_folder is not None else settings.reranker_cache_dir
        self._model = None  # loaded lazily on first score() call, then reused

    def _get_model(self):
        if self._model is None:
            if settings.reranker_offline_mode:
                # Same offline guarantee as embedding_service.py: prevents
                # sentence-transformers/huggingface_hub from making any
                # network call (even a quick "check for updates" one) once
                # the model is already cached locally.
                os.environ.setdefault("HF_HUB_OFFLINE", "1")
                os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
            try:
                self._model = _load_cross_encoder(self.model_name, self.device, self.cache_folder)
            except Exception as exc:  # noqa: BLE001 -- many possible failure types, one clear message
                raise RerankerModelError(
                    f"Failed to load local cross-encoder model '{self.model_name}' (device={self.device}). "
                    "If this is the first run on this machine, the model needs to download from Hugging "
                    "Face once (requires internet the first time only) -- see backend/docs/PHASE4.md. "
                    f"Original error: {exc}"
                ) from exc
        return self._model

    def score(self, query: str, texts: List[str]) -> List[float]:
        """
        Scores each (query, text) pair with the cross-encoder. Returns a
        plain list[float] of relevance scores, in the same order as
        `texts`. Returns [] immediately for an empty `texts` list (no
        model load triggered). Raises RerankerModelError if the model
        fails to load or the underlying predict() call raises.
        """
        if not texts:
            return []

        model = self._get_model()
        pairs = [(query, text) for text in texts]
        try:
            raw_scores = model.predict(pairs, batch_size=self.batch_size, show_progress_bar=False)
        except Exception as exc:  # noqa: BLE001 -- one clear, wrapped error for any predict() failure
            raise RerankerModelError(f"Cross-encoder scoring failed: {exc}") from exc

        return [float(s) for s in raw_scores]

    def rerank(self, query: str, chunks: List[Dict]) -> List[Dict]:
        """
        Re-ranks `chunks` (as returned by retrieval_service.search(): each
        a dict with at least a "text" key) against `query`, using this
        cross-encoder. Returns [] unchanged for an empty input list (no
        model load, no error -- there's nothing to rank). Otherwise
        returns a NEW list of shallow-copied dicts, sorted by descending
        "rerank_score", with every original key preserved untouched.

        Raises RerankerModelError for an empty/whitespace query or any
        model load/scoring failure.
        """
        if not chunks:
            return []

        if query is None or not query.strip():
            raise RerankerModelError("Query must not be empty for re-ranking.")

        texts = [chunk["text"] for chunk in chunks]
        scores = self.score(query.strip(), texts)

        reranked = []
        for chunk, score in zip(chunks, scores):
            reranked_chunk = dict(chunk)  # shallow copy: never mutate the caller's dicts
            reranked_chunk["rerank_score"] = score
            reranked.append(reranked_chunk)

        reranked.sort(key=lambda c: c["rerank_score"], reverse=True)
        return reranked


_default_service: Optional[RerankerService] = None
_default_service_lock = threading.Lock()


def get_reranker_service() -> RerankerService:
    """Process-wide singleton so the cross-encoder is loaded once and shared by every caller."""
    global _default_service
    if _default_service is None:
        with _default_service_lock:
            if _default_service is None:
                _default_service = RerankerService()
    return _default_service


def reset_reranker_service() -> None:
    """Test helper: clears the cached singleton so a fresh one is built next time."""
    global _default_service
    with _default_service_lock:
        _default_service = None
