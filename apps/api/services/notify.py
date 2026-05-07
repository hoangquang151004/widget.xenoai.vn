"""Thông báo lead/đơn cho sales flow (email + webhook outbound)."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import smtplib
from email.message import EmailMessage

import httpx

from core.config import settings
from models.sales import SalesOrder
from models.tenant import Tenant

logger = logging.getLogger(__name__)


def _build_lead_payload(order: SalesOrder, tenant: Tenant) -> dict:
    return {
        "event": "new_lead",
        "tenant_id": str(tenant.id),
        "order_id": str(order.id),
        "customer": {
            "name": order.customer_name,
            "phone": order.customer_phone,
            "email": order.customer_email,
            "address": order.customer_address,
        },
        "items": order.items or [],
        "subtotal": int(order.subtotal) if order.subtotal is not None else None,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


def _sign_payload(payload: dict) -> str:
    secret = (settings.WEBHOOK_SECRET_KEY or "").strip()
    if not secret:
        return ""
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()


async def _send_webhook_with_retry(url: str, payload: dict) -> bool:
    backoffs = (0, 2, 5, 10)
    signature = _sign_payload(payload)
    headers = {"Content-Type": "application/json"}
    if signature:
        headers["X-Widget-Signature"] = signature

    for idx, wait_sec in enumerate(backoffs):
        if wait_sec:
            await asyncio.sleep(wait_sec)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if 200 <= resp.status_code < 300:
                    return True
                logger.warning(
                    "sales_notify webhook attempt=%s status=%s body=%s",
                    idx + 1,
                    resp.status_code,
                    resp.text[:300],
                )
        except Exception as exc:
            logger.warning("sales_notify webhook attempt=%s error=%s", idx + 1, exc)
    return False


def _resolve_notify_webhook_url(tenant: Tenant) -> str:
    # Hiện schema tenant chưa có cột webhook riêng cho sales.
    # Ưu tiên thuộc tính runtime nếu có, fallback env dùng chung.
    runtime = getattr(tenant, "webhook_url", None)
    if runtime:
        return str(runtime).strip()
    return str(settings.SALES_NOTIFY_WEBHOOK_URL or "").strip()


def _resolve_notify_email(tenant: Tenant) -> str:
    runtime = getattr(tenant, "notify_email", None)
    if runtime:
        return str(runtime).strip()
    configured = str(settings.SALES_NOTIFY_EMAIL_TO or "").strip()
    if configured:
        return configured
    return str(getattr(tenant, "email", "") or "").strip()


async def _send_email_new_lead(order: SalesOrder, tenant: Tenant, to_email: str) -> bool:
    smtp_host = str(settings.SMTP_HOST or "").strip()
    from_email = str(settings.SMTP_FROM_EMAIL or "").strip() or str(settings.SMTP_USERNAME or "").strip()
    if not smtp_host or not from_email or not to_email:
        return False

    subject = f"[Widget Sales] Lead mới #{order.id}"
    lines = [
        f"Tenant: {tenant.name} ({tenant.id})",
        f"Order ID: {order.id}",
        f"Khách: {order.customer_name or '-'}",
        f"SĐT: {order.customer_phone or '-'}",
        f"Email: {order.customer_email or '-'}",
        f"Địa chỉ: {order.customer_address or '-'}",
        f"Tạm tính: {int(order.subtotal) if order.subtotal is not None else 0} VND",
        "",
        "Items:",
        json.dumps(order.items or [], ensure_ascii=False, indent=2),
    ]
    body = "\n".join(lines)

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(body)

    def _send() -> None:
        with smtplib.SMTP(
            smtp_host,
            int(settings.SMTP_PORT),
            timeout=int(settings.SALES_NOTIFY_EMAIL_TIMEOUT_SEC or 20),
        ) as smtp:
            if bool(settings.SMTP_USE_TLS):
                smtp.starttls()
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)

    backoff_raw = str(settings.SALES_NOTIFY_EMAIL_RETRY_BACKOFF or "0,2,5,10")
    backoffs: list[int] = []
    for token in backoff_raw.split(","):
        token = token.strip()
        if not token:
            continue
        try:
            backoffs.append(max(0, int(token)))
        except ValueError:
            continue
    if not backoffs:
        backoffs = [0, 2, 5, 10]

    err_type = ""
    try:
        for idx, wait_sec in enumerate(backoffs):
            if wait_sec:
                await asyncio.sleep(wait_sec)
            try:
                await asyncio.to_thread(_send)
                return True
            except Exception as exc:
                err_type = type(exc).__name__
                logger.warning(
                    "sales_notify email_attempt_failed tenant_id=%s order_id=%s attempt=%s error_type=%s",
                    tenant.id,
                    order.id,
                    idx + 1,
                    err_type,
                )
    except Exception:
        # Defensive fallback: không được crash flow chat vì notify.
        pass
    logger.error(
        "sales_notify email_failed tenant_id=%s order_id=%s attempts=%s last_error_type=%s",
        tenant.id,
        order.id,
        len(backoffs),
        err_type or "UnknownError",
    )
    return False


async def notify_new_lead(order: SalesOrder, tenant: Tenant) -> None:
    logger.info(
        "sales_notify event=new_lead tenant_id=%s order_id=%s phone=%s",
        tenant.id,
        order.id,
        order.customer_phone,
    )
    notify_email = _resolve_notify_email(tenant)
    if notify_email:
        sent = await _send_email_new_lead(order, tenant, notify_email)
        if sent:
            logger.info("sales_notify email_sent tenant_id=%s order_id=%s", tenant.id, order.id)

    webhook_url = _resolve_notify_webhook_url(tenant)
    if webhook_url:
        payload = _build_lead_payload(order, tenant)
        ok = await _send_webhook_with_retry(str(webhook_url), payload)
        if ok:
            logger.info("sales_notify webhook_sent tenant_id=%s order_id=%s", tenant.id, order.id)
        else:
            logger.error("sales_notify webhook_failed tenant_id=%s order_id=%s", tenant.id, order.id)


async def notify_payment_update(order: SalesOrder, tenant: Tenant) -> None:
    logger.info(
        "sales_notify event=payment tenant_id=%s order_id=%s status=%s",
        tenant.id,
        order.id,
        order.payment_status,
    )
