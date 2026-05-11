import uuid

import pytest
from sqlalchemy import select

from db.session import async_session
from models.sales import PlatformConnector, Product, SalesOrder
from models.tenant import Tenant
from models.widget_config import TenantWidgetConfig
from services.connectors.base import UnsupportedOperation
from services.sales import chat_handler


@pytest.mark.asyncio
async def test_mode_c_submit_form_creates_lead_and_confirmation(monkeypatch):
    tenant_id = uuid.uuid4()
    slot_store = {}

    async with async_session() as session:
        tenant = Tenant(
            id=tenant_id,
            name="Mode C Tenant",
            email=f"modec_{uuid.uuid4().hex[:8]}@example.com",
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
                bot_name="Mode C Bot",
                action_mode="lead",
            )
        )
        # Connector generic không có endpoint create_order → auto-detect lead.
        connector = PlatformConnector(
            tenant_id=tenant_id,
            platform="generic",
            is_active=True,
            config={"endpoints": []},
        )
        connector.credentials = {
            "base_url": "https://shop.test",
            "auth_value": "tok",
        }
        session.add(connector)
        await session.commit()

    async def _fake_get_slot(_tenant_id, _session_id):  # noqa: ANN001
        return slot_store.get((_tenant_id, _session_id), chat_handler.SalesSlotState())

    async def _fake_save_slot(_tenant_id, _session_id, state):  # noqa: ANN001
        slot_store[(_tenant_id, _session_id)] = state

    async def _fake_notify(order, tenant):  # noqa: ANN001
        return None

    monkeypatch.setattr(chat_handler, "get_slot", _fake_get_slot)
    monkeypatch.setattr(chat_handler, "save_slot", _fake_save_slot)
    monkeypatch.setattr(chat_handler, "notify_new_lead", _fake_notify)

    out = await chat_handler.handle_sales_chat(
        tenant_id=str(tenant_id),
        session_id="modec-s1",
        query="",
        action={
            "type": "submit_form",
            "data": {"name": "Nguyen Van A", "phone": "0909123456", "address": "Ha Noi"},
        },
        persist_messages=False,
    )
    assert out["intent"] == "submit_form"
    assert any(c.get("type") == "order_confirmation" for c in out["ui_components"])

    async with async_session() as session:
        rows = (
            await session.execute(
                select(SalesOrder).where(SalesOrder.tenant_id == tenant_id).order_by(SalesOrder.created_at.desc())
            )
        ).scalars().all()
        assert rows
        assert rows[0].source_mode == "lead"
        assert rows[0].customer_phone == "0909123456"


@pytest.mark.asyncio
async def test_link_mode_unsupported_cart_link_fallbacks_to_mode_c(monkeypatch):
    tenant_id = uuid.uuid4()
    slot_store = {}

    async with async_session() as session:
        tenant = Tenant(
            id=tenant_id,
            name="Mode Link Tenant",
            email=f"modelink_{uuid.uuid4().hex[:8]}@example.com",
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
                bot_name="Mode Link Bot",
                action_mode="link",
            )
        )
        connector = PlatformConnector(
            tenant_id=tenant_id,
            platform="generic",
            is_active=True,
            config={},
        )
        connector.credentials = {"base_url": "https://api.shop.test", "auth_value": "tok"}
        session.add(connector)
        product = Product(
            tenant_id=tenant_id,
            external_id="ext_01",
            platform="generic",
            name="SP fallback",
            price=120000,
            in_stock=True,
            stock_quantity=5,
        )
        session.add(product)
        await session.commit()
        await session.refresh(product)

    async def _fake_get_slot(_tenant_id, _session_id):  # noqa: ANN001
        return slot_store.get((_tenant_id, _session_id), chat_handler.SalesSlotState())

    async def _fake_save_slot(_tenant_id, _session_id, state):  # noqa: ANN001
        slot_store[(_tenant_id, _session_id)] = state

    async def _fake_notify(order, tenant):  # noqa: ANN001
        return None

    class _ConnectorFake:
        async def generate_cart_link(self, _items):  # noqa: ANN001
            raise UnsupportedOperation("cart_link_not_supported")

    monkeypatch.setattr(chat_handler, "get_slot", _fake_get_slot)
    monkeypatch.setattr(chat_handler, "save_slot", _fake_save_slot)
    monkeypatch.setattr(chat_handler, "notify_new_lead", _fake_notify)
    monkeypatch.setattr(chat_handler, "get_connector", lambda _conn: _ConnectorFake())

    out_add = await chat_handler.handle_sales_chat(
        tenant_id=str(tenant_id),
        session_id="modec-fallback-s1",
        query="",
        action={"type": "add_to_cart", "data": {"product_id": str(product.id), "quantity": 1}},
        persist_messages=False,
    )
    assert out_add["intent"] == "add_to_cart"

    out_submit = await chat_handler.handle_sales_chat(
        tenant_id=str(tenant_id),
        session_id="modec-fallback-s1",
        query="",
        action={
            "type": "submit_form",
            "data": {"name": "A", "phone": "0909", "address": "HN"},
        },
        persist_messages=False,
    )
    assert any(c.get("type") == "order_confirmation" for c in out_submit["ui_components"])
    assert not any(c.get("type") == "checkout_link" for c in out_submit["ui_components"])
    assert "lỗi" not in out_submit["content"].lower()

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
async def test_add_to_cart_returns_success_without_cart_ui(monkeypatch):
    tenant_id = uuid.uuid4()
    slot_store = {}

    async with async_session() as session:
        tenant = Tenant(
            id=tenant_id,
            name="Add Cart Tenant",
            email=f"addcart_{uuid.uuid4().hex[:8]}@example.com",
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
                bot_name="Add Cart Bot",
                action_mode="lead",
            )
        )
        connector = PlatformConnector(
            tenant_id=tenant_id,
            platform="generic",
            is_active=True,
            config={"endpoints": []},
        )
        connector.credentials = {"base_url": "https://shop.test", "auth_value": "tok"}
        session.add(connector)
        await session.commit()

    async def _fake_get_slot(_tenant_id, _session_id):  # noqa: ANN001
        return slot_store.get((_tenant_id, _session_id), chat_handler.SalesSlotState())

    async def _fake_save_slot(_tenant_id, _session_id, state):  # noqa: ANN001
        slot_store[(_tenant_id, _session_id)] = state

    async def _fake_notify(order, tenant):  # noqa: ANN001
        return None

    monkeypatch.setattr(chat_handler, "get_slot", _fake_get_slot)
    monkeypatch.setattr(chat_handler, "save_slot", _fake_save_slot)
    monkeypatch.setattr(chat_handler, "notify_new_lead", _fake_notify)

    out = await chat_handler.handle_sales_chat(
        tenant_id=str(tenant_id),
        session_id="add-cart-s1",
        query="",
        action={
            "type": "add_to_cart",
            "data": {"product_id": "1", "external_id": "1", "name": "SP A", "price": 100000},
        },
        persist_messages=False,
    )
    assert out["intent"] == "add_to_cart"
    assert "thành công" in out["content"].lower()
    assert not any(c.get("type") == "cart" for c in out["ui_components"])


@pytest.mark.asyncio
async def test_checkout_action_returns_order_form_when_cart_has_items(monkeypatch):
    tenant_id = uuid.uuid4()
    slot_store = {}

    async with async_session() as session:
        tenant = Tenant(
            id=tenant_id,
            name="Checkout Tenant",
            email=f"checkout_{uuid.uuid4().hex[:8]}@example.com",
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
                bot_name="Checkout Bot",
                action_mode="lead",
            )
        )
        connector = PlatformConnector(
            tenant_id=tenant_id,
            platform="generic",
            is_active=True,
            config={"endpoints": []},
        )
        connector.credentials = {"base_url": "https://shop.test", "auth_value": "tok"}
        session.add(connector)
        await session.commit()

    async def _fake_get_slot(_tenant_id, _session_id):  # noqa: ANN001
        return slot_store.get((_tenant_id, _session_id), chat_handler.SalesSlotState())

    async def _fake_save_slot(_tenant_id, _session_id, state):  # noqa: ANN001
        slot_store[(_tenant_id, _session_id)] = state

    async def _fake_notify(order, tenant):  # noqa: ANN001
        return None

    monkeypatch.setattr(chat_handler, "get_slot", _fake_get_slot)
    monkeypatch.setattr(chat_handler, "save_slot", _fake_save_slot)
    monkeypatch.setattr(chat_handler, "notify_new_lead", _fake_notify)

    await chat_handler.handle_sales_chat(
        tenant_id=str(tenant_id),
        session_id="checkout-s1",
        query="",
        action={
            "type": "add_to_cart",
            "data": {"product_id": "1", "external_id": "1", "name": "SP A", "price": 100000},
        },
        persist_messages=False,
    )

    out = await chat_handler.handle_sales_chat(
        tenant_id=str(tenant_id),
        session_id="checkout-s1",
        query="",
        action={"type": "checkout", "data": {}},
        persist_messages=False,
    )
    assert out["intent"] == "checkout"
    assert any(c.get("type") == "order_form" for c in out["ui_components"])


@pytest.mark.asyncio
async def test_view_cart_text_returns_cart_ui(monkeypatch):
    tenant_id = uuid.uuid4()
    slot_store = {}

    async with async_session() as session:
        tenant = Tenant(
            id=tenant_id,
            name="View Cart Tenant",
            email=f"viewcart_{uuid.uuid4().hex[:8]}@example.com",
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
                bot_name="View Cart Bot",
                action_mode="lead",
            )
        )
        connector = PlatformConnector(
            tenant_id=tenant_id,
            platform="generic",
            is_active=True,
            config={"endpoints": []},
        )
        connector.credentials = {"base_url": "https://shop.test", "auth_value": "tok"}
        session.add(connector)
        await session.commit()

    async def _fake_get_slot(_tenant_id, _session_id):  # noqa: ANN001
        return slot_store.get((_tenant_id, _session_id), chat_handler.SalesSlotState())

    async def _fake_save_slot(_tenant_id, _session_id, state):  # noqa: ANN001
        slot_store[(_tenant_id, _session_id)] = state

    async def _fake_notify(order, tenant):  # noqa: ANN001
        return None

    monkeypatch.setattr(chat_handler, "get_slot", _fake_get_slot)
    monkeypatch.setattr(chat_handler, "save_slot", _fake_save_slot)
    monkeypatch.setattr(chat_handler, "notify_new_lead", _fake_notify)

    await chat_handler.handle_sales_chat(
        tenant_id=str(tenant_id),
        session_id="view-cart-s1",
        query="",
        action={
            "type": "add_to_cart",
            "data": {"product_id": "1", "external_id": "1", "name": "SP A", "price": 100000},
        },
        persist_messages=False,
    )

    out = await chat_handler.handle_sales_chat(
        tenant_id=str(tenant_id),
        session_id="view-cart-s1",
        query="xem giỏ hàng",
        action=None,
        persist_messages=False,
    )
    assert out["intent"] == "view_cart"
    assert any(c.get("type") == "cart" for c in out["ui_components"])


@pytest.mark.asyncio
async def test_should_use_sales_chat_path_for_view_cart_query(monkeypatch):
    tenant_id = uuid.uuid4()

    async with async_session() as session:
        tenant = Tenant(
            id=tenant_id,
            name="Route Cart Tenant",
            email=f"routecart_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="x",
            plan="starter",
            role="tenant",
            is_active=True,
            sales_enabled=True,
        )
        session.add(tenant)
        session.add(TenantWidgetConfig(tenant_id=tenant_id, bot_name="Route Cart Bot", action_mode="lead"))
        connector = PlatformConnector(
            tenant_id=tenant_id,
            platform="generic",
            is_active=True,
            config={"endpoints": []},
        )
        connector.credentials = {"base_url": "https://shop.test", "auth_value": "tok"}
        session.add(connector)
        await session.commit()

    ok = await chat_handler.should_use_sales_chat_path(
        tenant_id=str(tenant_id),
        query="xem giỏ hàng",
        action=None,
    )
    assert ok is True
