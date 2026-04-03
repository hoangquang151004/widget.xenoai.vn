"""cleanup_legacy_tenants_columns

Revision ID: f2a4d1c7b9e0
Revises: e99a6b0ac34c
Create Date: 2026-04-03 16:25:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f2a4d1c7b9e0"
down_revision: Union[str, Sequence[str], None] = "e99a6b0ac34c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    table_name = "tenants"
    tables = set(inspector.get_table_names(schema="public"))
    if table_name not in tables:
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns(table_name, schema="public")
    }
    existing_indexes = {
        index["name"] for index in inspector.get_indexes(table_name, schema="public")
    }

    legacy_indexes = [
        "ix_tenants_slug",
        "ix_tenants_public_key",
        "ix_tenants_secret_key",
    ]
    for index_name in legacy_indexes:
        if index_name in existing_indexes:
            op.drop_index(index_name, table_name=table_name)

    legacy_columns = [
        "slug",
        "public_key",
        "secret_key",
        "allowed_origins",
        "widget_color",
        "widget_placeholder",
        "widget_position",
        "widget_welcome_message",
        "widget_avatar_url",
        "widget_font_size",
        "widget_show_logo",
        "system_prompt",
        "is_rag_enabled",
        "is_sql_enabled",
    ]
    for column_name in legacy_columns:
        if column_name in existing_columns:
            op.drop_column(table_name, column_name)


def downgrade() -> None:
    """No-op downgrade for destructive cleanup migration."""
    pass
