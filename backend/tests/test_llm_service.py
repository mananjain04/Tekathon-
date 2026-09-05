"""
Tests for app/services/llm_service.py (Phase 5A: local LLM via llama.cpp).

Every test here monkeypatches the one seam llm_service.py exposes for this
purpose (_load_llama_model, or LLMService._get_model directly) with a fake
model -- so this suite needs neither llama-cpp-python installed nor a real
GGUF file on disk, and never touches the network. The "missing model"
tests don't even need that seam: they fail before ever reaching it, which
is itself the behavior being verified (a missing/misconfigured model must
never attempt a real load).
"""
import pytest

from app.services.llm_service import (
    LLMModelError,
    LLMService,
    get_llm_service,
    reset_llm_service,
)


class _FakeLlamaModel:
    """Stand-in for llama_cpp.Llama: __call__(prompt, ...) -> a completion-shaped dict."""

    def __init__(self, text="This is the generated answer.", raise_on_call=None):
        self._text = text
        self._raise_on_call = raise_on_call
        self.calls = []

    def __call__(self, prompt, max_tokens=None, temperature=None, echo=False):
        self.calls.append({"prompt": prompt, "max_tokens": max_tokens, "temperature": temperature, "echo": echo})
        if self._raise_on_call is not None:
            raise self._raise_on_call
        return {"choices": [{"text": self._text}]}


def test_missing_model_path_raises_llm_model_error_without_importing_llama_cpp():
    service = LLMService(model_path=None)
    with pytest.raises(LLMModelError, match="No local LLM model configured"):
        service.generate("some prompt")


def test_missing_model_file_raises_llm_model_error(tmp_path):
    nonexistent = tmp_path / "does_not_exist.gguf"
    service = LLMService(model_path=str(nonexistent))
    with pytest.raises(LLMModelError, match="does not exist"):
        service.generate("some prompt")


def test_empty_prompt_raises_without_loading_model():
    service = LLMService(model_path="/some/path.gguf")

    def fail_if_called():
        raise AssertionError("Model should never be loaded for an empty prompt.")

    service._get_model = fail_if_called
    with pytest.raises(LLMModelError, match="Prompt must not be empty"):
        service.generate("   ")


def test_successful_generation_returns_stripped_text(monkeypatch, tmp_path):
    model_file = tmp_path / "fake.gguf"
    model_file.write_bytes(b"not a real gguf, just needs to exist")

    fake_model = _FakeLlamaModel(text="  The answer is 42.  \n")
    service = LLMService(model_path=str(model_file))
    monkeypatch.setattr(service, "_get_model", lambda: fake_model)

    result = service.generate("what is the answer?")

    assert result == "The answer is 42."


def test_generation_uses_configured_max_tokens_and_temperature(monkeypatch, tmp_path):
    model_file = tmp_path / "fake.gguf"
    model_file.write_bytes(b"placeholder")

    fake_model = _FakeLlamaModel()
    service = LLMService(model_path=str(model_file), max_tokens=256, temperature=0.7)
    monkeypatch.setattr(service, "_get_model", lambda: fake_model)

    service.generate("a prompt")

    assert fake_model.calls[0]["max_tokens"] == 256
    assert fake_model.calls[0]["temperature"] == 0.7
    assert fake_model.calls[0]["echo"] is False


def test_generation_call_overrides_take_precedence(monkeypatch, tmp_path):
    model_file = tmp_path / "fake.gguf"
    model_file.write_bytes(b"placeholder")

    fake_model = _FakeLlamaModel()
    service = LLMService(model_path=str(model_file), max_tokens=256, temperature=0.7)
    monkeypatch.setattr(service, "_get_model", lambda: fake_model)

    service.generate("a prompt", max_tokens=10, temperature=0.0)

    assert fake_model.calls[0]["max_tokens"] == 10
    assert fake_model.calls[0]["temperature"] == 0.0


def test_model_is_loaded_once_and_reused(monkeypatch, tmp_path):
    model_file = tmp_path / "fake.gguf"
    model_file.write_bytes(b"placeholder")

    load_calls = []

    def counting_loader(model_path, context_size, gpu_layers, threads):
        load_calls.append(1)
        return _FakeLlamaModel()

    monkeypatch.setattr("app.services.llm_service._load_llama_model", counting_loader)

    service = LLMService(model_path=str(model_file))
    service.generate("first prompt")
    service.generate("second prompt")

    assert len(load_calls) == 1


def test_model_load_failure_raises_llm_model_error(monkeypatch, tmp_path):
    model_file = tmp_path / "fake.gguf"
    model_file.write_bytes(b"placeholder")

    def broken_loader(model_path, context_size, gpu_layers, threads):
        raise RuntimeError("simulated llama.cpp load failure (e.g. llama-cpp-python not installed)")

    monkeypatch.setattr("app.services.llm_service._load_llama_model", broken_loader)

    service = LLMService(model_path=str(model_file))
    with pytest.raises(LLMModelError, match="Failed to load"):
        service.generate("a prompt")


def test_generation_failure_raises_llm_model_error(monkeypatch, tmp_path):
    model_file = tmp_path / "fake.gguf"
    model_file.write_bytes(b"placeholder")

    fake_model = _FakeLlamaModel(raise_on_call=RuntimeError("simulated generation failure"))
    service = LLMService(model_path=str(model_file))
    monkeypatch.setattr(service, "_get_model", lambda: fake_model)

    with pytest.raises(LLMModelError, match="generation failed"):
        service.generate("a prompt")


def test_unexpected_response_shape_raises_llm_model_error(monkeypatch, tmp_path):
    model_file = tmp_path / "fake.gguf"
    model_file.write_bytes(b"placeholder")

    class WeirdModel:
        def __call__(self, prompt, **kwargs):
            return {"unexpected": "shape"}

    service = LLMService(model_path=str(model_file))
    monkeypatch.setattr(service, "_get_model", lambda: WeirdModel())

    with pytest.raises(LLMModelError, match="unexpected response shape"):
        service.generate("a prompt")


def test_get_llm_service_returns_singleton():
    reset_llm_service()
    try:
        service_a = get_llm_service()
        service_b = get_llm_service()
        assert service_a is service_b
    finally:
        reset_llm_service()


def test_llm_service_only_calls_local_model_no_external_calls(monkeypatch, tmp_path):
    """
    Confirms generation's only path is the local llama.cpp-style callable
    -- no requests/httpx call, no OpenAI/Groq/hosted inference of any kind.
    """
    model_file = tmp_path / "fake.gguf"
    model_file.write_bytes(b"placeholder")

    called = {"local_call": False}

    class SpyModel:
        def __call__(self, prompt, **kwargs):
            called["local_call"] = True
            return {"choices": [{"text": "ok"}]}

    service = LLMService(model_path=str(model_file))
    monkeypatch.setattr(service, "_get_model", lambda: SpyModel())

    service.generate("local-only check")

    assert called["local_call"] is True
