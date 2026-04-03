"""add_pgvector_chunks_table

Revision ID: c3f8a7d6e5b4
Revises: b7c1d2e3f4a5
Create Date: 2026-04-02 17:26:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = "c3f8a7d6e5b4"
down_revision: Union[str, Sequence[str], None] = "b7c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    ext_available = bind.execute(
        sa.text("SELECT 1 FROM pg_available_extensions WHERE name = 'vector'")
    ).scalar()
    if not ext_available:
        raise RuntimeError(
            "PostgreSQL extension 'vector' is not installed on this server. "
            "Install pgvector at DB server level, then rerun: alembic upgrade head."
        )

    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "tenant_document_chunks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=True),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(3072), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["tenant_documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_tenant_document_chunks_tenant_id",
        "tenant_document_chunks",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        "ix_tenant_document_chunks_document_id",
        "tenant_document_chunks",
        ["document_id"],
        unique=False,
    )
    op.create_index(
        "ix_tenant_document_chunks_source",
        "tenant_document_chunks",
        ["source"],
        unique=False,
    )

    # Skip ANN index creation for 3072-d embeddings.
    # ivfflat on vector currently supports up to 2000 dims.

    op.execute("ALTER TABLE tenant_documents DROP COLUMN IF EXISTS qdrant_ids")


def downgrade() -> None:
    op.add_column(
        "tenant_documents",
        sa.Column("qdrant_ids", sa.ARRAY(sa.String()), nullable=True),
    )

    op.drop_index("ix_tenant_document_chunks_source", table_name="tenant_document_chunks")
    op.drop_index("ix_tenant_document_chunks_document_id", table_name="tenant_document_chunks")
    op.drop_index("ix_tenant_document_chunks_tenant_id", table_name="tenant_document_chunks")
    op.drop_table("tenant_document_chunks")
