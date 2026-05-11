"""PayOS webhook — verify + idempotency + plan sync."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from main import app

class _FakeScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeAsyncSession:
    def __init__(self, *, intent, tenant):
        self.intent = intent
        self.tenant = tenant
        self.commits = 0

    async def execute(self, _query):
        return _FakeScalarResult(self.intent)

    async def get(self, _model, _id):
        return self.tenant

    async def commit(self):
        self.commits += 1


class _FakeSessionFactory:
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_payos_webhook_rejects_invalid_signature():
    transport = ASGITransport(app=app)
    fake_settings = MagicMock()
    fake_settings.PAYOS_CHECKSUM_KEY = "test-checksum-key-nonempty"
    fake_settings.PAYOS_CLIENT_ID = "test-client"
    fake_settings.PAYOS_API_KEY = "test-api-key"

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch("api.v1.payos_billing.settings", fake_settings):
            with patch("payos.AsyncPayOS") as m_client:
                inst = m_client.return_value
                inst.webhooks.verify = AsyncMock(side_effect=RuntimeError("bad sig"))
                r = await ac.post(
                    "/api/v1/webhooks/payos",
                    json={"code": "00", "data": {}, "signature": "x"},
                )
                assert r.status_code == 400


@pytest.mark.asyncio
async def test_payos_config_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/api/v1/admin/billing/payos/config")
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_payos_webhook_duplicate_callback_is_idempotent():
    transport = ASGITransport(app=app)
    fake_settings = MagicMock()
    fake_settings.PAYOS_CHECKSUM_KEY = "test-checksum-key-nonempty"
    fake_settings.PAYOS_CLIENT_ID = "test-client"
    fake_settings.PAYOS_API_KEY = "test-api-key"

    order_code = 990001122
    fake_intent = SimpleNamespace(
        tenant_id="tenant-1",
        order_code=order_code,
        target_plan="pro",
        amount_vnd=150000,
        status="pending",
        completed_at=None,
    )
    fake_tenant = SimpleNamespace(plan="starter", updated_at=None)
    fake_session = _FakeAsyncSession(intent=fake_intent, tenant=fake_tenant)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch("api.v1.payos_billing.settings", fake_settings):
            with patch("payos.AsyncPayOS") as m_client:
                inst = m_client.return_value
                inst.webhooks.verify = AsyncMock(
                    return_value=SimpleNamespace(order_code=order_code, amount=150000)
                )
                with patch(
                    "api.v1.payos_billing.async_session",
                    return_value=_FakeSessionFactory(fake_session),
                ):
                    payload = {"code": "00", "data": {"orderCode": order_code}, "signature": "ok"}
                    r1 = await ac.post("/api/v1/webhooks/payos", json=payload)
                    r2 = await ac.post("/api/v1/webhooks/payos", json=payload)
                    assert r1.status_code == 200, r1.text
                    assert r2.status_code == 200, r2.text

    assert fake_tenant.plan == "pro"
    assert fake_intent.status == "completed"
    assert fake_intent.completed_at is not None
    # Callback trùng không được commit thêm lần 2
    assert fake_session.commits == 1


@pytest.mark.asyncio
async def test_payos_webhook_amount_mismatch_marks_intent_and_rejects():
    transport = ASGITransport(app=app)
    fake_settings = MagicMock()
    fake_settings.PAYOS_CHECKSUM_KEY = "test-checksum-key-nonempty"
    fake_settings.PAYOS_CLIENT_ID = "test-client"
    fake_settings.PAYOS_API_KEY = "test-api-key"

    order_code = 990001133
    fake_intent = SimpleNamespace(
        tenant_id="tenant-2",
        order_code=order_code,
        target_plan="enterprise",
        amount_vnd=250000,
        status="pending",
        completed_at=None,
    )
    fake_tenant = SimpleNamespace(plan="starter", updated_at=None)
    fake_session = _FakeAsyncSession(intent=fake_intent, tenant=fake_tenant)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch("api.v1.payos_billing.settings", fake_settings):
            with patch("payos.AsyncPayOS") as m_client:
                inst = m_client.return_value
                inst.webhooks.verify = AsyncMock(
                    return_value=SimpleNamespace(order_code=order_code, amount=111111)
                )
                with patch(
                    "api.v1.payos_billing.async_session",
                    return_value=_FakeSessionFactory(fake_session),
                ):
                    payload = {"code": "00", "data": {"orderCode": order_code}, "signature": "ok"}
                    r = await ac.post("/api/v1/webhooks/payos", json=payload)
                    assert r.status_code == 400, r.text

    assert fake_tenant.plan == "starter"
    assert fake_intent.status == "amount_mismatch"
    assert fake_session.commits == 1


@pytest.mark.asyncio
async def test_payos_webhook_cancel_code_updates_status_without_plan_change():
    transport = ASGITransport(app=app)
    fake_settings = MagicMock()
    fake_settings.PAYOS_CHECKSUM_KEY = "test-checksum-key-nonempty"
    fake_settings.PAYOS_CLIENT_ID = "test-client"
    fake_settings.PAYOS_API_KEY = "test-api-key"

    order_code = 990001144
    fake_intent = SimpleNamespace(
        tenant_id="tenant-3",
        order_code=order_code,
        target_plan="pro",
        amount_vnd=150000,
        status="pending",
        completed_at=None,
    )
    fake_tenant = SimpleNamespace(plan="starter", updated_at=None)
    fake_session = _FakeAsyncSession(intent=fake_intent, tenant=fake_tenant)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch("api.v1.payos_billing.settings", fake_settings):
            with patch("payos.AsyncPayOS") as m_client:
                inst = m_client.return_value
                inst.webhooks.verify = AsyncMock(
                    return_value=SimpleNamespace(order_code=order_code, amount=150000)
                )
                with patch(
                    "api.v1.payos_billing.async_session",
                    return_value=_FakeSessionFactory(fake_session),
                ):
                    payload = {"code": "03", "data": {"orderCode": order_code}, "signature": "ok"}
                    r = await ac.post("/api/v1/webhooks/payos", json=payload)
                    assert r.status_code == 200, r.text

    assert fake_tenant.plan == "starter"
    assert fake_intent.status == "cancelled"
    assert fake_session.commits == 1
