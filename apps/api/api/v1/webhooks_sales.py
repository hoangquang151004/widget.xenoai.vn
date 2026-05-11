"""Webhook inbound WooCommerce / Shopify (MVP: cập nhật trạng thái đơn nếu khớp)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from db.session import async_session
from core.config import settings
from models.sales import SalesOrder
from models.tenant import Tenant
from services.notify import notify_payment_update

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks Sales"])


def _require_webhook_secret() -> str:
    secret = (settings.WEBHOOK_SECRET_KEY or "").strip()
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="Webhook secret chưa được cấu hình.",
        )
    return secret


def _verify_wc_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, (signature or "").strip())


def _verify_shopify_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    mac = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    expected = base64.b64encode(mac).decode("utf-8")
    return hmac.compare_digest(expected, (signature or "").strip())


def _map_paid_status(source_mode: str, raw_status: str) -> str:
    mode = str(source_mode or "").lower()
    rs = str(raw_status or "").lower()
    if mode == "link":
        if rs in ("paid", "completed", "processing"):
            return "paid"
        if rs in ("cancelled", "failed", "abandoned"):
            return "abandoned"
        return "checkout_opened"
    if mode == "direct":
        if rs in ("processing", "confirmed", "paid"):
            return "processing"
        if rs in ("completed", "delivered"):
            return "delivered"
        if rs in ("cancelled", "failed", "refunded"):
            return "cancelled"
        return "confirmed"
    if rs in ("paid", "completed", "processing"):
        return "paid"
    if rs in ("cancelled", "failed", "abandoned"):
        return "lost"
    return "contacted"


@router.post("/woocommerce/{tenant_id}")
async def woocommerce_webhook(tenant_id: UUID, request: Request):
    secret = _require_webhook_secret()
    raw_body = await request.body()
    signature = request.headers.get("X-WC-Webhook-Signature", "")
    if not _verify_wc_signature(raw_body, signature, secret):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    try:
        body = await request.json()
    except Exception:
        body = {}
    order_id = body.get("id") or (body.get("order") or {}).get("id")
    status = body.get("status") or (body.get("order") or {}).get("status")
    if not order_id:
        return {"received": True}
    ext_id = str(order_id)
    should_notify_payment = False
    async with async_session() as session:
        r = await session.execute(
            select(SalesOrder).filter(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.external_order_id == ext_id,
            )
        )
        row = r.scalars().first()
        if row and status:
            prev_payment_status = str(row.payment_status or "").lower()
            row.status = _map_paid_status(row.source_mode, str(status))[:30]
            row.updated_at = datetime.utcnow()
            if status in ("processing", "completed", "paid"):
                row.payment_status = "paid"
            should_notify_payment = prev_payment_status != "paid" and str(row.payment_status).lower() == "paid"
            await session.commit()
            logger.info("wc_webhook updated order local=%s ext=%s", row.id, ext_id)
            if should_notify_payment:
                tenant = await session.get(Tenant, tenant_id)
                if tenant is not None:
                    await notify_payment_update(row, tenant)
    return {"received": True}


@router.post("/shopify/{tenant_id}")
async def shopify_webhook(tenant_id: UUID, request: Request):
    secret = _require_webhook_secret()
    raw_body = await request.body()
    signature = request.headers.get("X-Shopify-Hmac-Sha256", "")
    if not _verify_shopify_signature(raw_body, signature, secret):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        body = await request.json()
    except Exception:
        body = {}
    order_id = body.get("id") or (body.get("order") or {}).get("id")
    if order_id:
        async with async_session() as session:
            r = await session.execute(
                select(SalesOrder).filter(
                    SalesOrder.tenant_id == tenant_id,
                    SalesOrder.external_order_id == str(order_id),
                )
            )
            row = r.scalars().first()
            if row:
                prev_payment_status = str(row.payment_status or "").lower()
                financial_status = (
                    body.get("financial_status")
                    or (body.get("order") or {}).get("financial_status")
                    or ""
                )
                if str(financial_status).lower() in ("paid", "partially_paid"):
                    row.payment_status = "paid"
                    row.status = _map_paid_status(row.source_mode, "paid")
                    row.updated_at = datetime.utcnow()
                    await session.commit()
                    logger.info("shopify_webhook updated order local=%s ext=%s", row.id, order_id)
                    if prev_payment_status != "paid":
                        tenant = await session.get(Tenant, tenant_id)
                        if tenant is not None:
                            await notify_payment_update(row, tenant)
    return {"received": True}
