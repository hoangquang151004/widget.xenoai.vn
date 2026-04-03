"""reconcile_missing_revision

Revision ID: b7c1d2e3f4a5
Revises: 9f7e1a2b3c4d
Create Date: 2026-04-02 17:20:00

This is a bridge revision to reconcile environments where alembic_version
already points to b7c1d2e3f4a5 but the file is missing in the repository.
"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "b7c1d2e3f4a5"
down_revision: Union[str, Sequence[str], None] = "9f7e1a2b3c4d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op bridge migration."""
    return


def downgrade() -> None:
    """No-op bridge migration."""
    return
