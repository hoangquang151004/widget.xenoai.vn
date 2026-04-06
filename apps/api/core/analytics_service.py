"""Tổng hợp analytics theo tenant — chat_analytics + truy vấn từ chat_messages."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any, List, Optional
from uuid import UUID

from sqlalchemy import Date, cast, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from models.chat import ChatAnalytics, ChatMessage
from models.document import TenantDocument


def _normalize_intent(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    u = str(raw).strip().upper()
    if u in ("RAG", "SQL", "GENERAL"):
        return u
    return None


def estimate_tokens_for_turn(user_text: str, assistant_text: str) -> int:
    """Ước lượng token (input+output) khi API không trả usage — ~4 ký tự/token."""
    u = max(0, len(user_text or "") // 4)
    a = max(0, len(assistant_text or "") // 4)
    return max(1, u + a)


async def record_turn_analytics(
    session: AsyncSession,
    tenant_uuid: UUID,
    intent: Optional[str],
) -> None:
    """Cộng dồn một lượt chat (user + assistant) vào bảng chat_analytics theo ngày UTC."""
    today = datetime.utcnow().date()
    inc = _normalize_intent(intent) or "GENERAL"
    inc_rag = 1 if inc == "RAG" else 0
    inc_sql = 1 if inc == "SQL" else 0

    stmt = insert(ChatAnalytics).values(
        id=uuid.uuid4(),
        tenant_id=tenant_uuid,
        date=today,
        total_sessions=0,
        total_messages=2,
        unique_visitors=0,
        rag_count=inc_rag,
        sql_count=inc_sql,
        avg_latency_ms=None,
        error_count=0,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[ChatAnalytics.tenant_id, ChatAnalytics.date],
        set_={
            "total_messages": ChatAnalytics.total_messages + 2,
            "rag_count": ChatAnalytics.rag_count + inc_rag,
            "sql_count": ChatAnalytics.sql_count + inc_sql,
        },
    )
    await session.execute(stmt)


async def fetch_analytics_stats(session: AsyncSession, tenant_uuid: UUID) -> dict[str, Any]:
    total_user = await session.scalar(
        select(func.count(ChatMessage.id)).where(
            ChatMessage.tenant_id == tenant_uuid,
            ChatMessage.role == "user",
        )
    )
    total_user = int(total_user or 0)

    doc_row = await session.execute(
        select(func.count(TenantDocument.id)).where(
            TenantDocument.tenant_id == tenant_uuid
        )
    )
    document_count = int(doc_row.scalar() or 0)

    token_sum = await session.scalar(
        select(func.coalesce(func.sum(ChatMessage.token_count), 0)).where(
            ChatMessage.tenant_id == tenant_uuid,
            ChatMessage.role == "assistant",
        )
    )
    total_tokens = int(token_sum or 0)

    # Phân loại theo intent trên tin assistant (đường thực thi thực tế)
    rag_replies = int(
        (
            await session.scalar(
                select(func.count(ChatMessage.id)).where(
                    ChatMessage.tenant_id == tenant_uuid,
                    ChatMessage.role == "assistant",
                    ChatMessage.intent == "RAG",
                )
            )
        )
        or 0
    )
    sql_replies = int(
        (
            await session.scalar(
                select(func.count(ChatMessage.id)).where(
                    ChatMessage.tenant_id == tenant_uuid,
                    ChatMessage.role == "assistant",
                    ChatMessage.intent == "SQL",
                )
            )
        )
        or 0
    )
    general_replies = int(
        (
            await session.scalar(
                select(func.count(ChatMessage.id)).where(
                    ChatMessage.tenant_id == tenant_uuid,
                    ChatMessage.role == "assistant",
                    ChatMessage.intent == "GENERAL",
                )
            )
        )
        or 0
    )
    assistant_other = int(
        (
            await session.scalar(
                select(func.count(ChatMessage.id)).where(
                    ChatMessage.tenant_id == tenant_uuid,
                    ChatMessage.role == "assistant",
                    or_(
                        ChatMessage.intent.is_(None),
                        ChatMessage.intent.notin_(["RAG", "SQL", "GENERAL"]),
                    ),
                )
            )
        )
        or 0
    )

    return {
        "total_user_messages": total_user,
        "document_count": document_count,
        "total_tokens_estimated": total_tokens,
        "reply_breakdown": {
            "rag": rag_replies,
            "sql": sql_replies,
            "general": general_replies + assistant_other,
        },
    }


async def fetch_message_history_series(
    session: AsyncSession,
    tenant_uuid: UUID,
    days: int,
) -> List[dict[str, Any]]:
    """Số tin user theo ngày (UTC) — luôn lấy từ chat_messages."""
    days = max(1, min(days, 366))
    start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(
        days=days - 1
    )

    q = (
        select(
            cast(ChatMessage.created_at, Date).label("d"),
            func.count(ChatMessage.id).label("cnt"),
        )
        .where(
            ChatMessage.tenant_id == tenant_uuid,
            ChatMessage.role == "user",
            ChatMessage.created_at >= start,
        )
        .group_by(cast(ChatMessage.created_at, Date))
        .order_by(cast(ChatMessage.created_at, Date))
    )
    rows = (await session.execute(q)).all()
    by_day = {r.d: int(r.cnt) for r in rows if r.d is not None}

    out: List[dict[str, Any]] = []
    cursor = start.date()
    end_d = datetime.utcnow().date()
    while cursor <= end_d:
        out.append(
            {
                "date": cursor.isoformat(),
                "user_messages": by_day.get(cursor, 0),
            }
        )
        cursor = cursor + timedelta(days=1)

    return out
