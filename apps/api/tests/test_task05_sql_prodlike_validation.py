"""TASK-05: kiểm thử production-like cho Text-to-SQL guard và tenant isolation."""

import uuid

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy import update

from ai.sql.schema_loader import get_schema
from core.config import settings
from db.session import async_session
from main import app
from models.tenant import Tenant


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", timeout=30.0
    ) as client:
        yield client


async def _register_and_login(ac: httpx.AsyncClient) -> tuple[str, str, dict]:
    email = f"sql_prodlike_{uuid.uuid4().hex[:10]}@example.com"
    reg = await ac.post(
        "/api/v1/admin/register",
        json={"name": "SQL Prodlike", "email": email, "password": "SqlProdlike_Pass1!"},
    )
    assert reg.status_code == 201, reg.text
    tenant_id = reg.json()["tenant_id"]
    login = await ac.post(
        "/api/v1/admin/login",
        json={"email": email, "password": "SqlProdlike_Pass1!"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return tenant_id, email, {"Authorization": f"Bearer {token}"}


async def _set_plan(email: str, plan: str) -> None:
    async with async_session() as session:
        await session.execute(update(Tenant).where(Tenant.email == email).values(plan=plan))
        await session.commit()


def _db_payload() -> dict:
    return {
        "db_type": "postgresql",
        "db_host": settings.POSTGRES_SERVER,
        "db_port": settings.POSTGRES_PORT,
        "db_name": settings.POSTGRES_DB,
        "db_username": settings.POSTGRES_USER,
        "db_password": settings.POSTGRES_PASSWORD,
    }


@pytest.mark.asyncio
async def test_task05_sql_prodlike_plan_gate_and_tenant_isolation(async_client):
    tenant_a_id, email_a, headers_a = await _register_and_login(async_client)
    tenant_b_id, email_b, headers_b = await _register_and_login(async_client)

    # Starter phải bị chặn ở endpoint DB config/test (không có SQL entitlement).
    starter_payload = _db_payload()
    blocked_test = await async_client.post(
        "/api/v1/admin/database/test", headers=headers_a, json=starter_payload
    )
    assert blocked_test.status_code == 403
    blocked_save = await async_client.post(
        "/api/v1/admin/database", headers=headers_a, json=starter_payload
    )
    assert blocked_save.status_code == 403

    # Nâng tenant A lên pro để cho phép kết nối SQL.
    await _set_plan(email_a, "pro")
    ok_test = await async_client.post(
        "/api/v1/admin/database/test", headers=headers_a, json=starter_payload
    )
    assert ok_test.status_code == 200
    assert ok_test.json().get("status") == "success", ok_test.text

    ok_save = await async_client.post(
        "/api/v1/admin/database", headers=headers_a, json=starter_payload
    )
    assert ok_save.status_code == 200, ok_save.text

    # Tenant A có schema, tenant B vẫn không được "thấy" dữ liệu A.
    schema_a = await get_schema(tenant_a_id, force_refresh=True)
    assert "error" not in schema_a
    assert isinstance(schema_a.get("tables"), dict)
    assert len(schema_a["tables"]) > 0

    # tenant B vẫn starter và chưa có cấu hình DB -> không có schema.
    await _set_plan(email_b, "pro")
    schema_b = await get_schema(tenant_b_id, force_refresh=True)
    assert "error" in schema_b
    assert "database connection" in schema_b["error"].lower()

    # GET /database chỉ trả config của chính tenant đang auth.
    cfg_a = await async_client.get("/api/v1/admin/database", headers=headers_a)
    cfg_b = await async_client.get("/api/v1/admin/database", headers=headers_b)
    assert cfg_a.status_code == 200
    assert cfg_b.status_code == 200
    assert cfg_a.json().get("config") is not None
    assert cfg_b.json().get("config") is None
