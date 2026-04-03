"""
Alembic env.py — configured for async SQLAlchemy (asyncpg) + auto-import models.
"""
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ── Import models so Alembic can detect them ──────────────────────────────────
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from models import Base

# We use a single declarative Base; collect all metadata
target_metadata = Base.metadata

# ── Alembic config ────────────────────────────────────────────────────────────
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url from our app settings at runtime
from core.config import settings  # noqa: E402

db_url = str(settings.SQLALCHEMY_DATABASE_URI or settings.get_database_url)

# ── Offline migrations ────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (generates SQL script)."""
    # For offline, we might need a sync URL or just use the current one
    url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online migrations (async) ─────────────────────────────────────────────────
def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create async engine and run migrations."""
    from sqlalchemy.ext.asyncio import create_async_engine
    
    connectable = create_async_engine(
        db_url,
        poolclass=pool.NullPool,
    )
    
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
