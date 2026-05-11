"""TASK-04: RBAC matrix + impersonation claim checks."""

import uuid

import httpx
import pytest
from httpx import ASGITransport

from core.security import security_utils
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


async def _create_tenant_account(ac: httpx.AsyncClient) -> tuple[str, str]:
    email = f"task04_tenant_{uuid.uuid4().hex[:8]}@example.com"
    reg = await ac.post(
        "/api/v1/admin/register",
        json={"name": "Task04 Tenant", "email": email, "password": "Task04_Pass1!"},
    )
    assert reg.status_code == 201, reg.text
    tenant_id = reg.json()["tenant_id"]
    login = await ac.post(
        "/api/v1/admin/login",
        json={"email": email, "password": "Task04_Pass1!"},
    )
    assert login.status_code == 200, login.text
    return tenant_id, login.json()["access_token"]


async def _create_platform_admin_token() -> tuple[str, str]:
    admin_id = uuid.uuid4()
    email = f"task04_admin_{uuid.uuid4().hex[:8]}@example.com"
    async with async_session() as session:
        session.add(
            Tenant(
                id=admin_id,
                name="Task04 Platform Admin",
                email=email,
                password_hash=security_utils.hash_password("Task04_AdminPass1!"),
                role="platform_admin",
                plan="enterprise",
                is_active=True,
            )
        )
        await session.commit()
    token = security_utils.generate_admin_token(
        str(admin_id),
        email,
        role="platform_admin",
    )
    return str(admin_id), token


@pytest.mark.asyncio
async def test_task04_platform_admin_rbac_matrix(async_client):
    target_tenant_id, tenant_token = await _create_tenant_account(async_client)
    _, platform_token = await _create_platform_admin_token()

    tenant_h = {"Authorization": f"Bearer {tenant_token}"}
    pa_h = {"Authorization": f"Bearer {platform_token}"}

    # Tenant thường phải bị chặn ở toàn bộ endpoint platform-admin.
    tenant_paths = [
        ("GET", "/api/v1/platform-admin/stats", None),
        ("GET", "/api/v1/platform-admin/tenants", None),
        ("GET", "/api/v1/platform-admin/billing/summary", None),
        ("GET", "/api/v1/platform-admin/system/status", None),
        ("PATCH", f"/api/v1/platform-admin/tenants/{target_tenant_id}", {"is_active": True}),
        ("POST", "/api/v1/platform-admin/impersonate", {"tenant_id": target_tenant_id}),
    ]
    for method, path, body in tenant_paths:
        req = getattr(async_client, method.lower())
        resp = await req(path, headers=tenant_h, json=body) if body is not None else await req(path, headers=tenant_h)
        assert resp.status_code == 403, f"{method} {path} should be 403 for tenant"

    # Platform admin được phép truy cập endpoints cốt lõi.
    assert (await async_client.get("/api/v1/platform-admin/stats", headers=pa_h)).status_code == 200
    assert (await async_client.get("/api/v1/platform-admin/tenants", headers=pa_h)).status_code == 200
    assert (await async_client.get("/api/v1/platform-admin/billing/summary", headers=pa_h)).status_code == 200
    assert (await async_client.get("/api/v1/platform-admin/system/status", headers=pa_h)).status_code == 200
    res = await async_client.post(
        "/api/v1/platform-admin/impersonate",
        headers=pa_h,
        json={"tenant_id": target_tenant_id},
    )
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    payload = security_utils.verify_admin_token(token)
    assert payload is not None
    assert payload.get("impersonator_sub"), "Missing impersonator_sub for audit trail"
    assert payload.get("scope") == "tenant_impersonation"
    # TTL ngắn: endpoint trả về expires_in_minutes theo config impersonation
    assert int(res.json()["expires_in_minutes"]) <= 60
