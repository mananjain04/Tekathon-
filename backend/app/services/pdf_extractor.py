"""
Local, offline PDF text extraction with an OCR fallback for scanned pages.

PyMuPDF (fitz) handles both normal text extraction and rendering a page
to an image; pytesseract wraps the local Tesseract binary for OCR. No
network calls are made anywhere in this module.
"""
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List

import fitz  # PyMuPDF
import pytesseract
from PIL import Image

from app.core.config import settings

_WHITESPACE_RE = re.compile(r"[ \t\u00a0]+")
_BLANK_LINES_RE = re.compile(r"\n{3,}")


class PDFExtractionError(Exception):
    """The PDF itself could not be opened/read (corrupted, not a PDF, etc.)."""


class OCRUnavailableError(Exception):
    """A page needed OCR but the local Tesseract engine isn't available."""


@dataclass
class PageExtractionResult:
    page_number: int  # 1-indexed, matches the physical PDF page
    text: str
    ocr_used: bool


def _clean_text(raw: str) -> str:
    """Light cleanup of common PDF-extraction artifacts, without rewriting content."""
    text = raw.replace("\x00", "")
    text = _WHITESPACE_RE.sub(" ", text)
    text = _BLANK_LINES_RE.sub("\n\n", text)
    return text.strip()


def _configure_tesseract_cmd() -> None:
    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd


def _ocr_page(page: "fitz.Page") -> str:
    _configure_tesseract_cmd()
    pix = page.get_pixmap(dpi=settings.ocr_render_dpi)
    image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    try:
        raw_text = pytesseract.image_to_string(image)
    except pytesseract.TesseractNotFoundError as exc:
        raise OCRUnavailableError(
            "This page has little/no extractable text and requires OCR, but the "
            "local Tesseract OCR engine was not found. Install Tesseract and/or "
            "set TESSERACT_CMD in .env to its executable path "
            "(see backend/docs/PHASE2.md for Windows install steps)."
        ) from exc
    return _clean_text(raw_text)


def extract_pages(pdf_path: Path) -> List[PageExtractionResult]:
    """
    Extracts text page-by-page. For any page whose normal-extracted text
    is shorter than settings.ocr_text_threshold, falls back to local OCR
    on a rendered image of that page.

    Raises PDFExtractionError if the file can't be opened as a PDF at all,
    or OCRUnavailableError if OCR is needed but Tesseract isn't available.
    """
    try:
        doc = fitz.open(pdf_path)
    except Exception as exc:  # noqa: BLE001 -- fitz raises several different error types
        raise PDFExtractionError(f"Could not open PDF ({exc}).") from exc

    if doc.is_encrypted:
        doc.close()
        raise PDFExtractionError("PDF is password-protected/encrypted; cannot extract text.")

    if doc.page_count == 0:
        doc.close()
        raise PDFExtractionError("PDF has no pages.")

    results: List[PageExtractionResult] = []
    try:
        for index in range(doc.page_count):
            page = doc.load_page(index)
            page_number = index + 1

            normal_text = _clean_text(page.get_text("text") or "")

            if len(normal_text) >= settings.ocr_text_threshold:
                results.append(PageExtractionResult(page_number, normal_text, ocr_used=False))
                continue

            # Insufficient normal text -> OCR fallback.
            ocr_text = _ocr_page(page)
            # Prefer whichever extraction produced more content.
            final_text = ocr_text if len(ocr_text) >= len(normal_text) else normal_text
            results.append(PageExtractionResult(page_number, final_text, ocr_used=True))
    finally:
        doc.close()

    return results
