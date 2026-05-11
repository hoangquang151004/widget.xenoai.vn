import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from db.session import async_session
from models.sales import PlatformConnector, Product
from models.tenant import Tenant
from services.sales.product_sync import sync_connector_products


class _FakeConnector:
    async def test_connection(self):
        return True, ""

    async def fetch_products(self, page: int = 1, per_page: int = 100):  # noqa: ARG002
        if page > 1:
            return []
        return [
            SimpleNamespace(
                external_id="p-1",
                name="Ao polo",
                description="cotton",
                price=199000,
                compare_price=None,
                sku="SKU-1",
                stock_quantity=8,
                in_stock=True,
                images=[],
                variants=[],
                tags=["ao"],
                category="tops",
                raw_data={"id": "p-1"},
            )
        ]


class _FailConnector:
    async def test_connection(self):
        return True, ""

    async def fetch_products(self, page: int = 1, per_page: int = 100):  # noqa: ARG002
        raise RuntimeError("upstream timeout")


@pytest.mark.asyncio
async def test_sync_connector_products_upserts(monkeypatch):
    tenant_id = uuid.uuid4()
    async with async_session() as session:
        t = Tenant(
            id=tenant_id,
            name="Sync Tenant",
            email=f"sync_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="x",
            plan="starter",
            role="tenant",
            is_active=True,
            sales_enabled=True,
        )
        session.add(t)
        c = PlatformConnector(
            tenant_id=tenant_id,
            platform="woocommerce",
            is_active=True,
            config={},
            sync_status="pending",
        )
        c.credentials = {"site_url": "https://shop.test", "consumer_key": "ck", "consumer_secret": "cs"}
        session.add(c)
        await session.commit()
        await session.refresh(c)

        monkeypatch.setattr("services.sales.product_sync.get_connector", lambda row: _FakeConnector())  # noqa: ARG005
        n = await sync_connector_products(session, tenant_id, c, index_qdrant=False)
        assert n == 1

        rows = (await session.execute(select(Product).filter(Product.tenant_id == tenant_id))).scalars().all()
        assert len(rows) == 1
        assert rows[0].name == "Ao polo"
        assert c.sync_status == "ok"


@pytest.mark.asyncio
async def test_sync_connector_products_marks_error_on_failure(monkeypatch):
    tenant_id = uuid.uuid4()
    async with async_session() as session:
        t = Tenant(
            id=tenant_id,
            name="Sync Err Tenant",
            email=f"syncerr_{uuid.uuid4().hex[:8]}@example.com",
            password_hash="x",
            plan="starter",
            role="tenant",
            is_active=True,
            sales_enabled=True,
        )
        session.add(t)
        c = PlatformConnector(
            tenant_id=tenant_id,
            platform="woocommerce",
            is_active=True,
            config={},
            sync_status="pending",
        )
        c.credentials = {"site_url": "https://shop.test", "consumer_key": "ck", "consumer_secret": "cs"}
        session.add(c)
        await session.commit()
        await session.refresh(c)

        monkeypatch.setattr("services.sales.product_sync.get_connector", lambda row: _FailConnector())  # noqa: ARG005
        with pytest.raises(RuntimeError):
            await sync_connector_products(session, tenant_id, c, index_qdrant=False)
        await session.refresh(c)
        assert c.sync_status == "error"
        assert "timeout" in (c.sync_error or "")
