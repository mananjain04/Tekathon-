"""
Orchestrates PDF processing for one document: extraction (+OCR fallback),
page records, page-aware chunking, local embedding generation, and
document status transitions.

Kept as a plain function callable from a route today; nothing here is
tied to being called synchronously from a request, so moving it behind a
background worker/task queue later needs no redesign.
"""
import uuid
from typing import List

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Chunk, Document, DocumentStatus, Page
from app.services import document_service
from app.services.chunker import approx_token_count, chunk_text
from app.services.embedding_service import EmbeddingModelError, get_embedding_service
from app.services.pdf_extractor import OCRUnavailableError, PDFExtractionError, extract_pages


class ProcessingError(Exception):
    """A clearly-diagnosed processing failure (bad/unreadable PDF, no text, no OCR, etc.)."""


def _reset_previous_attempt(db: Session, document_id: uuid.UUID) -> None:
    """
    Idempotency: wipe any pages/chunks from a previous processing attempt
    on this document before rebuilding, so retries/reprocessing never
    duplicate rows. Chunks are deleted explicitly (rather than relying
    solely on cascade) so this works even if a prior attempt left
    orphaned rows around.
    """
    db.query(Chunk).filter(Chunk.document_id == document_id).delete(synchronize_session=False)
    db.query(Page).filter(Page.document_id == document_id).delete(synchronize_session=False)
    db.flush()


def _embed_chunks(db: Session, chunks: List[Chunk]) -> int:
    """
    Generates and stores embeddings for this document's chunks only, in
    batches of settings.embedding_batch_size (never one chunk at a time,
    never every chunk in the database). The model itself is loaded once
    and reused across batches/documents via the process-wide singleton in
    embedding_service. Returns the number of chunks embedded.

    Raises EmbeddingModelError on model load/output failures -- the caller
    wraps this into a ProcessingError so it goes through the same FAILED
    path as an extraction failure.
    """
    if not chunks:
        return 0

    service = get_embedding_service()
    batch_size = settings.embedding_batch_size
    embedded = 0

    for start in range(0, len(chunks), batch_size):
        batch = chunks[start : start + batch_size]
        vectors = service.embed_texts([chunk.text for chunk in batch])
        for chunk, vector in zip(batch, vectors):
            chunk.embedding = vector
        db.flush()
        embedded += len(batch)

    return embedded


def process_document(db: Session, document_id: uuid.UUID):
    """
    Returns a dict with document_id/status/pages_processed/pages_ocr/chunks_created.
    Raises document_service.DocumentNotFoundError or ProcessingError.
    On any failure, the document is left in FAILED status with error_message
    set -- never stuck in PROCESSING.
    """
    document: Document = document_service.get_document(db, document_id)

    pdf_path = document_service.resolve_storage_path(document)
    if not pdf_path.exists():
        _fail(db, document, f"Stored file is missing on disk ({pdf_path.name}).")
        raise ProcessingError(f"Stored file is missing on disk ({pdf_path.name}).")

    document.status = DocumentStatus.PROCESSING
    document.error_message = None
    db.commit()

    try:
        _reset_previous_attempt(db, document_id)

        try:
            pages = extract_pages(pdf_path)
        except (PDFExtractionError, OCRUnavailableError) as exc:
            raise ProcessingError(str(exc)) from exc

        total_meaningful_chars = sum(len(p.text) for p in pages)
        if total_meaningful_chars == 0:
            raise ProcessingError(
                "No extractable text was found in this document (checked normal "
                "extraction and OCR on every page)."
            )

        pages_ocr = 0
        chunks_created = 0
        chunk_rows: List[Chunk] = []

        for extracted in pages:
            page_row = Page(
                document_id=document.id,
                page_number=extracted.page_number,
                text=extracted.text,
                ocr_used=extracted.ocr_used,
            )
            db.add(page_row)
            db.flush()  # need page_row.id before creating its chunks

            if extracted.ocr_used:
                pages_ocr += 1

            spans = chunk_text(extracted.text, chunk_size=settings.chunk_size, chunk_overlap=settings.chunk_overlap)
            for index, span in enumerate(spans):
                chunk_row = Chunk(
                    document_id=document.id,
                    page_id=page_row.id,
                    page_number=extracted.page_number,
                    chunk_index=index,
                    text=span.text,
                    token_count=approx_token_count(span.text),
                    chunk_metadata={"start_char": span.start_char, "end_char": span.end_char},
                )
                db.add(chunk_row)
                chunk_rows.append(chunk_row)
                chunks_created += 1

        document.status = DocumentStatus.OCR_COMPLETE
        document.page_count = len(pages)
        document.error_message = None
        db.commit()

        # --- Phase 3: local embedding generation ---
        document.status = DocumentStatus.EMBEDDING
        db.commit()

        # The OCR_COMPLETE commit above expires chunk_rows' attributes
        # (SQLAlchemy's default expire_on_commit) -- re-query once here
        # rather than triggering a lazy-load SELECT per chunk below.
        chunk_rows = (
            db.query(Chunk)
            .filter(Chunk.document_id == document.id)
            .order_by(Chunk.page_number, Chunk.chunk_index)
            .all()
        )

        try:
            chunks_embedded = _embed_chunks(db, chunk_rows)
        except EmbeddingModelError as exc:
            raise ProcessingError(f"Embedding generation failed: {exc}") from exc

        document.status = DocumentStatus.INDEXED
        document.error_message = None
        db.commit()

        return {
            "document_id": document.id,
            "status": document.status,
            "pages_processed": len(pages),
            "pages_ocr": pages_ocr,
            "chunks_created": chunks_created,
            "chunks_embedded": chunks_embedded,
        }

    except ProcessingError as exc:
        _fail(db, document, str(exc))
        raise
    except Exception as exc:  # noqa: BLE001 -- any unexpected error must still resolve out of PROCESSING
        _fail(db, document, f"Unexpected processing error: {exc}")
        raise ProcessingError(f"Unexpected processing error: {exc}") from exc


def _fail(db: Session, document: Document, message: str) -> None:
    """
    Moves a document to FAILED. Defensive against the session already
    being unusable (e.g. the failure we're recording was itself a DB
    error): both the rollback and the failure-commit are individually
    guarded so a broken session can never escape this function and skip
    marking the document FAILED, and so this function itself never raises
    over the original error. If the failure-commit can't be persisted
    because the database is genuinely unreachable, the document may be
    left in PROCESSING in the database (nothing can persist a status
    change without a database) -- but the original exception still
    propagates to the caller either way, so the failure is never silently
    swallowed.
    """
    try:
        db.rollback()
    except Exception:  # noqa: BLE001 -- rollback itself must never mask the real error
        pass

    try:
        document.status = DocumentStatus.FAILED
        document.error_message = message[:2000]
        db.commit()
    except Exception:  # noqa: BLE001 -- see docstring: best-effort, must not raise
        try:
            db.rollback()
        except Exception:
            pass
