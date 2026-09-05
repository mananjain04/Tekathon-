"""
Document routes: upload, list, get, process. Kept thin -- validation and
orchestration live in app/services/*. All endpoints require authentication.

Phase 1 (Auth): Depends(auth_service.get_current_user) on every route.
Phase 2 (RBAC): ANALYST or ADMIN required for all document operations.
Phase 3 (Ingestion): ingestion_hardening.validate_saved_pdf() called after save.
"""
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.user_models import User, UserRole
from app.models.document import DocumentOut, ProcessResult
from app.services import auth_service, document_processing_service, document_service
from app.services.document_service import DocumentNotFoundError, UploadValidationError
from app.services.ingestion_hardening import validate_saved_pdf
from app.services.permissions import require_role

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_user),
):
    require_role(current_user, UserRole.ANALYST)

    if file is None or not file.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No file provided.")

    try:
        document_id, storage_path, original_filename = document_service.save_uploaded_pdf(file)
    except UploadValidationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    finally:
        file.file.close()

    # Phase 3: additional ingestion hardening on the saved file
    from app.core.config import settings as _settings
    saved_path = Path(_settings.storage_dir) / storage_path
    storage_root = Path(_settings.storage_dir)
    try:
        validate_saved_pdf(saved_path, storage_root)
    except UploadValidationError as exc:
        # Clean up the file that failed security checks
        try:
            saved_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    document = document_service.create_document(
        db,
        document_id=document_id,
        filename=original_filename,
        storage_path=storage_path,
        content_type=file.content_type,
    )
    return document


@router.get("", response_model=List[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_user),
):
    require_role(current_user, UserRole.ANALYST)
    return document_service.list_documents(db)


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_user),
):
    require_role(current_user, UserRole.ANALYST)
    try:
        return document_service.get_document(db, document_id)
    except DocumentNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post("/{document_id}/process", response_model=ProcessResult)
def process_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_user),
):
    require_role(current_user, UserRole.ANALYST)
    try:
        result = document_processing_service.process_document(db, document_id)
    except DocumentNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except document_processing_service.ProcessingError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    return result
