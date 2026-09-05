"""
Central application configuration.

All values are read from environment variables (optionally via a local
.env file, which is git-ignored). Nothing sensitive is hardcoded here.
"""
from functools import lru_cache
from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url


class Settings(BaseSettings):
    # --- PostgreSQL ---
    postgres_user: str = "postgres"
    postgres_password: str = ""
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "sih_rag"

    # If set, this takes priority over the individual postgres_* fields.
    database_url: Optional[str] = None

    # --- Storage ---
    storage_dir: str = "storage"
    max_upload_size_mb: int = 50

    # --- Chunking (Phase 2) ---
    chunk_size: int = 800
    chunk_overlap: int = 150

    # --- PDF extraction / OCR (Phase 2) ---
    # Minimum characters of normal-extracted text a page must have before
    # it is considered "meaningful" (i.e. skips the OCR fallback).
    ocr_text_threshold: int = 20
    # DPI used when rendering a page to an image for OCR.
    ocr_render_dpi: int = 200
    # Optional path to the Tesseract executable (Windows usually needs this,
    # e.g. C:\\Program Files\\Tesseract-OCR\\tesseract.exe). Left unset,
    # pytesseract looks for "tesseract" on PATH.
    tesseract_cmd: Optional[str] = None

    # --- Embeddings (Phase 3) ---
    embedding_dim: int = 384
    embedding_model_name: str = "all-MiniLM-L6-v2"
    # "auto" picks CUDA if available, else CPU -- same code runs on this
    # laptop (CPU-only) and a teammate's GPU machine unmodified.
    embedding_device: str = "auto"
    embedding_batch_size: int = 32
    # Optional override for where sentence-transformers caches the
    # downloaded model. Left unset, it uses the HF default (~/.cache).
    embedding_cache_dir: Optional[str] = None
    # Set true before an offline demo (once the model is already cached)
    # to guarantee sentence-transformers/huggingface_hub make zero network
    # calls, including update checks.
    embedding_offline_mode: bool = False

    # --- Reranker (Phase 4B: cross-encoder re-ranking over Phase 4A's
    # vector-retrieved candidates) ---
    reranker_model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    # "auto" picks CUDA if available, else CPU -- same convention as
    # embedding_device above.
    reranker_device: str = "auto"
    reranker_batch_size: int = 16
    # Optional override for where sentence-transformers caches the
    # downloaded cross-encoder model. Left unset, it uses the HF default.
    reranker_cache_dir: Optional[str] = None
    # Set true before an offline demo (once the model is already cached)
    # to guarantee sentence-transformers/huggingface_hub make zero network
    # calls, including update checks. Independent of embedding_offline_mode
    # since the two models can be cached/verified at different times.
    reranker_offline_mode: bool = False

    # --- Retrieval (Phase 4A: pgvector search; Phase 4B: optional
    # cross-encoder re-ranking of the same candidates) ---
    retrieval_top_k_default: int = 10
    retrieval_top_k_max: int = 100

    # --- Local LLM (Phase 5A: llama.cpp / GGUF, fully offline) ---
    # "llama_cpp" is currently the only supported provider -- no cloud/hosted
    # provider is implemented, by design (see backend/docs/PHASE5.md).
    llm_provider: str = "llama_cpp"
    # Path to a local GGUF model file (e.g. Qwen3-4B-Instruct-2507, Q4_K_M
    # quantization). Left unset, llm_service.py raises a clear LLMModelError
    # on first use rather than crashing at startup -- the model is NEVER
    # downloaded automatically.
    llm_model_path: Optional[str] = None
    llm_context_size: int = 4096
    llm_max_tokens: int = 512
    llm_temperature: float = 0.2
    # Number of transformer layers to offload to GPU (llama.cpp n_gpu_layers).
    # 0 = CPU-only. Set higher (or -1 for "all layers") on a machine with a
    # capable GPU, e.g. the target RTX 4050 6GB. CPU fallback always remains
    # possible by leaving this at 0.
    llm_gpu_layers: int = 0
    # None lets llama.cpp pick a sensible default thread count.
    llm_threads: Optional[int] = None

    @field_validator("llm_threads", mode="before")
    @classmethod
    def _blank_llm_threads_is_none(cls, value):
        # An empty LLM_THREADS= line in .env (the natural way to leave an
        # optional setting unset, same as TESSERACT_CMD=/EMBEDDING_CACHE_DIR=
        # elsewhere in this file) would otherwise fail int-parsing, since
        # those other optional fields are all Optional[str] where "" is a
        # valid string. This is the one Optional[int] setting, so it needs
        # its own explicit "" -> None coercion.
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def sqlalchemy_url(self) -> URL:
        """
        Build the SQLAlchemy connection URL object.

        Uses sqlalchemy.engine.URL.create() rather than manual string
        concatenation so that special characters in the username/password
        (@, :, /, #, %, etc.) are percent-encoded correctly instead of
        breaking the URL. Uses the psycopg (v3) driver, which has proper
        Python 3.13 wheels (psycopg2-binary does not reliably ship 3.13
        wheels yet).
        """
        if self.database_url:
            # A fully user-supplied URL is parsed (not re-concatenated),
            # so any percent-encoded special characters are preserved.
            return make_url(self.database_url)
        return URL.create(
            drivername="postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )

    @property
    def sqlalchemy_database_url(self) -> str:
        """
        String form of the connection URL, for tools that need a plain
        string (e.g. Alembic's config.set_main_option). Password is kept
        intact (not masked) since this is only ever used server-side.
        """
        if self.database_url:
            return self.database_url
        return self.sqlalchemy_url.render_as_string(hide_password=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
