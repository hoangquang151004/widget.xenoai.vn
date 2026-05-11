import time
import uuid
from types import SimpleNamespace

import httpx
import pytest
from httpx import ASGITransport

from api.v1 import admin_sales
from db.session import async_session
from main import app
from models.sales import Product, SalesOrder
from services.sales import chat_handler


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", timeout=30.0
    ) as client:
        yield client


async def _register_login(ac: httpx.AsyncClient, prefix: str = "p9") -> tuple[dict, str]:
    email = f"{prefix}_{uuid.uuid4().hex[:10]}@example.com"
    reg = await ac.post(
        "/api/v1/admin/register",
        json={"name": f"{prefix} tenant", "email": email, "password": "P9_Pass1!"},
    )
    assert reg.status_code == 201, reg.text
    tenant_id = reg.json()["tenant_id"]

    login = await ac.post("/api/v1/admin/login", json={"email": email, "password": "P9_Pass1!"})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, tenant_id


async def _public_key(ac: httpx.AsyncClient, admin_headers: dict) -> str:
    me = await ac.get("/api/v1/admin/me", headers=admin_headers)
    assert me.status_code == 200, me.text
    payload = me.json()
    key = payload.get("public_key") or payload.get("tenant", {}).get("public_key")
    assert key
    return key


async def _setup_sales_tenant(
    ac: httpx.AsyncClient, mode: str, platform: str = "woocommerce"
) -> tuple[dict, str, str]:
    headers, tenant_id = await _register_login(ac, f"p9_{mode}_{platform}")
    ob = await ac.post(
        "/api/v1/admin/sales/onboarding/complete",
        headers=headers,
        json={"enable_sales": True, "action_mode": mode, "bot_name": "P9 Sales Bot"},
    )
    assert ob.status_code == 200, ob.text
    # Đảm bảo widget config tồn tại cho mọi mode (lead/link/direct).
    cfg = await ac.put(
        "/api/v1/admin/sales/widget-config",
        headers=headers,
        json={"bot_name": "P9 Sales Bot", "action_mode": mode},
    )
    assert cfg.status_code == 200, cfg.text

    creds = {
        "woocommerce": {
            "site_url": "https://shop.test",
            "consumer_key": "ck",
            "consumer_secret": "cs",
        },
        "shopify": {"shop_domain": "myshop.myshopify.com", "access_token": "tok"},
        "generic": {"base_url": "https://api.shop.test", "auth_value": "tok"},
    }[platform]
    upsert = await ac.post(
        "/api/v1/admin/sales/connector",
        headers=headers,
        json={"platform": platform, "credentials": creds, "config": {}, "is_active": True},
    )
    assert upsert.status_code == 200, upsert.text
    return headers, tenant_id, await _public_key(ac, headers)


async def _seed_product(tenant_id: str) -> str:
    async with async_session() as session:
        p = Product(
            tenant_id=tenant_id,
            external_id=f"ext_{uuid.uuid4().hex[:8]}",
            platform="woocommerce",
            name="Ao polo",
            price=120000,
            in_stock=True,
            stock_quantity=10,
        )
        session.add(p)
        await session.commit()
        await session.refresh(p)
        return str(p.id)


async def _sales_action(
    ac: httpx.AsyncClient, public_key: str, session_id: str, action_type: str, data: dict
):
    return await ac.post(
        "/api/v1/chat/action",
        headers={"X-Widget-Key": public_key},
        json={"session_id": session_id, "action": {"type": action_type, "data": data}},
    )


def _use_local_slot_store(monkeypatch):
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


@pytest.mark.asyncio
async def test_scenario_a_mode_c_full_chat_form_to_dashboard(async_client, monkeypatch):
    headers, tenant_id, public_key = await _setup_sales_tenant(async_client, mode="lead")
    _use_local_slot_store(monkeypatch)

    res = await _sales_action(
        async_client,
        public_key,
        "p9-a",
        "submit_form",
        {"name": "Nguyen Van A", "phone": "0909123456", "address": "Ha Noi"},
    )
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload.get("metadata", {}).get("intent") == "submit_form"
    assert isinstance(payload.get("text"), str)
    assert isinstance(payload.get("ui_components"), list)
    assert isinstance(payload.get("slots"), dict)
    assert any(c.get("type") == "order_confirmation" for c in payload.get("ui_components", []))

    orders = await async_client.get("/api/v1/admin/sales/orders?q=0909123456", headers=headers)
    assert orders.status_code == 200, orders.text
    assert any(i.get("source_mode") == "lead" for i in orders.json().get("items", []))

    async with async_session() as session:
        rows = (
            await session.execute(
                SalesOrder.__table__.select().where(SalesOrder.tenant_id == tenant_id)
            )
        ).all()
        assert rows


@pytest.mark.asyncio
async def test_scenario_b_mode_a_checkout_link(async_client, monkeypatch):
    headers, tenant_id, public_key = await _setup_sales_tenant(
        async_client, mode="link", platform="shopify"
    )
    assert headers and tenant_id
    _use_local_slot_store(monkeypatch)
    product_id = await _seed_product(tenant_id)

    class _FakeConnector:
        async def generate_cart_link(self, _items):
            return SimpleNamespace(url="https://shop.test/cart/checkout-link")

    monkeypatch.setattr(chat_handler, "get_connector", lambda _conn: _FakeConnector())

    out_add = await chat_handler.handle_sales_chat(
        tenant_id=tenant_id,
        session_id="p9-b",
        query="",
        action={"type": "add_to_cart", "data": {"product_id": product_id, "quantity": 1}},
        persist_messages=False,
    )
    assert out_add["intent"] == "add_to_cart"

    submit = await chat_handler.handle_sales_chat(
        tenant_id=tenant_id,
        session_id="p9-b",
        query="",
        action={"type": "submit_form", "data": {"name": "B", "phone": "0911", "address": "HCM"}},
        persist_messages=False,
    )
    components = submit.get("ui_components", [])
    assert any(c.get("type") == "checkout_link" for c in components)


@pytest.mark.asyncio
async def test_scenario_c_mode_b_direct_order(async_client, monkeypatch):
    _, tenant_id, public_key = await _setup_sales_tenant(
        async_client, mode="direct", platform="woocommerce"
    )
    assert public_key
    _use_local_slot_store(monkeypatch)
    product_id = await _seed_product(tenant_id)

    class _FakeConnector:
        async def create_order(self, _payload):
            return SimpleNamespace(
                success=True,
                external_order_id="wc_1001",
                external_order_url="https://shop.test/orders/1001",
                error=None,
            )

    monkeypatch.setattr(chat_handler, "get_connector", lambda _conn: _FakeConnector())

    out_add = await chat_handler.handle_sales_chat(
        tenant_id=tenant_id,
        session_id="p9-c",
        query="",
        action={"type": "add_to_cart", "data": {"product_id": product_id, "quantity": 2}},
        persist_messages=False,
    )
    assert out_add["intent"] == "add_to_cart"

    submit = await chat_handler.handle_sales_chat(
        tenant_id=tenant_id,
        session_id="p9-c",
        query="",
        action={"type": "submit_form", "data": {"name": "C", "phone": "0922", "address": "DN"}},
        persist_messages=False,
    )
    assert any(c.get("type") == "order_confirmation" for c in submit["ui_components"])

    async with async_session() as session:
        row = (
            (
                await session.execute(
                    SalesOrder.__table__.select()
                    .where(SalesOrder.tenant_id == tenant_id)
                    .order_by(SalesOrder.created_at.desc())
                )
            )
            .mappings()
            .first()
        )
        assert row is not None
        assert row["status"] == "confirmed"
        assert row["external_order_id"] == "wc_1001"


@pytest.mark.asyncio
async def test_scenario_d_fallback_when_connector_unsupported(async_client):
    _, tenant_id, public_key = await _setup_sales_tenant(
        async_client, mode="link", platform="generic"
    )
    assert public_key
    product_id = await _seed_product(tenant_id)
    slot_store = {}

    async def _fake_get_slot(_tenant_id, _session_id):  # noqa: ANN001
        return slot_store.get((_tenant_id, _session_id), chat_handler.SalesSlotState())

    async def _fake_save_slot(_tenant_id, _session_id, state):  # noqa: ANN001
        slot_store[(_tenant_id, _session_id)] = state

    async def _fake_notify(_order, _tenant):  # noqa: ANN001
        return None

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(chat_handler, "get_slot", _fake_get_slot)
        mp.setattr(chat_handler, "save_slot", _fake_save_slot)
        mp.setattr(chat_handler, "notify_new_lead", _fake_notify)

        out_add = await chat_handler.handle_sales_chat(
            tenant_id=tenant_id,
            session_id="p9-d",
            query="",
            action={"type": "add_to_cart", "data": {"product_id": product_id, "quantity": 1}},
            persist_messages=False,
        )
        assert out_add["intent"] == "add_to_cart"
        submit = await chat_handler.handle_sales_chat(
            tenant_id=tenant_id,
            session_id="p9-d",
            query="",
            action={"type": "submit_form", "data": {"name": "D", "phone": "0933", "address": "Can Tho"}},
            persist_messages=False,
        )
    ui = submit.get("ui_components", [])
    assert any(c.get("type") == "order_confirmation" for c in ui)
    assert not any(c.get("type") == "checkout_link" for c in ui)


@pytest.mark.asyncio
async def test_scenario_e_dashboard_config_propagates_to_widget(async_client):
    headers, _, public_key = await _setup_sales_tenant(async_client, mode="lead", platform="woocommerce")
    put_cfg = await async_client.put(
        "/api/v1/admin/sales/widget-config",
        headers=headers,
        json={"bot_name": "Bot QA", "primary_color": "#111111", "action_mode": "direct"},
    )
    assert put_cfg.status_code == 200, put_cfg.text

    cfg = await async_client.get(
        "/api/v1/chat/config",
        headers={"X-Widget-Key": public_key, "Origin": "https://example.com"},
    )
    assert cfg.status_code == 200, cfg.text
    body = cfg.json()
    assert body["bot_name"] == "Bot QA"
    assert body["primary_color"] == "#111111"
    assert body["action_mode"] == "direct"


@pytest.mark.asyncio
async def test_security_domain_whitelist_and_credentials_masked(async_client):
    headers, _, public_key = await _setup_sales_tenant(async_client, mode="lead", platform="woocommerce")

    existing = await async_client.get("/api/v1/admin/origins", headers=headers)
    assert existing.status_code == 200, existing.text
    for row in existing.json():
        deleted = await async_client.delete(f"/api/v1/admin/origins/{row['id']}", headers=headers)
        assert deleted.status_code == 200, deleted.text

    add_origin = await async_client.post(
        "/api/v1/admin/origins",
        headers=headers,
        json={"origin": "https://allowed.example.com"},
    )
    assert add_origin.status_code == 201, add_origin.text

    denied = await async_client.get(
        "/api/v1/chat/config",
        headers={"X-Widget-Key": public_key, "Origin": "https://blocked.example.com"},
    )
    assert denied.status_code == 403, denied.text

    connectors = await async_client.get("/api/v1/admin/sales/connector", headers=headers)
    assert connectors.status_code == 200, connectors.text
    preview = connectors.json()[0]["credentials_preview"]
    assert preview.get("consumer_key") == "***"
    assert preview.get("consumer_secret") == "***"


@pytest.mark.asyncio
async def test_security_tenant_isolation_order_detail(async_client):
    headers_a, tenant_a, _ = await _setup_sales_tenant(async_client, mode="lead")
    headers_b, _, _ = await _setup_sales_tenant(async_client, mode="lead")

    async with async_session() as session:
        order = SalesOrder(
            tenant_id=tenant_a,
            source_mode="lead",
            items=[],
            status="pending",
            payment_status="unpaid",
        )
        session.add(order)
        await session.commit()
        await session.refresh(order)
        oid = str(order.id)

    denied = await async_client.get(f"/api/v1/admin/sales/orders/{oid}", headers=headers_b)
    assert denied.status_code == 404, denied.text
    allowed = await async_client.get(f"/api/v1/admin/sales/orders/{oid}", headers=headers_a)
    assert allowed.status_code == 200, allowed.text


@pytest.mark.asyncio
async def test_performance_baseline_chat_and_sync(async_client, monkeypatch):
    headers, tenant_id, public_key = await _setup_sales_tenant(async_client, mode="lead")
    assert public_key
    _use_local_slot_store(monkeypatch)

    t0 = time.perf_counter()
    chat = await chat_handler.handle_sales_chat(
        tenant_id=tenant_id,
        session_id="p9-perf",
        query="",
        action={"type": "submit_form", "data": {"name": "Perf", "phone": "0999", "address": "HN"}},
        persist_messages=False,
    )
    elapsed_chat = time.perf_counter() - t0
    assert chat["intent"] == "submit_form"
    assert elapsed_chat < 5.0

    async def _fake_sync(session, tenant_uuid, connector, index_qdrant=False):  # noqa: ARG001
        return 3

    monkeypatch.setattr(admin_sales, "sync_connector_products", _fake_sync)
    t1 = time.perf_counter()
    sync = await async_client.post(
        "/api/v1/admin/sales/connector/sync?platform=woocommerce", headers=headers
    )
    elapsed_sync = time.perf_counter() - t1
    assert sync.status_code == 200, sync.text
    assert sync.json()["synced"] == 3
    assert elapsed_sync < 5.0
    assert tenant_id
