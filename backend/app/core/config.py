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

from app.core.url_security import OllamaURLSecurityError, validate_ollama_base_url


# Known placeholder/weak values that must never be accepted as a real JWT
# signing secret. Checked case-insensitively. This list exists solely to
# catch the specific known-committed placeholder (and other common
# footguns) -- it is NOT a substitute for the length/entropy checks below.
_KNOWN_WEAK_JWT_SECRETS = {
    "change_me_generate_with_secrets_token_hex_32",
    "changeme",
    "change_me",
    "secret",
    "supersecret",
    "password",
    "your-secret-key",
    "your_secret_key",
    "jwt_secret",
    "jwtsecret",
    "test",
    "testing",
    "example",
    "development",
    "dev-secret",
    "dev_secret",
    "insecure",
    "12345678",
    "00000000000000000000000000000000",
}

_MIN_JWT_SECRET_LENGTH = 32  # matches the length of secrets.token_hex(16); the
# documented generation command (token_hex(32)) produces 64 hex characters.
_MIN_JWT_SECRET_DISTINCT_CHARS = 8  # rejects low-entropy strings like "aaaa...aaa"
# that are technically long enough but not plausibly randomly generated.


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
    # SECURE DEFAULT: True. Guarantees sentence-transformers/huggingface_hub
    # make zero network calls (including a quick "check for updates") during
    # normal runtime -- KAVACH must not silently phone home. To intentionally
    # warm the local model cache on a fresh machine (a deliberate, one-time
    # setup step, not normal runtime), temporarily set
    # EMBEDDING_OFFLINE_MODE=false in .env, run once, then set it back to
    # true (or just remove the override -- true is the default).
    embedding_offline_mode: bool = True

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
    # SECURE DEFAULT: True. Same guarantee and same intentional-override
    # mechanism as embedding_offline_mode above (RERANKER_OFFLINE_MODE=false
    # for a one-time cache-warming step only) -- independent setting since
    # the two models can be cached/verified at different times.
    reranker_offline_mode: bool = True

    # --- Retrieval (Phase 4A: pgvector search; Phase 4B: optional
    # cross-encoder re-ranking of the same candidates) ---
    retrieval_top_k_default: int = 10
    retrieval_top_k_max: int = 100

    # --- Local LLM provider selection ---
    # Supported values: "llama_cpp" (GGUF via llama-cpp-python) or "ollama"
    # (local Ollama server -- recommended for Windows, no compilation needed).
    # See backend/docs/PHASE5.md (llama_cpp) or backend/docs/OLLAMA.md (ollama).
    llm_provider: str = "ollama"

    # --- llama.cpp / GGUF provider (llm_provider = "llama_cpp") ---
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

    # --- Security / Authentication (Phase 1) ---
    # REQUIRED. No default is provided on purpose: the app must fail to start
    # rather than silently sign tokens with a known/guessable secret. Set it
    # in backend/.env (git-ignored, never committed):
    #   python -c "import secrets; print(secrets.token_hex(32))"
    jwt_secret_key: str
    jwt_access_token_expire_minutes: int = 60

    # --- RAG Output Validation (Phase 4) ---
    # Minimum cosine similarity (0.0–1.0) for retrieved chunks to be considered
    # sufficient evidence. Queries where all chunks score below this threshold
    # return an explicit "insufficient evidence" response without calling the LLM.
    rag_min_similarity_threshold: float = 0.1

    # --- Ollama provider (llm_provider = "ollama") ---
    # Base URL of the local Ollama server. Never set to an external/cloud URL --
    # KAVACH requires 100% local inference. After `ollama pull <model>`, this
    # operates entirely without Internet access.
    ollama_base_url: str = "http://localhost:11434"
    # Model tag to use for RAG generation. Must be pulled locally first via
    # `ollama pull <model>`. Defaults to "qwen2.5:latest" (standard tag when running
    # `ollama pull qwen2.5`). Can also be "qwen2.5:7b", "llama3.2:latest", etc.
    # Configurable via .env OLLAMA_MODEL.
    ollama_model: str = "qwen2.5:latest"
    # Seconds before an Ollama HTTP request is considered timed out.
    # Increase on slower hardware where model first-load takes longer.
    ollama_timeout: float = 120.0

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

    @field_validator("ollama_base_url")
    @classmethod
    def _validate_ollama_base_url_is_loopback(cls, value: str) -> str:
        """
        Fails closed at startup (not just on first LLM call) if
        OLLAMA_BASE_URL doesn't point at the local loopback interface --
        KAVACH must never be able to send a prompt (which may embed
        confidential retrieved document text) to a non-local address. See
        app/core/url_security.py for the exact rules. Never rewrites the
        URL -- only accepts it unchanged or raises.
        """
        try:
            validate_ollama_base_url(value)
        except OllamaURLSecurityError as exc:
            raise ValueError(str(exc)) from exc
        return value

    @field_validator("jwt_secret_key")
    @classmethod
    def _validate_jwt_secret_strength(cls, value: str) -> str:
        """
        Fails closed (raises, refusing to construct Settings -- and since
        `settings = get_settings()` runs at module-import time, this means
        the whole application refuses to start) if JWT_SECRET_KEY is:
          - empty/whitespace
          - a known placeholder/weak value (see _KNOWN_WEAK_JWT_SECRETS)
          - too short to plausibly be a real generated secret
          - too low in character variety to plausibly be a real generated
            secret (catches e.g. "aaaa...aaa" padding tricks)

        Never includes the actual secret value in any error message -- only
        its length (a non-sensitive fact) is ever reported.
        """
        if value is None or not value.strip():
            raise ValueError(
                "JWT_SECRET_KEY must be set. Generate one with: "
                'python -c "import secrets; print(secrets.token_hex(32))" '
                "and set it in backend/.env (never commit .env)."
            )

        normalized = value.strip()

        if normalized.lower() in _KNOWN_WEAK_JWT_SECRETS:
            raise ValueError(
                "JWT_SECRET_KEY is set to a known placeholder/weak value and must not be used. "
                "Generate a real secret with: "
                'python -c "import secrets; print(secrets.token_hex(32))" '
                "and set it in backend/.env (never commit .env)."
            )

        if len(normalized) < _MIN_JWT_SECRET_LENGTH:
            raise ValueError(
                f"JWT_SECRET_KEY is too short ({len(normalized)} characters; minimum is "
                f"{_MIN_JWT_SECRET_LENGTH}). Generate one with: "
                'python -c "import secrets; print(secrets.token_hex(32))"'
            )

        if len(set(normalized)) < _MIN_JWT_SECRET_DISTINCT_CHARS:
            raise ValueError(
                "JWT_SECRET_KEY does not look like a securely generated random secret "
                "(too little character variety). Generate one with: "
                'python -c "import secrets; print(secrets.token_hex(32))"'
            )

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
