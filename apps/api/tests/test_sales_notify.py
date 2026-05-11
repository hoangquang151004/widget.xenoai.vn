import uuid
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest

from services import notify as notify_service


@pytest.mark.asyncio
async def test_send_webhook_with_retry_success_after_failures(monkeypatch):
    attempts = {"count": 0}

    class _Resp:
        def __init__(self, status_code: int):
            self.status_code = status_code
            self.text = "x"

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return False

        async def post(self, url, json, headers):  # noqa: ANN001
            attempts["count"] += 1
            if attempts["count"] < 3:
                return _Resp(500)
            assert "X-Widget-Signature" in headers or headers.get("X-Widget-Signature", "") == ""
            assert url == "https://example.com/hook"
            assert json["event"] == "new_lead"
            return _Resp(200)

    async def _no_sleep(_):  # noqa: ANN001
        return None

    monkeypatch.setattr(notify_service.httpx, "AsyncClient", lambda timeout=10.0: _Client())
    monkeypatch.setattr(notify_service.asyncio, "sleep", _no_sleep)

    ok = await notify_service._send_webhook_with_retry(  # noqa: SLF001
        "https://example.com/hook",
        {"event": "new_lead", "order_id": "1"},
    )
    assert ok is True
    assert attempts["count"] == 3


@pytest.mark.asyncio
async def test_notify_new_lead_uses_env_webhook_fallback(monkeypatch):
    tenant = SimpleNamespace(id=uuid.uuid4(), name="Tenant A", email="owner@example.com")
    order = SimpleNamespace(
        id=uuid.uuid4(),
        customer_name="A",
        customer_phone="0909",
        customer_email="a@example.com",
        customer_address="HN",
        subtotal=Decimal("120000"),
        items=[{"name": "SP1", "quantity": 1}],
        created_at=datetime.utcnow(),
    )

    called = {"url": ""}

    async def _fake_send(url: str, payload: dict) -> bool:
        called["url"] = url
        assert payload["event"] == "new_lead"
        return True

    async def _fake_email(order_obj, tenant_obj, to_email):  # noqa: ANN001
        assert to_email == tenant.email
        assert order_obj.id == order.id
        assert tenant_obj.id == tenant.id
        return True

    old_webhook = notify_service.settings.SALES_NOTIFY_WEBHOOK_URL
    old_email = notify_service.settings.SALES_NOTIFY_EMAIL_TO
    old_smtp_host = notify_service.settings.SMTP_HOST
    try:
        notify_service.settings.SALES_NOTIFY_WEBHOOK_URL = "https://fallback.example/hook"
        notify_service.settings.SALES_NOTIFY_EMAIL_TO = ""
        notify_service.settings.SMTP_HOST = "smtp.example.com"
        monkeypatch.setattr(notify_service, "_send_webhook_with_retry", _fake_send)
        monkeypatch.setattr(notify_service, "_send_email_new_lead", _fake_email)
        await notify_service.notify_new_lead(order, tenant)
        assert called["url"] == "https://fallback.example/hook"
    finally:
        notify_service.settings.SALES_NOTIFY_WEBHOOK_URL = old_webhook
        notify_service.settings.SALES_NOTIFY_EMAIL_TO = old_email
        notify_service.settings.SMTP_HOST = old_smtp_host


@pytest.mark.asyncio
async def test_send_email_new_lead_retries_and_succeeds(monkeypatch):
    tenant = SimpleNamespace(id=uuid.uuid4(), name="Tenant A", email="owner@example.com")
    order = SimpleNamespace(
        id=uuid.uuid4(),
        customer_name="A",
        customer_phone="0909",
        customer_email="a@example.com",
        customer_address="HN",
        subtotal=Decimal("120000"),
        items=[{"name": "SP1", "quantity": 1}],
        created_at=datetime.utcnow(),
    )

    attempts = {"count": 0}

    class _SMTP:
        def __init__(self, host, port, timeout):  # noqa: ANN001
            assert host == "smtp.example.com"
            assert int(port) == 587
            assert int(timeout) == 7

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):  # noqa: ANN001
            return False

        def starttls(self):
            return None

        def login(self, username, password):  # noqa: ANN001
            assert username == "smtp_user"
            assert password == "smtp_password"

        def send_message(self, _msg):  # noqa: ANN001
            attempts["count"] += 1
            if attempts["count"] < 3:
                raise RuntimeError("temporary send error")

    async def _no_sleep(_):  # noqa: ANN001
        return None

    async def _to_thread(fn, *args, **kwargs):  # noqa: ANN001
        return fn(*args, **kwargs)

    old_host = notify_service.settings.SMTP_HOST
    old_user = notify_service.settings.SMTP_USERNAME
    old_pass = notify_service.settings.SMTP_PASSWORD
    old_from = notify_service.settings.SMTP_FROM_EMAIL
    old_retry = notify_service.settings.SALES_NOTIFY_EMAIL_RETRY_BACKOFF
    old_timeout = notify_service.settings.SALES_NOTIFY_EMAIL_TIMEOUT_SEC
    old_tls = notify_service.settings.SMTP_USE_TLS
    try:
        notify_service.settings.SMTP_HOST = "smtp.example.com"
        notify_service.settings.SMTP_USERNAME = "smtp_user"
        notify_service.settings.SMTP_PASSWORD = "smtp_password"
        notify_service.settings.SMTP_FROM_EMAIL = "bot@example.com"
        notify_service.settings.SMTP_USE_TLS = True
        notify_service.settings.SALES_NOTIFY_EMAIL_RETRY_BACKOFF = "0,1,2"
        notify_service.settings.SALES_NOTIFY_EMAIL_TIMEOUT_SEC = 7
        monkeypatch.setattr(notify_service.smtplib, "SMTP", _SMTP)
        monkeypatch.setattr(notify_service.asyncio, "sleep", _no_sleep)
        monkeypatch.setattr(notify_service.asyncio, "to_thread", _to_thread)

        ok = await notify_service._send_email_new_lead(order, tenant, "lead@example.com")  # noqa: SLF001
        assert ok is True
        assert attempts["count"] == 3
    finally:
        notify_service.settings.SMTP_HOST = old_host
        notify_service.settings.SMTP_USERNAME = old_user
        notify_service.settings.SMTP_PASSWORD = old_pass
        notify_service.settings.SMTP_FROM_EMAIL = old_from
        notify_service.settings.SALES_NOTIFY_EMAIL_RETRY_BACKOFF = old_retry
        notify_service.settings.SALES_NOTIFY_EMAIL_TIMEOUT_SEC = old_timeout
        notify_service.settings.SMTP_USE_TLS = old_tls
