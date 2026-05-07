"""Đồng bộ sản phẩm định kỳ (Celery)."""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from sqlalchemy import select

from db.session import async_session
from models.sales import PlatformConnector
from services.sales.product_sync import sync_connector_products
from worker.celery_app import celery_app
from worker.tasks.document_tasks import run_async_task

logger = logging.getLogger(__name__)


async def _sync_tenant_platform(tenant_id: str, platform: str, index_qdrant: bool) -> int:
    tid = UUID(tenant_id)
    async with async_session() as session:
        r = await session.execute(
            select(PlatformConnector).filter(
                PlatformConnector.tenant_id == tid,
                PlatformConnector.platform == platform,
                PlatformConnector.is_active == True,
            )
        )
        row = r.scalars().first()
        if not row:
            return 0
        return await sync_connector_products(session, tid, row, index_qdrant=index_qdrant)


@celery_app.task(name="sync_products_for_tenant", bind=True, max_retries=2)
def sync_products_for_tenant(self, tenant_id: str, platform: str = "woocommerce", index_qdrant: bool = True):
    try:
        n = run_async_task(_sync_tenant_platform(tenant_id, platform, index_qdrant))
        logger.info("sync_products_for_tenant tenant=%s n=%s", tenant_id, n)
        return n
    except Exception as e:
        logger.exception("sync_products_for_tenant")
        raise self.retry(exc=e, countdown=60)


async def _sync_all_active_async() -> int:
    async with async_session() as session:
        r = await session.execute(
            select(PlatformConnector).filter(PlatformConnector.is_active == True)
        )
        rows = r.scalars().all()
    total = 0
    for c in rows:
        try:
            n = await _sync_tenant_platform(str(c.tenant_id), c.platform, index_qdrant=True)
            total += n
        except Exception:
            logger.exception("sync row tenant=%s", c.tenant_id)
    return total


@celery_app.task(name="sync_all_active_product_connectors")
def sync_all_active_product_connectors():
    return run_async_task(_sync_all_active_async())
