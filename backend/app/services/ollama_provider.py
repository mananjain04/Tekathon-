"""
Ollama LLM provider for KAVACH - local, offline generation via the Ollama HTTP API.

Implements the same .generate(prompt) -> str interface as LLMService
(app/services/llm_service.py) so rag_service.py and every existing test
that injects a fake ``llm=`` object require zero changes.

Security contract:
- Communicates ONLY with the local Ollama server (settings.ollama_base_url,
  default http://localhost:11434). Never connects to any external LLM API.
- The Ollama server itself must have been started locally by the operator
  and have the configured model pulled locally in advance.
- After `ollama pull <model>`, the full pipeline works without any Internet
  access -- verified by disabling the network interface.

Logging policy:
- Logs the provider name, model, and request URL at INFO level.
- Logs error messages on failure.
- NEVER logs prompt text or retrieved document chunks (confidential content).
"""
import logging
from typing import Optional

from app.core.config import settings
from app.services.llm_service import LLMModelError

logger = logging.getLogger(__name__)


class OllamaProvider:
    """
    Local LLM generation via the Ollama HTTP API (POST /api/generate).

    generate() is the only operation exposed to callers (rag_service.py):
    given a fully-assembled prompt (system instructions + document evidence +
    question -- see prompt_builder.py), it returns the raw generated answer
    text. This class knows nothing about documents, chunks, retrieval, or
    RAG -- it only calls the local Ollama server with whatever prompt it
    receives, exactly mirroring LLMService's responsibility boundary.

    Architecture target:
        FastAPI -> RAG Orchestrator -> Prompt Builder -> OllamaProvider
        -> local Ollama server -> local LLM -> answer text

    Never:
        OllamaProvider -> Groq / OpenAI / Anthropic / any external API
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        # Strip trailing slash so URL joins are always clean.
        self.base_url = (base_url if base_url is not None else settings.ollama_base_url).rstrip("/")
        self.model = model if model is not None else settings.ollama_model
        self.timeout = timeout if timeout is not None else settings.ollama_timeout

        logger.info(
            "OllamaProvider initialised: base_url=%s model=%s timeout=%.1fs",
            self.base_url,
            self.model,
            self.timeout,
        )

    def generate(
        self,
        prompt: str,
        *,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> str:
        """
        Sends the fully-assembled RAG prompt to the local Ollama server and
        returns the generated answer text, stripped of leading/trailing
        whitespace.

        Matches LLMService.generate()'s exact signature so any caller that
        already handles LLMModelError works without modification.

        Raises LLMModelError for:
        - an empty/whitespace prompt
        - Ollama server not reachable (connection refused, DNS failure)
        - request timeout
        - model not found (HTTP 404) -- pull it with `ollama pull <model>`
        - any non-200 HTTP response from Ollama
        - unexpected JSON response shape

        Never raises raw httpx errors to callers -- all are wrapped into
        LLMModelError so the error handling in rag_service.py / routes/rag.py
        remains unchanged.

        IMPORTANT: does NOT log the prompt contents -- prompts may contain
        confidential retrieved document text. Only the model name and URL
        are logged.
        """
        if prompt is None or not prompt.strip():
            raise LLMModelError("Prompt must not be empty.")

        import httpx  # lazy import: already in requirements.txt; imported at
        # call time (not module level) mirrors the pattern used in llm_service.py
        # and embedding_service.py for optional/heavy dependencies.

        url = f"{self.base_url}/api/generate"
        payload: dict = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,  # collect the complete response, never stream chunks
            "options": {},
        }
        if max_tokens is not None:
            payload["options"]["num_predict"] = max_tokens
        if temperature is not None:
            payload["options"]["temperature"] = temperature

        logger.info("Ollama generate request: model=%s url=%s", self.model, url)

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(url, json=payload)
        except httpx.ConnectError as exc:
            raise LLMModelError(
                f"Cannot connect to the local Ollama server at '{self.base_url}'. "
                "Ensure Ollama is running (`ollama serve`) and that OLLAMA_BASE_URL "
                "in .env matches the server address. "
                f"Original error: {exc}"
            ) from exc
        except httpx.TimeoutException as exc:
            raise LLMModelError(
                f"Ollama request timed out after {self.timeout:.0f}s "
                f"(model='{self.model}'). "
                "The model may be loading for the first time. "
                "Increase OLLAMA_TIMEOUT in .env if your hardware is slow. "
                f"Original error: {exc}"
            ) from exc
        except Exception as exc:  # noqa: BLE001 -- catch-all: one clear wrapped message
            raise LLMModelError(
                f"Ollama HTTP request failed unexpectedly: {exc}"
            ) from exc

        # --- HTTP-level error handling ---
        if response.status_code == 404:
            raise LLMModelError(
                f"Ollama model '{self.model}' was not found on the local server. "
                f"Pull it first: `ollama pull {self.model}`. "
                "After pulling, no Internet access is needed for generation."
            )

        if response.status_code != 200:
            # Truncate the body so we never surface confidential content in
            # error messages; only enough to diagnose HTTP-level issues.
            body_preview = response.text[:300] if response.text else "(empty body)"
            raise LLMModelError(
                f"Ollama returned HTTP {response.status_code} "
                f"(model='{self.model}'): {body_preview}"
            )

        # --- Response parsing ---
        try:
            data = response.json()
            answer = data["response"].strip()
        except (KeyError, ValueError, AttributeError) as exc:
            body_preview = response.text[:300] if response.text else "(empty body)"
            raise LLMModelError(
                f"Ollama returned an unexpected response shape "
                f"(model='{self.model}'): {body_preview}"
            ) from exc

        logger.info("Ollama generate OK: model=%s", self.model)
        return answer
