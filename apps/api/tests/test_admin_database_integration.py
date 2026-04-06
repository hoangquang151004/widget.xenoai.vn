"""
Tích hợp admin database + Text-to-SQL schema introspection (một test async duy nhất)
để tránh xung đột event loop / asyncpg trên Windows giữa các test ASGI liên tiếp.
"""
import os
import uuid

import httpx
import pytest
from httpx import ASGITransport

from ai.sql.schema_loader import get_schema
from core.config import settings
from core.security import security_utils
from main import app
from db.session import async_session
from models.tenant import Tenant
from sqlalchemy import update


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", timeout=30.0
    ) as client:
        yield client


async def _admin_headers(ac: httpx.AsyncClient):
    email = f"db_e2e_{uuid.uuid4().hex[:10]}@example.com"
    reg = await ac.post(
        "/api/v1/admin/register",
        json={"name": "DB E2E Tenant", "email": email, "password": "E2eTest_Pass1!"},
    )
    assert reg.status_code == 201, reg.text
    login = await ac.post(
        "/api/v1/admin/login",
        json={"email": email, "password": "E2eTest_Pass1!"},
    )
    assert login.status_code == 200, login.text
    login_body = login.json()
    assert login_body.get("role") == "tenant"
    token = login_body["access_token"]
    return {"Authorization": f"Bearer {token}"}, email


async def _set_tenant_plan(email: str, plan: str) -> None:
    """Gói starter không được test/lưu Text-to-SQL — nâng lên pro cho bài integration."""
    async with async_session() as session:
        await session.execute(
            update(Tenant).where(Tenant.email == email).values(plan=plan)
        )
        await session.commit()


def _target_db_payload():
    return {
        "db_type": "postgresql",
        "db_host": settings.POSTGRES_SERVER,
        "db_port": settings.POSTGRES_PORT,
        "db_name": settings.POSTGRES_DB,
        "db_username": settings.POSTGRES_USER,
        "db_password": settings.POSTGRES_PASSWORD,
    }


@pytest.mark.skipif(
    os.getenv("SKIP_DB_INTEGRATION") == "1",
    reason="SKIP_DB_INTEGRATION=1",
)
@pytest.mark.asyncio
async def test_admin_database_flow_save_roundtrip_and_bad_password_test(async_client):
    headers, email = await _admin_headers(async_client)
    await _set_tenant_plan(email, "pro")
    r = await async_client.get("/api/v1/admin/database", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body.get("config") is None or isinstance(body.get("config"), dict)

    payload = _target_db_payload()
    r = await async_client.post(
        "/api/v1/admin/database/test", headers=headers, json=payload
    )
    assert r.status_code == 200
    assert r.json().get("status") == "success", r.text

    r = await async_client.post("/api/v1/admin/database", headers=headers, json=payload)
    assert r.status_code == 200, r.text

    r = await async_client.get("/api/v1/admin/database", headers=headers)
    assert r.status_code == 200
    cfg = r.json().get("config")
    assert cfg is not None
    assert cfg["db_host"] == payload["db_host"]
    assert cfg["db_name"] == payload["db_name"]
    assert cfg["db_username"] == payload["db_username"]
    assert cfg["db_password"] == "••••••••"

    headers2, email2 = await _admin_headers(async_client)
    await _set_tenant_plan(email2, "pro")
    bad = _target_db_payload()
    bad["db_password"] = "definitely_wrong_password_xyz"
    r = await async_client.post(
        "/api/v1/admin/database/test", headers=headers2, json=bad
    )
    assert r.status_code == 200
    assert r.json().get("status") == "error"

    email3 = f"t2s_{uuid.uuid4().hex[:10]}@example.com"
    reg3 = await async_client.post(
        "/api/v1/admin/register",
        json={"name": "T2S Schema", "email": email3, "password": "E2eTest_Pass1!"},
    )
    assert reg3.status_code == 201, reg3.text
    tenant_id3 = reg3.json()["tenant_id"]
    login3 = await async_client.post(
        "/api/v1/admin/login",
        json={"email": email3, "password": "E2eTest_Pass1!"},
    )
    assert login3.status_code == 200, login3.text
    token3 = login3.json()["access_token"]
    headers3 = {"Authorization": f"Bearer {token3}"}
    await _set_tenant_plan(email3, "pro")
    r = await async_client.post(
        "/api/v1/admin/database", headers=headers3, json=payload
    )
    assert r.status_code == 200, r.text
    schema = await get_schema(tenant_id3, force_refresh=True)
    assert "error" not in schema
    assert "tables" in schema
    assert isinstance(schema["tables"], dict)
    assert len(schema["tables"]) > 0

    # Role: platform_admin — GET /me được; PATCH /me và billing bị 403 (cùng event loop với test này)
    email_pa = f"plat_{uuid.uuid4().hex[:10]}@example.com"
    async with async_session() as session:
        session.add(
            Tenant(
                name="Platform E2E",
                email=email_pa,
                password_hash=security_utils.hash_password("PlatformE2e_Pass1!"),
                plan="enterprise",
                role="platform_admin",
                is_active=True,
            )
        )
        await session.commit()
    login_pa = await async_client.post(
        "/api/v1/admin/login",
        json={"email": email_pa, "password": "PlatformE2e_Pass1!"},
    )
    assert login_pa.status_code == 200, login_pa.text
    assert login_pa.json().get("role") == "platform_admin"
    h_pa = {"Authorization": f"Bearer {login_pa.json()['access_token']}"}
    me_pa = await async_client.get("/api/v1/admin/me", headers=h_pa)
    assert me_pa.status_code == 200
    assert me_pa.json().get("role") == "platform_admin"
    patch_pa = await async_client.patch(
        "/api/v1/admin/me", headers=h_pa, json={"name": "nope"}
    )
    assert patch_pa.status_code == 403
    bill_pa = await async_client.get("/api/v1/admin/billing/summary", headers=h_pa)
    assert bill_pa.status_code == 403

    st_pa = await async_client.get("/api/v1/platform-admin/stats", headers=h_pa)
    assert st_pa.status_code == 200
    assert "tenants_total" in st_pa.json()

    st_tenant = await async_client.get(
        "/api/v1/platform-admin/stats", headers=headers
    )
    assert st_tenant.status_code == 403

    me_t = await async_client.get("/api/v1/admin/me", headers=headers)
    assert me_t.status_code == 200
    tid = me_t.json()["id"]
    imp = await async_client.post(
        "/api/v1/platform-admin/impersonate",
        headers=h_pa,
        json={"tenant_id": tid},
    )
    assert imp.status_code == 200, imp.text
    h_imp = {"Authorization": f"Bearer {imp.json()['access_token']}"}
    me_imp = await async_client.get("/api/v1/admin/me", headers=h_imp)
    assert me_imp.status_code == 200
    assert me_imp.json().get("role") == "tenant"
    st_imp = await async_client.get("/api/v1/platform-admin/stats", headers=h_imp)
    assert st_imp.status_code == 403
