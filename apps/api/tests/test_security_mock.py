import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from main import app
from models.tenant import Tenant


client = TestClient(app)


MOCK_TENANT = Tenant(
    id=uuid.uuid4(),
    name="Mock Tenant",
    email="mock@example.com",
    password_hash="hashed_password",
    plan="starter",
    is_active=True,
)

MOCK_PUBLIC_KEY = SimpleNamespace(
    key_type="public",
    key_value="pk_live_mock_123",
    is_active=True,
    last_used_at=None,
)

MOCK_ADMIN_KEY = SimpleNamespace(
    key_type="admin",
    key_value="sk_live_mock_456",
    is_active=True,
    last_used_at=None,
)


def _auth_row_result(tenant_key):
    result = MagicMock()
    result.first.return_value = (tenant_key, MOCK_TENANT)
    return result


def _origin_result(origins):
    result = MagicMock()
    result.fetchall.return_value = [(origin,) for origin in origins]
    return result


def test_missing_api_key():
    response = client.get("/api/v1/chat/test")
    assert response.status_code == 401


@patch("api.middleware.async_session")
@patch("core.rate_limit.rate_limiter.is_rate_limited", new_callable=AsyncMock)
def test_valid_public_key(mock_rate_limit, mock_session_cm):
    mock_rate_limit.return_value = False

    mock_session = AsyncMock()
    mock_session_cm.return_value.__aenter__.return_value = mock_session
    mock_session.execute.side_effect = [
        _auth_row_result(MOCK_PUBLIC_KEY),
        _origin_result(["localhost:3000", "example.com"]),
    ]

    response = client.get(
        "/api/v1/chat/test",
        headers={
            "X-API-Key": "pk_live_mock_123",
            "Origin": "http://localhost:3000",
        },
    )
    assert response.status_code == 200
    assert response.json()["tenant_name"] == "Mock Tenant"
    assert response.json()["is_admin"] is False


@patch("api.middleware.async_session")
@patch("core.rate_limit.rate_limiter.is_rate_limited", new_callable=AsyncMock)
def test_invalid_origin(mock_rate_limit, mock_session_cm):
    mock_rate_limit.return_value = False

    mock_session = AsyncMock()
    mock_session_cm.return_value.__aenter__.return_value = mock_session
    mock_session.execute.side_effect = [
        _auth_row_result(MOCK_PUBLIC_KEY),
        _origin_result(["localhost:3000", "example.com"]),
    ]

    response = client.get(
        "/api/v1/chat/test",
        headers={
            "X-API-Key": "pk_live_mock_123",
            "Origin": "http://hacker.com",
        },
    )
    assert response.status_code == 403
    assert "not authorized" in response.json()["detail"]


@patch("api.middleware.async_session")
@patch("core.rate_limit.rate_limiter.is_rate_limited", new_callable=AsyncMock)
def test_rate_limiting_triggered(mock_rate_limit, mock_session_cm):
    mock_rate_limit.return_value = True

    mock_session = AsyncMock()
    mock_session_cm.return_value.__aenter__.return_value = mock_session
    mock_session.execute.side_effect = [
        _auth_row_result(MOCK_ADMIN_KEY),
    ]

    response = client.get(
        "/api/v1/chat/test",
        headers={"X-API-Key": "sk_live_mock_456"},
    )
    assert response.status_code == 429
    assert "Too many" in response.json()["detail"]

