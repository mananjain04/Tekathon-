"""
Document routes: upload, list, get, process. Kept thin -- validation and
orchestration live in app/services/*.
"""
import uuid
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.document import DocumentOut, ProcessResult
from app.services import document_processing_service, document_service
from app.services.document_service import DocumentNotFoundError, UploadValidationError

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if file is None or not file.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No file provided.")

    try:
        document_id, storage_path, original_filename = document_service.save_uploaded_pdf(file)
    except UploadValidationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    finally:
        file.file.close()

    document = document_service.create_document(
        db,
        document_id=document_id,
        filename=original_filename,
        storage_path=storage_path,
        content_type=file.content_type,
    )
    return document


@router.get("", response_model=List[DocumentOut])
def list_documents(db: Session = Depends(get_db)):
    return document_service.list_documents(db)


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        return document_service.get_document(db, document_id)
    except DocumentNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post("/{document_id}/process", response_model=ProcessResult)
def process_document(document_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        result = document_processing_service.process_document(db, document_id)
    except DocumentNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except document_processing_service.ProcessingError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    return result
