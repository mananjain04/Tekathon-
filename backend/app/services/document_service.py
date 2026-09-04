"""
Document upload/storage/CRUD.

Handles everything filesystem- and DB-record-related for a Document:
safe validated storage of the uploaded PDF, and basic create/list/get.
Does NOT do any PDF parsing/OCR/chunking -- that's document_processing_service.
"""
import os
import uuid
from pathlib import Path
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile

from app.core.config import settings
from app.db.models import Document, DocumentStatus

PDF_MAGIC = b"%PDF"
UPLOAD_CHUNK_SIZE = 1024 * 1024  # 1 MiB read chunks, so large files never load fully into memory


class UploadValidationError(Exception):
    """Raised for any problem with an uploaded file that is the client's fault (-> HTTP 400)."""


class DocumentNotFoundError(Exception):
    """Raised when a document id does not exist (-> HTTP 404)."""


def _storage_root() -> Path:
    root = Path(settings.storage_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _sanitize_original_filename(raw_name: Optional[str]) -> str:
    """
    Keeps the *display* filename safe to store as metadata. This value is
    NEVER used to build a filesystem path -- storage always uses a
    generated UUID name (see save_uploaded_pdf) -- so this only guards
    against garbage/oversized/traversal-looking strings ending up in the
    database and being reflected back to a client.
    """
    name = os.path.basename((raw_name or "").strip().replace("\\", "/"))
    if not name or name in (".", ".."):
        name = "upload.pdf"
    return name[:512]


def _validate_extension(filename: str) -> None:
    if not filename.lower().endswith(".pdf"):
        raise UploadValidationError("Only .pdf files are accepted.")


def save_uploaded_pdf(upload: UploadFile) -> Tuple[uuid.UUID, str, str]:
    """
    Streams an uploaded file to disk under a generated UUID filename,
    validating type/size/signature as it goes. Never trusts the client
    filename for the storage path (eliminates path traversal by design).

    Returns (document_id, relative_storage_path, sanitized_original_filename).
    Raises UploadValidationError on any validation failure; any partial
    file written to disk is cleaned up before raising.
    """
    original_filename = _sanitize_original_filename(upload.filename)
    _validate_extension(original_filename)

    document_id = uuid.uuid4()
    root = _storage_root()
    final_path = root / f"{document_id}.pdf"
    tmp_path = root / f"{document_id}.pdf.part"

    if final_path.exists():
        # Astronomically unlikely with uuid4, but never silently overwrite.
        raise UploadValidationError("A document with this generated id already exists. Please retry.")

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    total_written = 0
    first_chunk_checked = False

    try:
        with open(tmp_path, "wb") as out:
            while True:
                chunk = upload.file.read(UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break

                if not first_chunk_checked:
                    if not chunk.startswith(PDF_MAGIC):
                        raise UploadValidationError(
                            "File does not look like a valid PDF (missing %PDF signature)."
                        )
                    first_chunk_checked = True

                total_written += len(chunk)
                if total_written > max_bytes:
                    raise UploadValidationError(
                        f"File exceeds the maximum upload size of {settings.max_upload_size_mb} MB."
                    )

                out.write(chunk)

        if total_written == 0:
            raise UploadValidationError("Uploaded file is empty.")

        tmp_path.rename(final_path)
    except UploadValidationError:
        _safe_unlink(tmp_path)
        raise
    except Exception as exc:  # noqa: BLE001 -- convert any I/O surprise into a clear client error
        _safe_unlink(tmp_path)
        raise UploadValidationError(f"Failed to save uploaded file: {exc}") from exc

    # Stored as a path relative to storage_dir -- never an absolute path --
    # so it's safe to keep in the DB and never leaks a server filesystem layout.
    relative_path = final_path.name
    return document_id, relative_path, original_filename


def _safe_unlink(path: Path) -> None:
    try:
        if path.exists():
            path.unlink()
    except OSError:
        pass


def resolve_storage_path(document: Document) -> Path:
    """Turns a document's stored relative path back into an absolute path for I/O."""
    return _storage_root() / document.storage_path


def create_document(
    db: Session,
    document_id: uuid.UUID,
    filename: str,
    storage_path: str,
    content_type: Optional[str],
) -> Document:
    document = Document(
        id=document_id,
        filename=filename,
        storage_path=storage_path,
        content_type=content_type,
        status=DocumentStatus.UPLOADED,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def list_documents(db: Session) -> List[Document]:
    return db.query(Document).order_by(Document.created_at.desc()).all()


def get_document(db: Session, document_id: uuid.UUID) -> Document:
    document = db.query(Document).filter(Document.id == document_id).first()
    if document is None:
        raise DocumentNotFoundError(f"Document {document_id} not found.")
    return document
