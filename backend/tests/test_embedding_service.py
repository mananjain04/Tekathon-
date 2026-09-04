"""
Tests for app/services/embedding_service.py.

Every test here except test_real_model_produces_384_dim_normalized_vectors
runs against the autouse fake model (see conftest.py::fake_embedding_model)
-- fast, deterministic, no network. The one real-model test is marked
@pytest.mark.real_embedding_model to opt out of the fake and is the
"clearly documented real-model verification path" called for by the Phase
3 requirements; run it explicitly with:

    ..\venv\Scripts\python.exe -m pytest tests/test_embedding_service.py -v -m real_embedding_model

It downloads all-MiniLM-L6-v2 from Hugging Face the first time it runs on
a machine (requires internet once), then uses the local cache after that.
It is NOT part of the default `pytest` run for that reason.
"""
import numpy as np
import pytest

from app.services.embedding_service import (
    EmbeddingModelError,
    EmbeddingService,
    get_embedding_service,
    reset_embedding_service,
)


def test_embed_text_returns_correct_dimension():
    service = EmbeddingService()
    vector = service.embed_text("hello world")
    assert len(vector) == 384
    assert all(isinstance(v, float) for v in vector)


def test_embed_texts_preserves_order_and_count():
    service = EmbeddingService()
    texts = ["first chunk of text", "second chunk of text", "third chunk of text"]
    vectors = service.embed_texts(texts)
    assert len(vectors) == 3
    assert all(len(v) == 384 for v in vectors)


def test_embed_texts_empty_list_returns_empty_list():
    service = EmbeddingService()
    assert service.embed_texts([]) == []


@pytest.mark.parametrize("bad_text", ["", "   ", None])
def test_embed_texts_rejects_empty_or_whitespace_text(bad_text):
    service = EmbeddingService()
    with pytest.raises(ValueError):
        service.embed_texts(["valid text", bad_text])


def test_same_text_produces_same_vector_deterministically():
    service = EmbeddingService()
    v1 = service.embed_text("a repeated sentence")
    v2 = service.embed_text("a repeated sentence")
    assert np.allclose(v1, v2)


def test_batch_encoding_matches_individual_encoding_order():
    service = EmbeddingService()
    texts = ["alpha text here", "beta text here", "gamma text here"]
    batch_vectors = service.embed_texts(texts)
    individual_vectors = [service.embed_text(t) for t in texts]
    for batch_v, individual_v in zip(batch_vectors, individual_vectors):
        assert np.allclose(batch_v, individual_v)


def test_model_is_loaded_once_and_reused(monkeypatch):
    load_calls = []
    import app.services.embedding_service as es

    original_loader = es._load_sentence_transformer

    def counting_loader(model_name, device, cache_folder):
        load_calls.append(1)
        return original_loader(model_name, device, cache_folder)

    monkeypatch.setattr(es, "_load_sentence_transformer", counting_loader)

    service = EmbeddingService()
    service.embed_text("first call loads the model")
    service.embed_text("second call reuses it")
    service.embed_texts(["third call", "also reuses it"])

    assert len(load_calls) == 1


def test_get_embedding_service_returns_singleton():
    reset_embedding_service()
    try:
        service_a = get_embedding_service()
        service_b = get_embedding_service()
        assert service_a is service_b
    finally:
        reset_embedding_service()


def test_model_load_failure_raises_embedding_model_error(monkeypatch):
    import app.services.embedding_service as es

    def broken_loader(model_name, device, cache_folder):
        raise RuntimeError("simulated model load failure")

    monkeypatch.setattr(es, "_load_sentence_transformer", broken_loader)

    service = EmbeddingService()
    with pytest.raises(EmbeddingModelError):
        service.embed_text("this will fail to load")


def test_wrong_dimension_output_raises_embedding_model_error(monkeypatch):
    import app.services.embedding_service as es

    class WrongDimModel:
        def encode(self, texts, **kwargs):
            return np.zeros((len(texts), 10))  # not 384

    monkeypatch.setattr(es, "_load_sentence_transformer", lambda *a, **k: WrongDimModel())

    service = EmbeddingService()
    with pytest.raises(EmbeddingModelError):
        service.embed_text("this model produces the wrong dimension")


@pytest.mark.real_embedding_model
def test_real_model_produces_384_dim_normalized_vectors():
    """
    The one test in the suite that loads the actual all-MiniLM-L6-v2
    model via sentence-transformers. Verifies real dimension, real
    normalization, and that semantically similar sentences end up closer
    together than unrelated ones -- something the fake model can't
    meaningfully check.
    """
    service = EmbeddingService()
    vectors = service.embed_texts(
        [
            "The cat sat on the mat.",
            "A cat was sitting on a mat.",
            "Quarterly revenue increased by twelve percent.",
        ]
    )
    assert all(len(v) == 384 for v in vectors)

    arr = np.array(vectors)
    norms = np.linalg.norm(arr, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-3)

    def cosine(a, b):
        return float(np.dot(a, b))

    similar_score = cosine(arr[0], arr[1])
    unrelated_score = cosine(arr[0], arr[2])
    assert similar_score > unrelated_score
