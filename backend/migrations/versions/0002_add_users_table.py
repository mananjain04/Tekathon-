"""add users table and user_role_enum

Revision ID: 0002_add_users_table
Revises: 0001_initial_schema
Create Date: 2026-09-05

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0002_add_users_table"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None

user_role_enum = pg.ENUM(
    "VIEWER",
    "ANALYST",
    "ADMIN",
    name="user_role_enum",
    create_type=False,
)


def upgrade() -> None:
    user_role_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(512), nullable=False),
        sa.Column("role", user_role_enum, nullable=False, server_default="VIEWER"),
        sa.Column("is_active", sa.String(1), nullable=False, server_default="Y"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("ix_users_username", "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
    user_role_enum.drop(op.get_bind(), checkfirst=True)
