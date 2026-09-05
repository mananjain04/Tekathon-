"""
Tests for app/services/context_builder.py (Phase 5A).
"""
import uuid

from app.services.context_builder import build_context, build_evidence


def _chunk(**overrides):
    base = {
        "chunk_id": uuid.uuid4(),
        "document_id": uuid.uuid4(),
        "page_id": uuid.uuid4(),
        "page_number": 3,
        "chunk_index": 1,
        "text": "The leave policy allows fifteen days of paid leave per year.",
        "similarity": 0.9,
        "distance": 0.1,
        "rerank_score": 5.2,
    }
    base.update(overrides)
    return base


def test_build_context_empty_list_returns_empty_string():
    assert build_context([]) == ""


def test_build_context_includes_source_markers_and_metadata():
    chunk = _chunk()
    context = build_context([chunk])

    assert "[Source 1]" in context
    assert f"Document: {chunk['document_id']}" in context
    assert f"Page: {chunk['page_number']}" in context
    assert f"Chunk: {chunk['chunk_index']}" in context
    assert "Content:" in context
    assert chunk["text"] in context


def test_build_context_numbers_sources_in_input_order():
    chunk_a = _chunk(text="First chunk text.")
    chunk_b = _chunk(text="Second chunk text.")

    context = build_context([chunk_a, chunk_b])

    assert context.index("[Source 1]") < context.index("First chunk text.")
    assert context.index("First chunk text.") < context.index("[Source 2]")
    assert context.index("[Source 2]") < context.index("Second chunk text.")


def test_build_context_never_alters_chunk_text():
    weird_text = "  Text with   odd spacing\tand a tab.  "
    chunk = _chunk(text=weird_text)

    context = build_context([chunk])

    # Only whitespace-stripped at the ends -- internal content untouched,
    # never summarized/paraphrased/truncated.
    assert weird_text.strip() in context


def test_build_evidence_preserves_all_required_fields():
    chunk = _chunk()
    [evidence] = build_evidence([chunk])

    for field in (
        "chunk_id",
        "document_id",
        "page_id",
        "page_number",
        "chunk_index",
        "text",
        "similarity",
        "distance",
        "rerank_score",
    ):
        assert evidence[field] == chunk[field]


def test_build_evidence_excludes_unlisted_keys_like_storage_path():
    chunk = _chunk()
    chunk["storage_path"] = "/secret/server/path/file.pdf"

    [evidence] = build_evidence([chunk])

    assert "storage_path" not in evidence


def test_build_evidence_empty_list_returns_empty_list():
    assert build_evidence([]) == []


def test_build_evidence_missing_optional_fields_become_none():
    chunk = _chunk()
    del chunk["rerank_score"]

    [evidence] = build_evidence([chunk])

    assert evidence["rerank_score"] is None
