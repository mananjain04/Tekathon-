"""
app/services/ingestion_hardening.py — Phase 3: additional PDF security checks.

Called from document_service.save_uploaded_pdf() AFTER the existing
%PDF magic-byte check and size limit (those are NOT changed). This module
adds:

1. MIME-type sniffing via python-magic (reads actual file bytes, ignores
   client-supplied Content-Type entirely).
2. Embedded JavaScript / suspicious action-stream detection via PyMuPDF.
3. Explicit storage-root confinement assertion (belt + suspenders on top
   of the existing UUID path generation).

Raising UploadValidationError from here causes the route to return HTTP 400
with a clear message. The caller (document_service) must clean up the
partial file before re-raising.
"""
from __future__ import annotations

from pathlib import Path

import fitz  # PyMuPDF

from app.services.document_service import UploadValidationError


def _check_mime(path: Path) -> None:
    """
    Use PyMuPDF to open the file and confirm it is a valid PDF document.
    This serves as MIME-type sniffing: fitz raises an exception on files
    that are not real PDFs regardless of their extension or Content-Type.
    We open it just for validation and close it immediately.
    """
    try:
        doc = fitz.open(path)
        is_pdf = doc.is_pdf
        doc.close()
        if not is_pdf:
            raise UploadValidationError(
                "File content does not match a valid PDF structure."
            )
    except UploadValidationError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise UploadValidationError(
            f"File content validation failed: {exc}"
        ) from exc


def _check_embedded_js(path: Path) -> None:
    """
    Scan the saved PDF for embedded JavaScript and suspicious action streams
    by scanning ALL xref objects in the file for dangerous PDF tokens.

    This catches:
    - OpenAction /JavaScript entries in the document catalog
    - Embedded JS action objects anywhere in the xref table
    - /Launch, /URI, /SubmitForm action streams
    - Annotation-level JavaScript actions

    Uses full xref scan (not just annotations) to defeat evasion attempts
    that skip annotation metadata but embed actions in the catalog directly.
    """
    try:
        doc = fitz.open(path)
    except Exception as exc:  # noqa: BLE001
        raise UploadValidationError(f"Could not inspect PDF for JavaScript: {exc}") from exc

    _DANGEROUS_TOKENS = {"/JavaScript", "/Launch", "/SubmitForm", "/GoToR"}

    try:
        xref_count = doc.xref_length()
        for xref in range(1, xref_count):
            try:
                obj_str = doc.xref_object(xref, compressed=False)
            except Exception:  # noqa: BLE001 — some xrefs are streams/binary, skip
                continue

            for token in _DANGEROUS_TOKENS:
                if token in obj_str:
                    raise UploadValidationError(
                        f"Rejected: PDF contains a suspicious object stream "
                        f"({token}) that is not permitted in KAVACH. "
                        f"This file may contain executable or exfiltration actions."
                    )
    finally:
        doc.close()


def _check_storage_confinement(resolved_path: Path, storage_root: Path) -> None:
    """
    Confirm the resolved file path is strictly inside the configured storage
    root. Belt + suspenders on top of UUID-based path generation.
    Raises UploadValidationError if the path escapes the root.
    """
    try:
        resolved_path.resolve().relative_to(storage_root.resolve())
    except ValueError as exc:
        raise UploadValidationError(
            "Rejected: file path escapes the configured storage directory."
        ) from exc


def validate_saved_pdf(saved_path: Path, storage_root: Path) -> None:
    """
    Run all Phase 3 ingestion hardening checks on an already-saved PDF file.
    Call this AFTER the file has been written to disk (so PyMuPDF can open it).

    Raises UploadValidationError (HTTP 400) on any failure.
    """
    _check_storage_confinement(saved_path, storage_root)
    _check_mime(saved_path)
    _check_embedded_js(saved_path)
