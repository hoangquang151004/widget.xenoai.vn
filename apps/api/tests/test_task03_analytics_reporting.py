"""TASK-03: Integration test đối soát analytics stats/history theo UTC."""

import uuid
from datetime import datetime, timedelta
from uuid import UUID

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy import Date, cast, func, or_, select

from db.session import async_session
from main import app
from models.chat import ChatMessage, ChatSession
from models.document import TenantDocument


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", timeout=30.0
    ) as client:
        yield client


async def _admin_headers(ac: httpx.AsyncClient) -> tuple[dict, UUID]:
    email = f"analytics_{uuid.uuid4().hex[:10]}@example.com"
    reg = await ac.post(
        "/api/v1/admin/register",
        json={"name": "Analytics Tenant", "email": email, "password": "Analytics_Pass1!"},
    )
    assert reg.status_code == 201, reg.text
    tenant_id = UUID(reg.json()["tenant_id"])
    login = await ac.post(
        "/api/v1/admin/login",
        json={"email": email, "password": "Analytics_Pass1!"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, tenant_id


@pytest.mark.asyncio
async def test_task03_analytics_stats_and_history_match_db(async_client):
    headers, tenant_uuid = await _admin_headers(async_client)
    now = datetime.utcnow().replace(microsecond=0)

    async with async_session() as session:
        chat_session = ChatSession(
            tenant_id=tenant_uuid,
            visitor_id="task03-visitor",
            is_active=True,
            message_count=8,
            started_at=now - timedelta(days=2),
            last_active_at=now,
        )
        session.add(chat_session)
        await session.flush()

        # Dữ liệu trải 3 ngày UTC để test history bucket.
        messages = [
            ChatMessage(
                session_id=chat_session.id,
                tenant_id=tenant_uuid,
                role="user",
                content="u1",
                created_at=(now - timedelta(days=2, hours=1)),
            ),
            ChatMessage(
                session_id=chat_session.id,
                tenant_id=tenant_uuid,
                role="assistant",
                content="a1",
                intent="RAG",
                token_count=120,
                created_at=(now - timedelta(days=2, hours=1)),
            ),
            ChatMessage(
                session_id=chat_session.id,
                tenant_id=tenant_uuid,
                role="user",
                content="u2",
                created_at=(now - timedelta(days=1, minutes=1)),
            ),
            ChatMessage(
                session_id=chat_session.id,
                tenant_id=tenant_uuid,
                role="assistant",
                content="a2",
                intent="SQL",
                token_count=80,
                created_at=(now - timedelta(days=1, minutes=1)),
            ),
            ChatMessage(
                session_id=chat_session.id,
                tenant_id=tenant_uuid,
                role="user",
                content="u3",
                created_at=now,
            ),
            ChatMessage(
                session_id=chat_session.id,
                tenant_id=tenant_uuid,
                role="assistant",
                content="a3",
                intent="GENERAL",
                token_count=60,
                created_at=now,
            ),
            ChatMessage(
                session_id=chat_session.id,
                tenant_id=tenant_uuid,
                role="assistant",
                content="a4",
                intent=None,
                token_count=40,
                created_at=now,
            ),
        ]
        session.add_all(messages)
        session.add(
            TenantDocument(
                tenant_id=tenant_uuid,
                filename="analytics.txt",
                file_type="text/plain",
                file_size=1234,
                storage_path="storage/analytics.txt",
                status="completed",
            )
        )
        await session.commit()

    # Gọi API stats/history.
    stats_res = await async_client.get("/api/v1/admin/analytics/stats", headers=headers)
    assert stats_res.status_code == 200, stats_res.text
    stats = stats_res.json()

    history_res = await async_client.get("/api/v1/admin/analytics/history?days=3", headers=headers)
    assert history_res.status_code == 200, history_res.text
    history = history_res.json()

    # Đối soát trực tiếp DB.
    async with async_session() as session:
        total_user = int(
            (await session.scalar(
                select(func.count(ChatMessage.id)).where(
                    ChatMessage.tenant_id == tenant_uuid,
                    ChatMessage.role == "user",
                )
            )) or 0
        )
        doc_count = int(
            (await session.scalar(
                select(func.count(TenantDocument.id)).where(
                    TenantDocument.tenant_id == tenant_uuid
                )
            )) or 0
        )
        token_sum = int(
            (await session.scalar(
                select(func.coalesce(func.sum(ChatMessage.token_count), 0)).where(
                    ChatMessage.tenant_id == tenant_uuid,
                    ChatMessage.role == "assistant",
                )
            )) or 0
        )
        rag = int((await session.scalar(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.tenant_id == tenant_uuid,
                ChatMessage.role == "assistant",
                ChatMessage.intent == "RAG",
            )
        )) or 0)
        sql = int((await session.scalar(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.tenant_id == tenant_uuid,
                ChatMessage.role == "assistant",
                ChatMessage.intent == "SQL",
            )
        )) or 0)
        gen = int((await session.scalar(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.tenant_id == tenant_uuid,
                ChatMessage.role == "assistant",
                ChatMessage.intent == "GENERAL",
            )
        )) or 0)
        other = int((await session.scalar(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.tenant_id == tenant_uuid,
                ChatMessage.role == "assistant",
                or_(ChatMessage.intent.is_(None), ChatMessage.intent.notin_(["RAG", "SQL", "GENERAL"])),
            )
        )) or 0)

        rows = (
            await session.execute(
                select(
                    cast(ChatMessage.created_at, Date).label("d"),
                    func.count(ChatMessage.id).label("cnt"),
                )
                .where(
                    ChatMessage.tenant_id == tenant_uuid,
                    ChatMessage.role == "user",
                )
                .group_by(cast(ChatMessage.created_at, Date))
            )
        ).all()
        db_by_day = {r.d.isoformat(): int(r.cnt) for r in rows if r.d is not None}

    # Assert stats khớp dữ liệu DB.
    assert stats["total_user_messages"] == total_user
    assert stats["document_count"] == doc_count
    assert stats["total_tokens_estimated"] == token_sum
    assert stats["reply_breakdown"]["rag"] == rag
    assert stats["reply_breakdown"]["sql"] == sql
    assert stats["reply_breakdown"]["general"] == gen + other
    assert stats["kpi_contract"]["timezone"] == "UTC"
    assert isinstance(stats.get("top_intents"), list)
    assert any(item["intent"] == "RAG" for item in stats["top_intents"])

    # Assert history UTC bucket khớp DB và có đủ số ngày yêu cầu.
    assert history["days"] == 3
    assert history["kpi_contract"]["timezone"] == "UTC"
    assert len(history["series"]) == 3
    for bucket in history["series"]:
        day = bucket["date"]
        assert bucket["user_messages"] == db_by_day.get(day, 0)
