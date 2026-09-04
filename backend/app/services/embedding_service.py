"""
Local, offline sentence-embedding generation for document chunks.

Wraps the sentence-transformers implementation of the configured local
model (default: all-MiniLM-L6-v2, 384 dimensions) so the rest of the
codebase never talks to sentence-transformers/torch directly. No network
calls are made here except the one-time Hugging Face download that
sentence-transformers performs the first time a given model name is used
on a machine -- after that it is served entirely from the local cache
(see backend/docs/PHASE3.md for offline-demo prep).

The model is loaded once per EmbeddingService instance (lazily, on first
use) and reused for every subsequent call -- never reloaded per chunk or
per request. `get_embedding_service()` returns a process-wide singleton
so the whole app shares one loaded model.
"""
import os
import threading
from typing import List, Optional

from app.core.config import settings


class EmbeddingModelError(Exception):
    """The local embedding model could not be loaded, or produced unexpected output."""


def _load_sentence_transformer(model_name: str, device: str, cache_folder: Optional[str]):
    """
    Thin wrapper around the sentence-transformers import + constructor call.
    Kept as a single, separate function (rather than inlined) so tests can
    monkeypatch this one seam to simulate load failures without needing to
    mock the whole sentence-transformers/torch stack.
    """
    from sentence_transformers import SentenceTransformer  # imported lazily: heavy, optional at import time

    return SentenceTransformer(model_name, device=device, cache_folder=cache_folder)


def _cuda_available() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:  # noqa: BLE001 -- torch missing/broken just means "no GPU available to us"
        return False


def _resolve_device(device: Optional[str]) -> str:
    """
    "auto" (the default) picks CUDA if a GPU is actually available, else
    CPU -- so this same code runs unmodified on a CPU-only laptop and on a
    teammate's GPU machine. An explicit "cpu" or "cuda" always wins.
    """
    normalized = (device or "auto").strip().lower()
    if normalized in ("cpu", "cuda"):
        return normalized
    return "cuda" if _cuda_available() else "cpu"


class EmbeddingService:
    """
    Local embedding generation for a single configured model.

    embed_text() / embed_texts() are the only two operations -- no
    retrieval, no similarity search (that's a later phase). Embeddings are
    L2-normalized (normalize_embeddings=True) so pgvector's cosine-distance
    HNSW index (vector_cosine_ops) behaves as intended.
    """

    def __init__(
        self,
        model_name: Optional[str] = None,
        device: Optional[str] = None,
        batch_size: Optional[int] = None,
        cache_folder: Optional[str] = None,
    ):
        self.model_name = model_name or settings.embedding_model_name
        self.device = _resolve_device(device if device is not None else settings.embedding_device)
        self.batch_size = batch_size or settings.embedding_batch_size
        self.cache_folder = cache_folder if cache_folder is not None else settings.embedding_cache_dir
        self._model = None  # loaded lazily on first embed_* call, then reused

    def _get_model(self):
        if self._model is None:
            if settings.embedding_offline_mode:
                # Prevents sentence-transformers/huggingface_hub from making
                # any network call (even a quick "check for updates" one) --
                # set this before an offline demo, once the model is cached.
                os.environ.setdefault("HF_HUB_OFFLINE", "1")
                os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
            try:
                self._model = _load_sentence_transformer(self.model_name, self.device, self.cache_folder)
            except Exception as exc:  # noqa: BLE001 -- many possible failure types, one clear message
                raise EmbeddingModelError(
                    f"Failed to load local embedding model '{self.model_name}' (device={self.device}). "
                    "If this is the first run on this machine, the model needs to download from Hugging "
                    "Face once (requires internet the first time only) -- see backend/docs/PHASE3.md. "
                    f"Original error: {exc}"
                ) from exc
        return self._model

    def embed_text(self, text: str) -> List[float]:
        return self.embed_texts([text])[0]

    def embed_texts(self, texts: List[str], batch_size: Optional[int] = None) -> List[List[float]]:
        """
        Batch-encodes a list of chunk texts into 384-dim (or whatever
        settings.embedding_dim is configured to) normalized float vectors,
        in the same order as the input. Raises ValueError for any
        empty/whitespace-only text (chunking never produces these in
        practice, but this is a clear guard rather than a silent garbage
        vector), and EmbeddingModelError if the model fails to load or
        produces vectors of the wrong dimension.
        """
        if not texts:
            return []

        for text in texts:
            if text is None or not text.strip():
                raise ValueError("Cannot embed empty or whitespace-only text.")

        model = self._get_model()
        vectors = model.encode(
            texts,
            batch_size=batch_size or self.batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

        result = [list(map(float, vector)) for vector in vectors]

        for vector in result:
            if len(vector) != settings.embedding_dim:
                raise EmbeddingModelError(
                    f"Embedding model '{self.model_name}' produced a {len(vector)}-dimensional vector, "
                    f"but settings.embedding_dim is {settings.embedding_dim} (must match the chunks.embedding "
                    "column). Check EMBEDDING_MODEL_NAME / EMBEDDING_DIM configuration."
                )

        return result


_default_service: Optional[EmbeddingService] = None
_default_service_lock = threading.Lock()


def get_embedding_service() -> EmbeddingService:
    """Process-wide singleton so the model is loaded once and shared by every caller."""
    global _default_service
    if _default_service is None:
        with _default_service_lock:
            if _default_service is None:
                _default_service = EmbeddingService()
    return _default_service


def reset_embedding_service() -> None:
    """Test helper: clears the cached singleton so a fresh one is built next time."""
    global _default_service
    with _default_service_lock:
        _default_service = None
