"""v2_create_new_schema

Revision ID: e99a6b0ac34c
Revises: 1ca289585fb8
Create Date: 2026-04-03 09:44:25.164899

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e99a6b0ac34c'
down_revision: Union[str, Sequence[str], None] = '1ca289585fb8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op by design after review: keep legacy objects for safe transition."""
    pass


def downgrade() -> None:
    """No-op downgrade for safety."""
    pass
