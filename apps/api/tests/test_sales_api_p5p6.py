import uuid

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy import select

from db.session import async_session
from main import app
from models.sales import SalesOrder


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", timeout=30.0
    ) as client:
        yield client


async def _register_login(ac: httpx.AsyncClient) -> tuple[dict, str]:
    email = f"p5p6_{uuid.uuid4().hex[:8]}@example.com"
    reg = await ac.post(
        "/api/v1/admin/register",
        json={"name": "P5P6 Tenant", "email": email, "password": "P5P6_Pass1!"},
    )
    assert reg.status_code == 201, reg.text
    tenant_id = reg.json()["tenant_id"]

    login = await ac.post("/api/v1/admin/login", json={"email": email, "password": "P5P6_Pass1!"})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, tenant_id


@pytest.mark.asyncio
async def test_onboarding_complete_and_sync_status_endpoint(async_client):
    headers, _ = await _register_login(async_client)

    ob = await async_client.post(
        "/api/v1/admin/sales/onboarding/complete",
        headers=headers,
        json={"enable_sales": True, "action_mode": "lead", "bot_name": "Sales Bot"},
    )
    assert ob.status_code == 200, ob.text
    assert ob.json()["sales_enabled"] is True

    upsert = await async_client.post(
        "/api/v1/admin/sales/connector",
        headers=headers,
        json={
            "platform": "generic",
            "credentials": {"base_url": "https://api.shop.test", "auth_value": "x"},
            "config": {},
            "is_active": True,
        },
    )
    assert upsert.status_code == 200, upsert.text

    status = await async_client.get(
        "/api/v1/admin/sales/connector/sync-status?platform=generic",
        headers=headers,
    )
    assert status.status_code == 200, status.text
    payload = status.json()
    assert payload["platform"] == "generic"
    assert payload["sync_status"] in ("pending", "syncing", "ok", "error")


@pytest.mark.asyncio
async def test_chat_action_endpoint_requires_action(async_client):
    admin_headers, _ = await _register_login(async_client)
    me = await async_client.get("/api/v1/admin/me", headers=admin_headers)
    assert me.status_code == 200, me.text
    public_key = (
        me.json().get("public_key")
        or me.json().get("tenant", {}).get("public_key")
        or ""
    )
    assert public_key
    res = await async_client.post(
        "/api/v1/chat/action",
        headers={"X-Widget-Key": public_key},
        json={"query": "x"},
    )
    assert res.status_code == 400, res.text


async def _seed_order(tenant_id: str, mode: str) -> str:
    async with async_session() as session:
        order = SalesOrder(
            tenant_id=tenant_id,
            source_mode=mode,
            items=[],
            status="pending",
            payment_status="unpaid",
        )
        session.add(order)
        await session.commit()
        await session.refresh(order)
        return str(order.id)


@pytest.mark.asyncio
async def test_order_transition_reject_invalid_by_source_mode(async_client):
    headers, tenant_id = await _register_login(async_client)
    lead_id = await _seed_order(tenant_id, "lead")
    link_id = await _seed_order(tenant_id, "link")
    direct_id = await _seed_order(tenant_id, "direct")

    bad_lead = await async_client.patch(
        f"/api/v1/admin/sales/orders/{lead_id}/status",
        headers=headers,
        json={"status": "processing"},
    )
    bad_link = await async_client.patch(
        f"/api/v1/admin/sales/orders/{link_id}/status",
        headers=headers,
        json={"status": "confirmed"},
    )
    bad_direct = await async_client.patch(
        f"/api/v1/admin/sales/orders/{direct_id}/status",
        headers=headers,
        json={"status": "checkout_opened"},
    )

    assert bad_lead.status_code == 400, bad_lead.text
    assert bad_link.status_code == 400, bad_link.text
    assert bad_direct.status_code == 400, bad_direct.text

    async with async_session() as session:
        rows = (
            await session.execute(
                select(SalesOrder.id, SalesOrder.status).where(
                    SalesOrder.id.in_([lead_id, link_id, direct_id])
                )
            )
        ).all()
        assert {str(row[0]): row[1] for row in rows} == {
            lead_id: "pending",
            link_id: "pending",
            direct_id: "pending",
        }

