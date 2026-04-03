import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from models.base import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    visitor_id = Column(String(255), nullable=False, index=True)
    visitor_meta = Column(JSONB, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    message_count = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_active_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)

    tenant = relationship("Tenant", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    intent = Column(String(100), nullable=True)
    rag_sources = Column(JSONB, nullable=True)
    sql_query = Column(Text, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    token_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("ChatSession", back_populates="messages")

    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant', 'system')", name="ck_chat_messages_role"),
    )


class ChatAnalytics(Base):
    __tablename__ = "chat_analytics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    total_sessions = Column(Integer, nullable=False, default=0)
    total_messages = Column(Integer, nullable=False, default=0)
    unique_visitors = Column(Integer, nullable=False, default=0)
    rag_count = Column(Integer, nullable=False, default=0)
    sql_count = Column(Integer, nullable=False, default=0)
    avg_latency_ms = Column(Integer, nullable=True)
    error_count = Column(Integer, nullable=False, default=0)

    tenant = relationship("Tenant", back_populates="chat_analytics")

    __table_args__ = (
        UniqueConstraint("tenant_id", "date", name="uq_chat_analytics_tenant_date"),
    )
