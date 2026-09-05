"""
Phase 5A: local, offline LLM generation via llama.cpp (GGUF models).

Wraps llama-cpp-python so the rest of the codebase never talks to
llama_cpp directly. Mirrors the lazy-load / singleton / clear-error
conventions of embedding_service.py and reranker_service.py:

- The actual llama_cpp import + Llama(...) constructor call is behind a
  single seam (_load_llama_model) so tests can monkeypatch it with a fake
  model -- neither llama-cpp-python nor a real GGUF file needs to be
  present to test this module's orchestration/error-handling logic.
- The model is loaded once per LLMService instance, lazily, on first
  generate() call, and reused after that.
- get_llm_service() returns a process-wide singleton, same convention as
  get_embedding_service()/get_reranker_service().

Strictly local/offline: no OpenAI, no Groq, no Gemini, no hosted
inference, no HTTP calls to any external service. The only external
dependency is the GGUF model file itself, which the user places locally
(see backend/docs/PHASE5.md for exactly where) -- it is never downloaded
automatically by this service, and the FastAPI app never fails to start
just because the model file is missing or llama-cpp-python isn't
installed: both failures surface only when generate() is actually called,
as a clear LLMModelError.
"""
import logging
import threading
from pathlib import Path

logger = logging.getLogger(__name__)
from typing import Optional

from app.core.config import settings


class LLMModelError(Exception):
    """
    The local LLM could not be loaded (missing/misconfigured model path,
    missing GGUF file, llama-cpp-python not installed, or an incompatible
    model file), or a generation call itself failed.
    """


def _load_llama_model(model_path: str, context_size: int, gpu_layers: int, threads: Optional[int]):
    """
    Thin wrapper around the llama_cpp import + Llama(...) constructor
    call. Kept as a single, separate function (same pattern as
    embedding_service._load_sentence_transformer /
    reranker_service._load_cross_encoder) so tests can monkeypatch this
    one seam with a fake model.
    """
    from llama_cpp import Llama  # imported lazily: optional/heavy, and may not even be
    # installed on a machine that never exercises Phase 5A (see requirements.txt note).

    kwargs = {
        "model_path": model_path,
        "n_ctx": context_size,
        "n_gpu_layers": gpu_layers,
        "verbose": False,
    }
    if threads is not None:
        kwargs["n_threads"] = threads
    return Llama(**kwargs)


class LLMService:
    """
    Local LLM generation for a single configured GGUF model.

    generate() is the only operation exposed to callers (rag_service.py):
    given a fully-assembled prompt (system instructions + document
    evidence + question -- see prompt_builder.py), it returns the raw
    generated answer text. This service knows nothing about documents,
    chunks, retrieval, or RAG -- it just runs a local GGUF model on
    whatever text it's given.
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        context_size: Optional[int] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        gpu_layers: Optional[int] = None,
        threads: Optional[int] = None,
    ):
        self.model_path = model_path if model_path is not None else settings.llm_model_path
        self.context_size = context_size or settings.llm_context_size
        self.max_tokens = max_tokens or settings.llm_max_tokens
        self.temperature = settings.llm_temperature if temperature is None else temperature
        self.gpu_layers = settings.llm_gpu_layers if gpu_layers is None else gpu_layers
        self.threads = threads if threads is not None else settings.llm_threads
        self._model = None  # loaded lazily on first generate() call, then reused

    def _get_model(self):
        if self._model is None:
            if not self.model_path:
                raise LLMModelError(
                    "No local LLM model configured. Set LLM_MODEL_PATH in .env to the path of a "
                    "local GGUF model file (e.g. a Qwen3-4B-Instruct-2507 Q4_K_M build). The model "
                    "is never downloaded automatically -- see backend/docs/PHASE5.md for exactly "
                    "where to place it."
                )

            model_file = Path(self.model_path)
            if not model_file.is_file():
                raise LLMModelError(
                    f"Configured LLM model file does not exist: '{self.model_path}'. Download a "
                    "GGUF model and place it at this path, or update LLM_MODEL_PATH in .env. See "
                    "backend/docs/PHASE5.md. This model is never downloaded automatically."
                )

            try:
                self._model = _load_llama_model(self.model_path, self.context_size, self.gpu_layers, self.threads)
            except Exception as exc:  # noqa: BLE001 -- many possible failure types (llama-cpp-python
                # not installed, corrupted GGUF, unsupported quantization, GPU offload failure,
                # out of memory, etc.), one clear wrapped message covers all of them.
                raise LLMModelError(
                    f"Failed to load local LLM model '{self.model_path}' "
                    f"(context_size={self.context_size}, gpu_layers={self.gpu_layers}). Confirm "
                    "llama-cpp-python is installed and the file is a valid GGUF model. "
                    f"Original error: {exc}"
                ) from exc
        return self._model

    def generate(
        self,
        prompt: str,
        *,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> str:
        """
        Runs the local model on an already-fully-built prompt and returns
        the generated answer text, stripped of leading/trailing
        whitespace.

        Raises LLMModelError for an empty/whitespace prompt, a missing/
        misconfigured model, or if the underlying llama.cpp call fails or
        returns an unexpected response shape. Never returns a fabricated
        answer -- a failure here is always a raised exception, for the
        caller (rag_service.py) to surface as a real application error.
        """
        if prompt is None or not prompt.strip():
            raise LLMModelError("Prompt must not be empty.")

        model = self._get_model()
        try:
            result = model(
                prompt,
                max_tokens=max_tokens if max_tokens is not None else self.max_tokens,
                temperature=temperature if temperature is not None else self.temperature,
                echo=False,
            )
        except Exception as exc:  # noqa: BLE001 -- one clear wrapped error for any generation failure
            raise LLMModelError(f"Local LLM generation failed: {exc}") from exc

        try:
            return result["choices"][0]["text"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMModelError(f"Local LLM returned an unexpected response shape: {result!r}") from exc


_default_service = None  # Can be LLMService or OllamaProvider depending on config.
_default_service_lock = threading.Lock()


def get_llm_service():
    """
    Provider factory: returns a process-wide singleton LLM provider.

    The concrete type depends on ``settings.llm_provider``:
    - ``"ollama"``     → OllamaProvider (local Ollama HTTP server, recommended)
    - ``"llama_cpp"``  → LLMService (local GGUF via llama-cpp-python)

    The returned object always exposes ``.generate(prompt) -> str`` and raises
    ``LLMModelError`` on failure -- callers (rag_service.py, tests) never need
    to know which concrete provider is in use.

    OllamaProvider is imported lazily inside this function (not at module top
    level) to avoid a circular import: ollama_provider.py imports LLMModelError
    from this file, and importing ollama_provider.py at module level here would
    make the two modules mutually recursive.
    """
    global _default_service
    if _default_service is None:
        with _default_service_lock:
            if _default_service is None:
                provider = settings.llm_provider.strip().lower()
                if provider == "ollama":
                    from app.services.ollama_provider import OllamaProvider  # lazy, see docstring
                    logger.info(
                        "LLM provider: Ollama (base_url=%s model=%s)",
                        settings.ollama_base_url,
                        settings.ollama_model,
                    )
                    _default_service = OllamaProvider()
                elif provider == "llama_cpp":
                    logger.info("LLM provider: llama.cpp (GGUF, model_path=%s)", settings.llm_model_path)
                    _default_service = LLMService()
                else:
                    raise LLMModelError(
                        f"Unknown LLM_PROVIDER '{settings.llm_provider}'. "
                        "Supported values: 'ollama', 'llama_cpp'. "
                        "Set LLM_PROVIDER in .env."
                    )
    return _default_service


def reset_llm_service() -> None:
    """Test helper: clears the cached singleton so a fresh one is built next time."""
    global _default_service
    with _default_service_lock:
        _default_service = None
