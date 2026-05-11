"""Test auto-detect effective action_mode trong chat_handler.

Phủ 4 case:
- Connector chưa active → lead (không gọi API).
- Generic không có endpoint create_order hợp lệ → lead.
- Generic có create_order hợp lệ → direct, gọi API thành công.
- Direct gọi API lỗi → fallback lead, ghi notes.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from db.session import async_session
from models.sales import PlatformConnector, SalesOrder
from models.tenant import Tenant
from models.widget_config import TenantWidgetConfig
from services.connectors.base import OrderResult
from services.sales import chat_handler


# ───────────────────────── Helpers chung ─────────────────────────


async def _seed_tenant(
    *,
    platform: str,
    is_active: bool,
    config: dict,
    credentials: dict,
    action_mode: str = "lead",
) -> uuid.UUID:
    tenant_id = uuid.uuid4()
    async with async_session() as session:
        tenant = Tenant(
            id=tenant_id,
            name=f"Auto Mode {platform}",
            email=f"auto_{platform}_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="x",
            plan="starter",
            role="tenant",
            is_active=True,
            sales_enabled=True,
        )
        session.add(tenant)
        session.add(
            TenantWidgetConfig(
                tenant_id=tenant_id,
                bot_name="Auto Bot",
                action_mode=action_mode,
            )
        )
        connector = PlatformConnector(
            tenant_id=tenant_id,
            platform=platform,
            is_active=is_active,
            config=config,
        )
        connector.credentials = credentials
        session.add(connector)
        await session.commit()
    return tenant_id


def _patch_runtime(monkeypatch, *, fake_connector_factory=None):
    slot_store: dict = {}

    async def _fake_get_slot(_t, _s):  # noqa: ANN001
        return slot_store.get((_t, _s), chat_handler.SalesSlotState())

    async def _fake_save_slot(_t, _s, state):  # noqa: ANN001
        slot_store[(_t, _s)] = state

    async def _fake_notify(order, tenant):  # noqa: ANN001
        return None

    monkeypatch.setattr(chat_handler, "get_slot", _fake_get_slot)
    monkeypatch.setattr(chat_handler, "save_slot", _fake_save_slot)
    monkeypatch.setattr(chat_handler, "notify_new_lead", _fake_notify)
    if fake_connector_factory is not None:
        monkeypatch.setattr(chat_handler, "get_connector", fake_connector_factory)
    return slot_store


_VALID_GENERIC_CFG = {
    "endpoints": [
        {
            "code": "create_order",
            "method": "POST",
            "path": "/orders",
            "path_template": "/orders",
            "query_template": {},
            "body_template": {"payload": {"customer_name": "{customer_name}"}},
            "enabled": True,
        }
    ]
}


# ───────────────────────── Helper unit tests ─────────────────────────


def test_supports_create_order_inactive_connector():
    conn = PlatformConnector(
        tenant_id=uuid.uuid4(),
        platform="woocommerce",
        is_active=False,
        config={},
    )
    conn.credentials = {"site_url": "x", "consumer_key": "k", "consumer_secret": "s"}
    assert chat_handler._connector_supports_create_order(conn) is False


def test_supports_create_order_generic_missing_endpoint():
    conn = PlatformConnector(
        tenant_id=uuid.uuid4(),
        platform="generic",
        is_active=True,
        config={"endpoints": []},
    )
    conn.credentials = {"base_url": "https://x"}
    assert chat_handler._connector_supports_create_order(conn) is False


def test_supports_create_order_generic_valid():
    conn = PlatformConnector(
        tenant_id=uuid.uuid4(),
        platform="generic",
        is_active=True,
        config=_VALID_GENERIC_CFG,
    )
    conn.credentials = {"base_url": "https://x"}
    assert chat_handler._connector_supports_create_order(conn) is True


def test_supports_create_order_generic_disabled_endpoint():
    cfg = {
        "endpoints": [
            {
                **_VALID_GENERIC_CFG["endpoints"][0],
                "enabled": False,
            }
        ]
    }
    conn = PlatformConnector(
        tenant_id=uuid.uuid4(),
        platform="generic",
        is_active=True,
        config=cfg,
    )
    conn.credentials = {"base_url": "https://x"}
    assert chat_handler._connector_supports_create_order(conn) is False


# ───────────────────────── Integration tests ─────────────────────────


@pytest.mark.asyncio
async def test_generic_without_create_order_uses_lead(monkeypatch):
    """Generic connector active nhưng không có endpoint create_order → lead."""
    tenant_id = await _seed_tenant(
        platform="generic",
        is_active=True,
        config={"endpoints": []},
        credentials={"base_url": "https://api.test", "auth_value": "tok"},
    )

    called = {"count": 0}

    class _ShouldNotCall:
        async def create_order(self, _payload):  # noqa: ANN001
            called["count"] += 1
            return OrderResult(success=False, error="should-not-call")

    _patch_runtime(monkeypatch, fake_connector_factory=lambda _c: _ShouldNotCall())

    out = await chat_handler.handle_sales_chat(
        tenant_id=str(tenant_id),
        session_id="auto-noendpoint-1",
        query="",
        action={
            "type": "submit_form",
            "data": {"name": "B", "phone": "0901", "address": "HCM"},
        },
        persist_messages=False,
    )
    assert any(c.get("type") == "order_confirmation" for c in out["ui_components"])
    assert called["count"] == 0

    async with async_session() as session:
        row = (
            await session.execute(
                select(SalesOrder)
                .where(SalesOrder.tenant_id == tenant_id)
                .order_by(SalesOrder.created_at.desc())
            )
        ).scalars().first()
        assert row is not None
        assert row.source_mode == "lead"


@pytest.mark.asyncio
async def test_generic_with_create_order_calls_api_direct(monkeypatch):
    """Generic có create_order hợp lệ → direct, gọi API thành công, lưu external_order_id."""
    tenant_id = await _seed_tenant(
        platform="generic",
        is_active=True,
        config=_VALID_GENERIC_CFG,
        credentials={"base_url": "https://api.test", "auth_value": "tok"},
    )

    captured = {"called": False}

    class _OkConnector:
        async def create_order(self, _payload):  # noqa: ANN001
            captured["called"] = True
            return OrderResult(
                success=True,
                external_order_id="EXT-12345",
                external_order_url="https://shop.test/orders/12345",
            )

    _patch_runtime(monkeypatch, fake_connector_factory=lambda _c: _OkConnector())

    out = await chat_handler.handle_sales_chat(
        tenant_id=str(tenant_id),
        session_id="auto-direct-1",
        query="",
        action={
            "type": "submit_form",
            "data": {"name": "C", "phone": "0902", "address": "DN"},
        },
        persist_messages=False,
    )
    assert captured["called"] is True
    assert any(c.get("type") == "order_confirmation" for c in out["ui_components"])

    async with async_session() as session:
        row = (
            await session.execute(
                select(SalesOrder)
                .where(SalesOrder.tenant_id == tenant_id)
                .order_by(SalesOrder.created_at.desc())
            )
        ).scalars().first()
        assert row is not None
        assert row.source_mode == "direct"
        assert row.external_order_id == "EXT-12345"
        assert row.external_order_url == "https://shop.test/orders/12345"
        assert row.status == "confirmed"


@pytest.mark.asyncio
async def test_generic_direct_items_have_alias_keys(monkeypatch):
    """Items truyền cho create_order phải có cả product_id/qty/price (cho mock REST)
    lẫn external_id/quantity (cho WooCommerce/Shopify). Giá trị cùng nguồn."""
    tenant_id = await _seed_tenant(
        platform="generic",
        is_active=True,
        config=_VALID_GENERIC_CFG,
        credentials={"base_url": "https://api.test", "auth_value": "tok"},
    )

    captured: dict = {"items": None, "payment_method": None, "name": None}

    class _CapturingConnector:
        async def create_order(self, payload):  # noqa: ANN001
            captured["items"] = list(payload.items)
            captured["payment_method"] = payload.payment_method
            captured["name"] = payload.customer_name
            return OrderResult(
                success=True,
                external_order_id="OK-1",
                external_order_url=None,
            )

    _patch_runtime(monkeypatch, fake_connector_factory=lambda _c: _CapturingConnector())

    # Bước 1: thêm sản phẩm vào giỏ qua action add_to_cart
    await chat_handler.handle_sales_chat(
        tenant_id=str(tenant_id),
        session_id="auto-items-1",
        query="",
        action={
            "type": "add_to_cart",
            "data": {
                "product_id": "1",
                "external_id": "1",
                "name": "Muối Hồng",
                "price": 120000,
                "quantity": 2,
            },
        },
        persist_messages=False,
    )

    # Bước 2: submit form, kích hoạt direct create_order
    await chat_handler.handle_sales_chat(
        tenant_id=str(tenant_id),
        session_id="auto-items-1",
        query="",
        action={
            "type": "submit_form",
            "data": {
                "name": "Nguyen Van A",
                "phone": "0909123456",
                "address": "123 Le Loi",
                "payment_method": "cod",
            },
        },
        persist_messages=False,
    )

    items = captured["items"]
    assert items is not None and len(items) == 1, f"items={items}"
    it = items[0]
    # alias cho mock da_muoi (Pydantic OrderItemIn)
    assert it.get("product_id") == "1"
    assert it.get("qty") == 2
    assert it.get("price") == 120000
    # alias cho WooCommerce/Shopify
    assert it.get("external_id") == "1"
    assert it.get("quantity") == 2
    assert it.get("name") == "Muối Hồng"
    assert captured["payment_method"] == "cod"
    assert captured["name"] == "Nguyen Van A"


@pytest.mark.asyncio
async def test_direct_api_failure_falls_back_to_lead(monkeypatch):
    """Direct gọi API lỗi → fallback lead, ghi notes nhưng vẫn confirm UI."""
    tenant_id = await _seed_tenant(
        platform="generic",
        is_active=True,
        config=_VALID_GENERIC_CFG,
        credentials={"base_url": "https://api.test", "auth_value": "tok"},
    )

    class _FailConnector:
        async def create_order(self, _payload):  # noqa: ANN001
            return OrderResult(success=False, error="HTTP 500 boom")

    _patch_runtime(monkeypatch, fake_connector_factory=lambda _c: _FailConnector())

    out = await chat_handler.handle_sales_chat(
        tenant_id=str(tenant_id),
        session_id="auto-fail-1",
        query="",
        action={
            "type": "submit_form",
            "data": {"name": "D", "phone": "0903", "address": "HP"},
        },
        persist_messages=False,
    )
    assert any(c.get("type") == "order_confirmation" for c in out["ui_components"])

    async with async_session() as session:
        row = (
            await session.execute(
                select(SalesOrder)
                .where(SalesOrder.tenant_id == tenant_id)
                .order_by(SalesOrder.created_at.desc())
            )
        ).scalars().first()
        assert row is not None
        assert row.source_mode == "lead"
        assert row.external_order_id is None
        assert "direct_fallback_lead" in (row.notes or "")
        assert "HTTP 500" in (row.notes or "")
