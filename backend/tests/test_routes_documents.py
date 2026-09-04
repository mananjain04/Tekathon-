"""
Route-level tests for app/routes/documents.py using FastAPI's TestClient
(real HTTP request/response cycle, real multipart upload parsing). Runs
against the real Postgres DB (see conftest.py).
"""
import uuid

import fitz
from fastapi.testclient import TestClient

from app.db.models import Document
from app.main import app

client = TestClient(app)


def _pdf_bytes(page_texts):
    doc = fitz.open()
    for text in page_texts:
        page = doc.new_page()
        page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def test_upload_rejects_non_pdf_extension(temp_storage):
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("notes.txt", b"hello world", "text/plain")},
    )
    assert resp.status_code == 400


def test_upload_rejects_bad_magic_bytes(temp_storage):
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("fake.pdf", b"not a real pdf at all", "application/pdf")},
    )
    assert resp.status_code == 400


def test_upload_accepts_valid_pdf_and_never_leaks_storage_path(db_session, cleanup_documents, temp_storage):
    content = _pdf_bytes(["Hello from a real test PDF, with plenty of text."])
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("report.pdf", content, "application/pdf")},
    )
    assert resp.status_code == 201
    body = resp.json()
    cleanup_documents.append(uuid.UUID(body["id"]))

    assert body["status"] == "UPLOADED"
    assert body["filename"] == "report.pdf"
    assert body["content_type"] == "application/pdf"
    assert "storage_path" not in body


def test_full_upload_then_process_flow(db_session, cleanup_documents, temp_storage):
    content = _pdf_bytes(
        [
            "First page, plenty of extractable text content here for this test.",
            "Second page, plenty of extractable text content here for this test.",
        ]
    )
    upload_resp = client.post(
        "/api/documents/upload",
        files={"file": ("two_pages.pdf", content, "application/pdf")},
    )
    assert upload_resp.status_code == 201
    document_id = upload_resp.json()["id"]
    cleanup_documents.append(uuid.UUID(document_id))

    process_resp = client.post(f"/api/documents/{document_id}/process")
    assert process_resp.status_code == 200
    result = process_resp.json()
    assert result["pages_processed"] == 2
    assert result["status"] == "OCR_COMPLETE"
    assert result["chunks_created"] > 0

    get_resp = client.get(f"/api/documents/{document_id}")
    assert get_resp.status_code == 200
    fetched = get_resp.json()
    assert fetched["status"] == "OCR_COMPLETE"
    assert "storage_path" not in fetched


def test_get_unknown_document_returns_404():
    resp = client.get(f"/api/documents/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_process_unknown_document_returns_404():
    resp = client.post(f"/api/documents/{uuid.uuid4()}/process")
    assert resp.status_code == 404


def test_list_documents_includes_newly_uploaded(db_session, cleanup_documents, temp_storage):
    content = _pdf_bytes(["Listable document content, plenty of it."])
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("listed.pdf", content, "application/pdf")},
    )
    document_id = resp.json()["id"]
    cleanup_documents.append(uuid.UUID(document_id))

    list_resp = client.get("/api/documents")
    assert list_resp.status_code == 200
    ids = [d["id"] for d in list_resp.json()]
    assert document_id in ids
    assert all("storage_path" not in d for d in list_resp.json())
