"""PayOS webhook — verify + cập nhật plan (mock client)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from main import app


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
