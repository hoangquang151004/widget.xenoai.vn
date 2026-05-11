"""ChatSession theo visitor_id (session_id widget)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.chat import ChatSession


async def get_or_create_chat_session(
    db: AsyncSession,
    tenant_id: UUID,
    visitor_id: str,
) -> ChatSession:
    result = await db.execute(
        select(ChatSession)
        .filter(
            ChatSession.tenant_id == tenant_id,
            ChatSession.visitor_id == visitor_id,
            ChatSession.is_active == True,
        )
        .order_by(ChatSession.last_active_at.desc())
    )
    row = result.scalars().first()
    if row:
        row.last_active_at = datetime.utcnow()
        return row
    cs = ChatSession(
        tenant_id=tenant_id,
        visitor_id=visitor_id,
        is_active=True,
        started_at=datetime.utcnow(),
        last_active_at=datetime.utcnow(),
        message_count=0,
    )
    db.add(cs)
    await db.flush()
    return cs
