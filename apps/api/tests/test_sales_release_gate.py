import json
import uuid
from types import SimpleNamespace

import httpx
import pytest
from httpx import ASGITransport

from api.v1 import chat as chat_api
from main import app


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", timeout=30.0
    ) as client:
        yield client


async def _create_tenant_and_public_key(ac: httpx.AsyncClient) -> str:
    email = f"rg_{uuid.uuid4().hex[:8]}@example.com"
    reg = await ac.post(
        "/api/v1/admin/register",
        json={"name": "Release Gate", "email": email, "password": "Release_Gate1!"},
    )
    assert reg.status_code == 201, reg.text
    login = await ac.post("/api/v1/admin/login", json={"email": email, "password": "Release_Gate1!"})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    me = await ac.get("/api/v1/admin/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text
    return me.json().get("public_key")


@pytest.mark.asyncio
async def test_sales_disabled_chat_uses_general_path(monkeypatch, async_client):
    public_key = await _create_tenant_and_public_key(async_client)
    assert public_key

    async def _allow(_tenant_id):  # noqa: ANN001
        return None

    class _GraphFake:
        async def ainvoke(self, _inputs):  # noqa: ANN001
            return {"response": SimpleNamespace(content="general ok", metadata={"intent": "general"})}

    monkeypatch.setattr(chat_api, "ensure_widget_chat_allowed", _allow)
    monkeypatch.setattr(chat_api, "orchestrator_graph", _GraphFake())

    res = await async_client.post(
        "/api/v1/chat",
        headers={"X-Widget-Key": public_key},
        json={"query": "xin chào", "session_id": "rg-chat"},
    )
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload["text"] == "general ok"
    assert payload["ui_components"] == []
    assert payload["slots"] == {}
    assert payload.get("metadata", {}).get("intent") == "general"


@pytest.mark.asyncio
async def test_sales_disabled_stream_has_no_sales_regression(monkeypatch, async_client):
    public_key = await _create_tenant_and_public_key(async_client)
    assert public_key

    async def _allow(_tenant_id):  # noqa: ANN001
        return None

    class _GraphFake:
        async def ainvoke(self, _inputs):  # noqa: ANN001
            return {"response": SimpleNamespace(content="stream general ok", metadata={"intent": "general"})}

    monkeypatch.setattr(chat_api, "ensure_widget_chat_allowed", _allow)
    monkeypatch.setattr(chat_api, "orchestrator_graph", _GraphFake())

    res = await async_client.post(
        "/api/v1/chat/stream",
        headers={"X-Widget-Key": public_key},
        json={"query": "hi", "session_id": "rg-stream"},
    )
    assert res.status_code == 200, res.text
    body = res.text
    done_lines = [line for line in body.splitlines() if line.startswith("data: ")]
    assert done_lines
    final_payload = json.loads(done_lines[-1].replace("data: ", ""))
    assert final_payload.get("done") is True
    assert final_payload.get("text") == "stream general ok"
    assert final_payload.get("ui_components") == []
    assert final_payload.get("slots") == {}
