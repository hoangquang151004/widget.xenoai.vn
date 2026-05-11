import base64
import hashlib
import hmac
import json
import uuid
from uuid import UUID

import httpx
import pytest
from httpx import ASGITransport

from core.config import settings
from db.session import async_session
from main import app
from api.v1 import webhooks_sales
from models.sales import SalesOrder


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", timeout=30.0
    ) as client:
        yield client


async def _create_tenant(async_client: httpx.AsyncClient) -> UUID:
    email = f"wh_{uuid.uuid4().hex[:8]}@example.com"
    reg = await async_client.post(
        "/api/v1/admin/register",
        json={"name": "Webhook Tenant", "email": email, "password": "Webhook_Pass1!"},
    )
    assert reg.status_code == 201, reg.text
    return UUID(reg.json()["tenant_id"])


async def _create_order(tenant_id: UUID, external_order_id: str) -> UUID:
    async with async_session() as session:
        order = SalesOrder(
            tenant_id=tenant_id,
            source_mode="lead",
            items=[],
            external_order_id=external_order_id,
            status="pending",
            payment_status="unpaid",
        )
        session.add(order)
        await session.commit()
        await session.refresh(order)
        return order.id


@pytest.mark.asyncio
async def test_wc_webhook_invalid_signature_rejected(async_client):
    tenant_id = await _create_tenant(async_client)
    await _create_order(tenant_id, "123")
    old = settings.WEBHOOK_SECRET_KEY
    settings.WEBHOOK_SECRET_KEY = "test_secret"
    try:
        payload = {"id": "123", "status": "processing"}
        body = json.dumps(payload)
        r = await async_client.post(
            f"/api/v1/webhooks/woocommerce/{tenant_id}",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-WC-Webhook-Signature": "bad-signature",
            },
        )
        assert r.status_code == 401, r.text
    finally:
        settings.WEBHOOK_SECRET_KEY = old


@pytest.mark.asyncio
async def test_shopify_webhook_valid_signature_updates_paid(async_client):
    tenant_id = await _create_tenant(async_client)
    order_id = await _create_order(tenant_id, "555")
    old = settings.WEBHOOK_SECRET_KEY
    settings.WEBHOOK_SECRET_KEY = "test_secret"
    try:
        payload = {"id": "555", "financial_status": "paid"}
        body = json.dumps(payload).encode("utf-8")
        mac = hmac.new(
            settings.WEBHOOK_SECRET_KEY.encode("utf-8"),
            body,
            hashlib.sha256,
        ).digest()
        sig = base64.b64encode(mac).decode("utf-8")
        r = await async_client.post(
            f"/api/v1/webhooks/shopify/{tenant_id}",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Shopify-Hmac-Sha256": sig,
            },
        )
        assert r.status_code == 200, r.text

        async with async_session() as session:
            row = await session.get(SalesOrder, order_id)
            assert row is not None
            assert row.payment_status == "paid"
            assert row.status == "paid"
    finally:
        settings.WEBHOOK_SECRET_KEY = old


@pytest.mark.asyncio
async def test_shopify_webhook_paid_triggers_notify_side_effect(async_client, monkeypatch):
    tenant_id = await _create_tenant(async_client)
    await _create_order(tenant_id, "777")
    old = settings.WEBHOOK_SECRET_KEY
    settings.WEBHOOK_SECRET_KEY = "test_secret"
    calls = {"count": 0, "order_id": None}

    async def _fake_notify(order, tenant):  # noqa: ANN001
        calls["count"] += 1
        calls["order_id"] = str(order.external_order_id)
        assert str(tenant.id) == str(tenant_id)

    monkeypatch.setattr(webhooks_sales, "notify_payment_update", _fake_notify)
    try:
        payload = {"id": "777", "financial_status": "paid"}
        body = json.dumps(payload).encode("utf-8")
        mac = hmac.new(
            settings.WEBHOOK_SECRET_KEY.encode("utf-8"),
            body,
            hashlib.sha256,
        ).digest()
        sig = base64.b64encode(mac).decode("utf-8")
        r = await async_client.post(
            f"/api/v1/webhooks/shopify/{tenant_id}",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Shopify-Hmac-Sha256": sig,
            },
        )
        assert r.status_code == 200, r.text
        assert calls["count"] == 1
        assert calls["order_id"] == "777"
    finally:
        settings.WEBHOOK_SECRET_KEY = old
