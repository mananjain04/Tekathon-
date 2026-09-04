"""
Tests for app/services/document_processing_service.py: end-to-end
processing against real, small, real-text (non-scanned) PDFs, page
creation, page-scoped chunking, reprocessing idempotency, and failure
handling. Runs against the real Postgres DB (see conftest.py).
"""
import io

import fitz
import pytest

from app.db.models import Chunk, Document, DocumentStatus, Page
from app.services import document_processing_service, document_service


class FakeUploadFile:
    def __init__(self, filename, content, content_type="application/pdf"):
        self.filename = filename
        self.content_type = content_type
        self.file = io.BytesIO(content)


def _make_pdf_bytes(page_texts):
    doc = fitz.open()
    for text in page_texts:
        page = doc.new_page()
        page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def _create_test_document(db_session, filename, page_texts):
    content = _make_pdf_bytes(page_texts)
    upload = FakeUploadFile(filename, content)
    document_id, storage_path, original_filename = document_service.save_uploaded_pdf(upload)
    return document_service.create_document(
        db_session,
        document_id=document_id,
        filename=original_filename,
        storage_path=storage_path,
        content_type="application/pdf",
    )


def test_processing_creates_one_page_row_per_pdf_page(db_session, cleanup_documents, temp_storage):
    document = _create_test_document(
        db_session,
        "two_pages.pdf",
        [
            "Page one has plenty of real extractable text content here.",
            "Page two also has plenty of real extractable text content here.",
        ],
    )
    cleanup_documents.append(document.id)

    result = document_processing_service.process_document(db_session, document.id)

    assert result["pages_processed"] == 2
    assert result["chunks_created"] > 0
    assert result["chunks_embedded"] == result["chunks_created"]

    pages = db_session.query(Page).filter(Page.document_id == document.id).order_by(Page.page_number).all()
    assert [p.page_number for p in pages] == [1, 2]
    assert all(p.ocr_used is False for p in pages)  # plenty of normal text, OCR never triggered

    db_session.refresh(document)
    assert document.status == DocumentStatus.INDEXED
    assert document.page_count == 2
    assert document.error_message is None


def test_processing_creates_page_aware_chunks_that_never_cross_pages(db_session, cleanup_documents, temp_storage):
    page1_text = "First page repeated content. " * 60
    page2_text = "Second page repeated content. " * 60
    document = _create_test_document(db_session, "long_pages.pdf", [page1_text, page2_text])
    cleanup_documents.append(document.id)

    document_processing_service.process_document(db_session, document.id)

    chunks = db_session.query(Chunk).filter(Chunk.document_id == document.id).order_by(Chunk.page_number, Chunk.chunk_index).all()
    assert len(chunks) > 0

    page1_chunks = [c for c in chunks if c.page_number == 1]
    page2_chunks = [c for c in chunks if c.page_number == 2]
    assert page1_chunks and page2_chunks

    for chunk in chunks:
        assert chunk.document_id == document.id
        assert chunk.page_id is not None
        assert chunk.chunk_metadata is not None
        assert "start_char" in chunk.chunk_metadata
        assert "end_char" in chunk.chunk_metadata
        assert chunk.token_count is not None and chunk.token_count > 0

    # No chunk mixes content from both pages -- the actual point of this test.
    assert all("Second page" not in c.text for c in page1_chunks)
    assert all("First page" not in c.text for c in page2_chunks)

    # chunk_index is scoped per page, restarting at 0 for each page.
    assert [c.chunk_index for c in page1_chunks] == list(range(len(page1_chunks)))
    assert [c.chunk_index for c in page2_chunks] == list(range(len(page2_chunks)))

    # Phase 3: every chunk has a stored 384-dim embedding.
    for chunk in chunks:
        assert chunk.embedding is not None
        assert len(chunk.embedding) == 384


def test_reprocessing_does_not_duplicate_rows(db_session, cleanup_documents, temp_storage):
    document = _create_test_document(
        db_session, "reprocess.pdf", ["Some text content for the reprocessing test, plenty of characters here."]
    )
    cleanup_documents.append(document.id)

    document_processing_service.process_document(db_session, document.id)
    first_pages = db_session.query(Page).filter(Page.document_id == document.id).count()
    first_chunks = db_session.query(Chunk).filter(Chunk.document_id == document.id).count()
    assert first_pages > 0 and first_chunks > 0

    document_processing_service.process_document(db_session, document.id)
    second_pages = db_session.query(Page).filter(Page.document_id == document.id).count()
    second_chunks = db_session.query(Chunk).filter(Chunk.document_id == document.id).count()

    assert second_pages == first_pages
    assert second_chunks == first_chunks

    # Phase 3: reprocessing re-embeds cleanly -- no leftover/duplicate/null vectors.
    reprocessed_chunks = db_session.query(Chunk).filter(Chunk.document_id == document.id).all()
    assert all(c.embedding is not None and len(c.embedding) == 384 for c in reprocessed_chunks)

    db_session.refresh(document)
    assert document.status == DocumentStatus.INDEXED


def test_missing_stored_file_results_in_failed_status(db_session, cleanup_documents, temp_storage):
    document = _create_test_document(db_session, "will_go_missing.pdf", ["Some content."])
    cleanup_documents.append(document.id)

    stored_path = document_service.resolve_storage_path(document)
    stored_path.unlink()

    with pytest.raises(document_processing_service.ProcessingError):
        document_processing_service.process_document(db_session, document.id)

    db_session.refresh(document)
    assert document.status == DocumentStatus.FAILED
    assert document.error_message is not None
    # a failed attempt must not leave orphaned pages/chunks behind
    assert db_session.query(Page).filter(Page.document_id == document.id).count() == 0
    assert db_session.query(Chunk).filter(Chunk.document_id == document.id).count() == 0


def test_retrying_a_failed_document_can_succeed(db_session, cleanup_documents, temp_storage):
    document = _create_test_document(
        db_session, "retry.pdf", ["Retry content, plenty of extractable text here for this test."]
    )
    cleanup_documents.append(document.id)

    stored_path = document_service.resolve_storage_path(document)
    original_bytes = stored_path.read_bytes()
    stored_path.unlink()

    with pytest.raises(document_processing_service.ProcessingError):
        document_processing_service.process_document(db_session, document.id)
    db_session.refresh(document)
    assert document.status == DocumentStatus.FAILED

    # Restore the file and retry -- should now succeed and clear the failure.
    stored_path.write_bytes(original_bytes)
    result = document_processing_service.process_document(db_session, document.id)

    db_session.refresh(document)
    assert document.status == DocumentStatus.INDEXED
    assert document.error_message is None
    assert result["pages_processed"] == 1
    assert result["chunks_embedded"] == result["chunks_created"]


def test_processing_unknown_document_raises_not_found(db_session):
    import uuid

    with pytest.raises(document_service.DocumentNotFoundError):
        document_processing_service.process_document(db_session, uuid.uuid4())


def test_embedding_failure_transitions_document_to_failed(db_session, cleanup_documents, temp_storage, monkeypatch):
    """
    If embedding generation blows up (model load failure, bad output, etc.)
    the document must land on FAILED with a useful error_message -- not get
    stuck in EMBEDDING, and not silently report success.
    """
    import app.services.embedding_service as es

    def broken_loader(model_name, device, cache_folder):
        raise RuntimeError("simulated embedding model failure")

    monkeypatch.setattr(es, "_load_sentence_transformer", broken_loader)
    es.reset_embedding_service()

    document = _create_test_document(
        db_session, "embedding_will_fail.pdf", ["Plenty of extractable text content for this test to chunk."]
    )
    cleanup_documents.append(document.id)

    with pytest.raises(document_processing_service.ProcessingError, match="Embedding generation failed"):
        document_processing_service.process_document(db_session, document.id)

    db_session.refresh(document)
    assert document.status == DocumentStatus.FAILED
    assert document.error_message is not None
    assert "Embedding generation failed" in document.error_message

    # Pages/chunks from the (otherwise successful) extraction/chunking
    # stage are still present -- only the embedding step failed -- but no
    # chunk was left with a corrupt/partial vector.
    chunks = db_session.query(Chunk).filter(Chunk.document_id == document.id).all()
    assert all(c.embedding is None for c in chunks)

    es.reset_embedding_service()
