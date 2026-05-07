"""Đồng bộ sản phẩm từ connector vào bảng products (+ optional Qdrant)."""

from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai.vector_store import SaaSVectorStore
from models.sales import PlatformConnector, Product
from services.connectors.factory import get_connector

logger = logging.getLogger(__name__)


async def index_products_qdrant(tenant_id: str, products: list[Product]) -> None:
    if not products:
        return
    store = SaaSVectorStore(tenant_id)
    texts = []
    metas = []
    for p in products:
        desc = (p.description or "")[:2000]
        text = f"{p.name}. {desc} Giá: {p.price or 0}đ. Danh mục: {p.category or ''}."
        texts.append(text)
        metas.append(
            {
                "kind": "product",
                "product_id": str(p.id),
                "external_id": p.external_id,
                "name": p.name,
                "price": int(p.price) if p.price is not None else None,
                "in_stock": p.in_stock,
            }
        )
    try:
        await store.upsert_documents(texts, metas)
    except Exception:
        logger.exception("Qdrant index products failed tenant=%s", tenant_id)


async def sync_connector_products(
    db: AsyncSession,
    tenant_id: UUID,
    connector_row: PlatformConnector,
    index_qdrant: bool = False,
) -> int:
    """Fetch all pages from connector, upsert Product rows. Returns count upserted."""
    conn = get_connector(connector_row)
    ok, err = await conn.test_connection()
    if not ok:
        raise RuntimeError(err or "Connector test failed")

    connector_row.sync_status = "syncing"
    connector_row.sync_error = None
    await db.commit()

    page = 1
    total = 0
    touched: list[Product] = []
    try:
        while True:
            batch = await conn.fetch_products(page=page, per_page=100)
            if not batch:
                break
            for pd in batch:
                result = await db.execute(
                    select(Product).filter(
                        Product.tenant_id == tenant_id,
                        Product.platform == connector_row.platform,
                        Product.external_id == pd.external_id,
                    )
                )
                existing = result.scalars().first()
                if existing:
                    existing.name = pd.name
                    existing.description = pd.description
                    existing.price = pd.price
                    existing.compare_price = pd.compare_price
                    existing.sku = pd.sku
                    existing.stock_quantity = pd.stock_quantity
                    existing.in_stock = pd.in_stock
                    existing.images = pd.images
                    existing.variants = pd.variants
                    existing.tags = pd.tags
                    existing.category = pd.category
                    existing.raw_data = pd.raw_data
                    existing.updated_at = datetime.utcnow()
                    touched.append(existing)
                else:
                    pr = Product(
                        tenant_id=tenant_id,
                        external_id=pd.external_id,
                        platform=connector_row.platform,
                        name=pd.name,
                        description=pd.description,
                        price=pd.price,
                        compare_price=pd.compare_price,
                        sku=pd.sku,
                        stock_quantity=pd.stock_quantity,
                        in_stock=pd.in_stock,
                        images=pd.images,
                        variants=pd.variants,
                        tags=pd.tags,
                        category=pd.category,
                        raw_data=pd.raw_data,
                    )
                    db.add(pr)
                    await db.flush()
                    touched.append(pr)
                total += 1
            if len(batch) < 100:
                break
            page += 1

        connector_row.sync_status = "ok"
        connector_row.last_synced_at = datetime.utcnow()
        connector_row.sync_error = None
        await db.commit()

        if index_qdrant and touched:
            await index_products_qdrant(str(tenant_id), touched)
            for p in touched:
                p.vector_synced = True
            await db.commit()

    except Exception as e:
        connector_row.sync_status = "error"
        connector_row.sync_error = str(e)[:2000]
        await db.commit()
        raise

    return total
