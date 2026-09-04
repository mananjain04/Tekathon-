"""
Tests for app/services/document_service.py: upload validation, safe
storage-filename generation, and basic document CRUD.

Uses a minimal fake UploadFile (duck-typed to match the subset of
starlette's UploadFile that document_service actually touches: .filename,
.file.read()) so these stay fast unit tests instead of full HTTP round
trips through FastAPI's multipart parser. The HTTP-level upload path is
covered separately in test_routes_documents.py.
"""
import io

import pytest

from app.db.models import DocumentStatus
from app.services import document_service
from app.services.document_service import UploadValidationError

VALID_PDF_BYTES = b"%PDF-1.4\n%mock pdf content for tests\n%%EOF"


class FakeUploadFile:
    def __init__(self, filename, content, content_type="application/pdf"):
        self.filename = filename
        self.content_type = content_type
        self.file = io.BytesIO(content)


def test_rejects_non_pdf_extension(temp_storage):
    upload = FakeUploadFile("resume.docx", VALID_PDF_BYTES)
    with pytest.raises(UploadValidationError):
        document_service.save_uploaded_pdf(upload)


def test_rejects_missing_pdf_magic_bytes(temp_storage):
    upload = FakeUploadFile("fake.pdf", b"this is definitely not a pdf")
    with pytest.raises(UploadValidationError):
        document_service.save_uploaded_pdf(upload)


def test_rejects_empty_file(temp_storage):
    upload = FakeUploadFile("empty.pdf", b"")
    with pytest.raises(UploadValidationError):
        document_service.save_uploaded_pdf(upload)


def test_rejects_file_over_max_upload_size(temp_storage, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "max_upload_size_mb", 0)  # any non-empty content now exceeds the limit
    upload = FakeUploadFile("big.pdf", VALID_PDF_BYTES)
    with pytest.raises(UploadValidationError):
        document_service.save_uploaded_pdf(upload)


def test_no_partial_file_left_behind_after_failed_upload(temp_storage):
    upload = FakeUploadFile("fake.pdf", b"not a pdf at all")
    with pytest.raises(UploadValidationError):
        document_service.save_uploaded_pdf(upload)

    # temp_storage dir may not even exist yet if nothing else wrote to it,
    # but if it does, it must not contain a leftover .part file.
    if temp_storage.exists():
        leftover = list(temp_storage.glob("*.part"))
        assert leftover == []


def test_generates_uuid_storage_filename_never_uses_client_name(temp_storage):
    # A filename crafted to look like a path-traversal attempt.
    upload = FakeUploadFile("../../etc/passwd.pdf", VALID_PDF_BYTES)
    document_id, storage_path, original_filename = document_service.save_uploaded_pdf(upload)

    assert storage_path == f"{document_id}.pdf"
    assert ".." not in storage_path
    assert "/" not in storage_path
    assert "\\" not in storage_path
    # the sanitized display filename is a basename only -- never used for the path
    assert original_filename == "passwd.pdf"

    saved_file = temp_storage / storage_path
    assert saved_file.exists()
    assert saved_file.read_bytes() == VALID_PDF_BYTES


def test_create_document_sets_uploaded_status(db_session, cleanup_documents, temp_storage):
    upload = FakeUploadFile("report.pdf", VALID_PDF_BYTES)
    document_id, storage_path, original_filename = document_service.save_uploaded_pdf(upload)

    document = document_service.create_document(
        db_session,
        document_id=document_id,
        filename=original_filename,
        storage_path=storage_path,
        content_type="application/pdf",
    )
    cleanup_documents.append(document.id)

    assert document.status == DocumentStatus.UPLOADED
    assert document.filename == "report.pdf"

    fetched = document_service.get_document(db_session, document_id)
    assert fetched.id == document_id
    assert fetched.status == DocumentStatus.UPLOADED


def test_get_unknown_document_raises_not_found(db_session):
    import uuid

    with pytest.raises(document_service.DocumentNotFoundError):
        document_service.get_document(db_session, uuid.uuid4())
