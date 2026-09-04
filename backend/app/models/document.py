"""
Pydantic (API) schemas for documents. Kept separate from the SQLAlchemy
ORM models in app/db/models.py.
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.db.models import DocumentStatus


class DocumentOut(BaseModel):
    """
    Public representation of a Document. Deliberately omits storage_path
    (an internal filesystem detail) to avoid exposing server paths.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    status: DocumentStatus
    content_type: Optional[str] = None
    page_count: Optional[int] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProcessResult(BaseModel):
    document_id: uuid.UUID
    status: DocumentStatus
    pages_processed: int
    pages_ocr: int
    chunks_created: int
