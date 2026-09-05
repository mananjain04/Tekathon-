"""
tests/test_security_ingestion.py — Phase 3: Ingestion hardening tests.

Tests the PDF security scanning controls: storage confinement, MIME check,
and embedded JavaScript detection.
"""
import io
from pathlib import Path

import fitz  # PyMuPDF
import pytest

from app.services.document_service import UploadValidationError
from app.services.ingestion_hardening import (
    _check_embedded_js,
    _check_mime,
    _check_storage_confinement,
    validate_saved_pdf,
)


# ---------------------------------------------------------------------------
# Fixtures: create real minimal PDFs for testing
# ---------------------------------------------------------------------------

@pytest.fixture()
def minimal_clean_pdf(tmp_path) -> Path:
    """A minimal valid PDF with no JavaScript."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Clean test document.")
    path = tmp_path / "clean.pdf"
    doc.save(str(path))
    doc.close()
    return path


@pytest.fixture()
def storage_root(tmp_path) -> Path:
    root = tmp_path / "storage"
    root.mkdir()
    return root


# ---------------------------------------------------------------------------
# Tests: storage root confinement
# ---------------------------------------------------------------------------

class TestStorageConfinement:
    def test_file_inside_root_passes(self, tmp_path):
        root = tmp_path / "storage"
        root.mkdir()
        file = root / "abc123.pdf"
        file.touch()
        # Should not raise
        _check_storage_confinement(file, root)

    def test_traversal_path_rejected(self, tmp_path):
        root = tmp_path / "storage"
        root.mkdir()
        # Simulate a traversal attempt
        escape_path = root / ".." / "escaped.pdf"
        with pytest.raises(UploadValidationError, match="escapes"):
            _check_storage_confinement(escape_path, root)


# ---------------------------------------------------------------------------
# Tests: MIME check (valid PDF)
# ---------------------------------------------------------------------------

class TestMIMECheck:
    def test_valid_pdf_passes(self, minimal_clean_pdf):
        # Should not raise
        _check_mime(minimal_clean_pdf)

    def test_non_pdf_content_rejected(self, tmp_path):
        bad = tmp_path / "fake.pdf"
        bad.write_bytes(b"PK\x03\x04This is actually a zip file disguised as PDF")
        with pytest.raises(UploadValidationError):
            _check_mime(bad)

    def test_text_file_rejected(self, tmp_path):
        bad = tmp_path / "text.pdf"
        bad.write_text("I am just a text file, not a PDF")
        with pytest.raises(UploadValidationError):
            _check_mime(bad)


# ---------------------------------------------------------------------------
# Tests: embedded JavaScript detection
# ---------------------------------------------------------------------------

class TestEmbeddedJSDetection:
    def test_clean_pdf_passes(self, minimal_clean_pdf):
        # No JS in the clean PDF
        _check_embedded_js(minimal_clean_pdf)

    def test_pdf_with_js_action_rejected(self, tmp_path):
        """Create a PDF with embedded JS via xref and confirm it is rejected."""
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((50, 50), "Malicious PDF content")
        # Add a JavaScript action xref and link it as OpenAction in the catalog
        js_xref = doc.get_new_xref()
        doc.update_object(js_xref, "<< /S /JavaScript /JS (app.alert(1);) >>")
        catalog_xref = doc.pdf_catalog()
        doc.xref_set_key(catalog_xref, "OpenAction", f"{js_xref} 0 R")
        path = tmp_path / "malicious.pdf"
        doc.save(str(path))
        doc.close()
        with pytest.raises(UploadValidationError, match="suspicious"):
            _check_embedded_js(path)



# ---------------------------------------------------------------------------
# Tests: full validate_saved_pdf pipeline
# ---------------------------------------------------------------------------

class TestValidateSavedPDF:
    def test_clean_pdf_passes_full_validation(self, minimal_clean_pdf, storage_root):
        # Move the PDF into the storage root
        import shutil
        dest = storage_root / "clean.pdf"
        shutil.copy(minimal_clean_pdf, dest)
        # Should not raise
        validate_saved_pdf(dest, storage_root)
