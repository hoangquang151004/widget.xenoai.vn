"""Webhook inbound WooCommerce / Shopify (MVP: cập nhật trạng thái đơn nếu khớp)."""

from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from db.session import async_session
from models.sales import SalesOrder

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks Sales"])


@router.post("/woocommerce/{tenant_id}")
async def woocommerce_webhook(tenant_id: UUID, request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    order_id = body.get("id") or (body.get("order") or {}).get("id")
    status = body.get("status") or (body.get("order") or {}).get("status")
    if not order_id:
        return {"received": True}
    ext_id = str(order_id)
    async with async_session() as session:
        r = await session.execute(
            select(SalesOrder).filter(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.external_order_id == ext_id,
            )
        )
        row = r.scalars().first()
        if row and status:
            row.status = str(status)[:30]
            row.updated_at = datetime.utcnow()
            if status in ("processing", "completed", "paid"):
                row.payment_status = "paid"
            await session.commit()
            logger.info("wc_webhook updated order local=%s ext=%s", row.id, ext_id)
    return {"received": True}


@router.post("/shopify/{tenant_id}")
async def shopify_webhook(tenant_id: UUID, request: Request):
    """MVP: no HMAC verify — chỉ log. Production cần verify X-Shopify-Hmac-Sha256."""
    logger.info("shopify_webhook tenant=%s", tenant_id)
    return {"received": True}
