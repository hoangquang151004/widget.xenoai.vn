import uuid

import httpx
import pytest
from httpx import ASGITransport

from services.sales import chat_handler
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


async def _admin_headers(ac: httpx.AsyncClient) -> dict:
    email = f"sales_api_{uuid.uuid4().hex[:10]}@example.com"
    reg = await ac.post(
        "/api/v1/admin/register",
        json={"name": "Sales API Tenant", "email": email, "password": "Sales_Api_Pass1!"},
    )
    assert reg.status_code == 201, reg.text
    login = await ac.post("/api/v1/admin/login", json={"email": email, "password": "Sales_Api_Pass1!"})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _seed_order(tenant_id: str, mode: str = "direct") -> str:
    async with async_session() as session:
        order = SalesOrder(
            tenant_id=tenant_id,
            source_mode=mode,
            items=[{"name": "SP1", "quantity": 1, "price": 100000}],
            customer_name="A",
            customer_phone="0909",
            customer_address="HN",
            status="pending",
            payment_status="unpaid",
        )
        session.add(order)
        await session.commit()
        await session.refresh(order)
        return str(order.id)


async def _enable_sales_and_get_public_key(ac: httpx.AsyncClient, headers: dict) -> str:
    ob = await ac.post(
        "/api/v1/admin/sales/onboarding/complete",
        headers=headers,
        json={"enable_sales": True, "action_mode": "lead", "bot_name": "Contract Bot"},
    )
    assert ob.status_code == 200, ob.text
    cfg = await ac.put(
        "/api/v1/admin/sales/widget-config",
        headers=headers,
        json={"bot_name": "Contract Bot", "action_mode": "lead"},
    )
    assert cfg.status_code == 200, cfg.text
    connector = await ac.post(
        "/api/v1/admin/sales/connector",
        headers=headers,
        json={
            "platform": "generic",
            "credentials": {"base_url": "https://api.shop.test", "auth_value": "x"},
            "config": {},
            "is_active": True,
        },
    )
    assert connector.status_code == 200, connector.text
    me = await ac.get("/api/v1/admin/me", headers=headers)
    assert me.status_code == 200, me.text
    payload = me.json()
    key = payload.get("public_key") or payload.get("tenant", {}).get("public_key")
    assert key
    return key


@pytest.mark.asyncio
async def test_sales_orders_filters_and_status_transition(async_client):
    headers = await _admin_headers(async_client)
    me = await async_client.get("/api/v1/admin/me", headers=headers)
    assert me.status_code == 200, me.text
    me_payload = me.json()
    tenant_id = (
        me_payload.get("tenant", {}).get("id")
        or me_payload.get("id")
        or me_payload.get("tenant_id")
    )
    assert tenant_id
    order_id = await _seed_order(tenant_id)

    list_res = await async_client.get(
        "/api/v1/admin/sales/orders?q=0909&status=pending&source_mode=lead&page=1&per_page=20",
        headers=headers,
    )
    assert list_res.status_code == 200, list_res.text
    assert isinstance(list_res.json().get("items"), list)

    bad = await async_client.patch(
        f"/api/v1/admin/sales/orders/{order_id}/status",
        headers=headers,
        json={"status": "shipped"},
    )
    assert bad.status_code == 400, bad.text


@pytest.mark.asyncio
async def test_chat_sales_contract_shape_submit_form(async_client, monkeypatch):
    headers = await _admin_headers(async_client)
    public_key = await _enable_sales_and_get_public_key(async_client, headers)
    slot_store = {}

    async def _fake_get_slot(_tenant_id, _session_id):  # noqa: ANN001
        return slot_store.get((_tenant_id, _session_id), chat_handler.SalesSlotState())

    async def _fake_save_slot(_tenant_id, _session_id, state):  # noqa: ANN001
        slot_store[(_tenant_id, _session_id)] = state

    async def _fake_notify(_order, _tenant):  # noqa: ANN001
        return None

    monkeypatch.setattr(chat_handler, "get_slot", _fake_get_slot)
    monkeypatch.setattr(chat_handler, "save_slot", _fake_save_slot)
    monkeypatch.setattr(chat_handler, "notify_new_lead", _fake_notify)

    res = await async_client.post(
        "/api/v1/chat/action",
        headers={"X-Widget-Key": public_key},
        json={
            "session_id": "contract-s1",
            "action": {
                "type": "submit_form",
                "data": {"name": "A", "phone": "0909", "address": "HN"},
            },
        },
    )
    assert res.status_code == 200, res.text
    payload = res.json()
    assert isinstance(payload.get("text"), str)
    assert isinstance(payload.get("ui_components"), list)
    assert isinstance(payload.get("slots"), dict)
    assert isinstance(payload.get("metadata"), dict)
    # backward-compatible keys vẫn tồn tại trong giai đoạn chuyển tiếp.
    assert payload.get("content") == payload.get("text")
