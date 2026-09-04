"""
Central application configuration.

All values are read from environment variables (optionally via a local
.env file, which is git-ignored). Nothing sensitive is hardcoded here.
"""
from functools import lru_cache
from typing import Optional

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

    # --- Reranker (used from Phase 6 onward) ---
    reranker_model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    # --- Retrieval (Phase 4A: vector search only, no reranking yet) ---
    retrieval_top_k_default: int = 10
    retrieval_top_k_max: int = 100

    # --- LLM provider (used from Phase 7/8 onward) ---
    llm_provider: str = "groq"
    groq_api_key: Optional[str] = None
    groq_model: str = "llama-3.3-70b-versatile"

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
