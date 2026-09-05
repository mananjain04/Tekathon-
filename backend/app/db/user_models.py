"""
app/db/user_models.py — User ORM model for KAVACH authentication.

Kept separate from the existing document/page/chunk ORM models
(app/db/models.py) to avoid touching that file (preserve existing tests).
All models share the same Base from app.db.database.

Roles (3 demo-scoped roles as specified in Phase 2):
  VIEWER  — can query only (POST /api/rag/query, POST /api/retrieval/search)
  ANALYST — upload + query (all VIEWER permissions + upload/process)
  ADMIN   — everything + read audit health endpoint
"""
import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base


class UserRole(str, enum.Enum):
    VIEWER = "VIEWER"
    ANALYST = "ANALYST"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(255), unique=True, index=True, nullable=False)
    # Argon2id hash — never plaintext
    hashed_password = Column(String(512), nullable=False)
    role = Column(
        Enum(UserRole, name="user_role_enum"),
        nullable=False,
        default=UserRole.VIEWER,
    )
    is_active = Column(
        # Allows an admin to disable a user without deleting them.
        # Checked in get_current_user; disabled users get 403.
        String(1), nullable=False, default="Y"
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
