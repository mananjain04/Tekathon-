"""
Tests for PDF extraction that don't need Tesseract installed: they build
small real PDFs in-memory with PyMuPDF that have plenty of normal
(non-scanned) text, so the OCR fallback path is never exercised here.
OCR itself is covered by the manual verification procedure in
backend/docs/PHASE2.md, since it depends on a local OS-level install.
"""
import fitz
import pytest

from app.services.pdf_extractor import PDFExtractionError, extract_pages


def _make_pdf(path, page_texts):
    doc = fitz.open()
    for text in page_texts:
        page = doc.new_page()
        page.insert_text((72, 72), text)
    doc.save(path)
    doc.close()


def _make_zero_page_pdf(path):
    """
    PyMuPDF's Document.save() refuses to write a document with zero pages
    (raises "ValueError: cannot save with zero pages"), so a zero-page PDF
    can't be produced via fitz.open() + doc.save(). Verified directly:
    even inserting then deleting a page and re-saving hits the same error,
    since the check is on page_count at save time, not on how it got there.

    Instead, write a minimal, structurally valid PDF by hand whose /Pages
    tree has an empty /Kids array and /Count 0. PyMuPDF opens this fine
    and reports page_count == 0, which is exactly the condition
    extract_pages() needs to guard against.
    """
    minimal_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n"
        b"trailer\n<< /Size 3 /Root 1 0 R >>\n"
        b"%%EOF"
    )
    path.write_bytes(minimal_pdf)


def test_extracts_text_per_page_with_correct_page_numbers(tmp_path):
    pdf_path = tmp_path / "sample.pdf"
    _make_pdf(pdf_path, ["First page content, plenty of real text here.", "Second page, also plenty of text here."])

    pages = extract_pages(pdf_path)

    assert [p.page_number for p in pages] == [1, 2]
    assert "First page" in pages[0].text
    assert "Second page" in pages[1].text
    assert all(p.ocr_used is False for p in pages)


def test_corrupted_file_raises_pdf_extraction_error(tmp_path):
    bad_path = tmp_path / "not_a_pdf.pdf"
    bad_path.write_bytes(b"this is not a pdf at all")

    with pytest.raises(PDFExtractionError):
        extract_pages(bad_path)


def test_zero_page_pdf_raises_pdf_extraction_error(tmp_path):
    pdf_path = tmp_path / "empty.pdf"
    _make_zero_page_pdf(pdf_path)

    # Sanity-check the fixture itself actually is a zero-page PDF before
    # asserting on extract_pages' behavior, so a broken fixture can't
    # masquerade as a passing test.
    probe = fitz.open(pdf_path)
    assert probe.page_count == 0
    probe.close()

    with pytest.raises(PDFExtractionError):
        extract_pages(pdf_path)
