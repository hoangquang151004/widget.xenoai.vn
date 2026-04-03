from datetime import datetime
import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from models.base import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    plan = Column(String(20), nullable=False, default="starter")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    widget_config = relationship(
        "TenantWidgetConfig",
        back_populates="tenant",
        uselist=False,
        cascade="all, delete-orphan",
    )
    ai_settings = relationship(
        "TenantAiSettings",
        back_populates="tenant",
        uselist=False,
        cascade="all, delete-orphan",
    )
    keys = relationship("TenantKey", back_populates="tenant", cascade="all, delete-orphan")
    allowed_origins = relationship(
        "TenantAllowedOrigin",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )
    databases = relationship("TenantDatabaseConfig", back_populates="tenant", cascade="all, delete-orphan")
    documents = relationship("TenantDocument", back_populates="tenant", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="tenant", cascade="all, delete-orphan")
    chat_analytics = relationship("ChatAnalytics", back_populates="tenant", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("plan IN ('starter', 'pro', 'enterprise')", name="ck_tenants_plan"),
    )

    def __repr__(self):
        return f"<Tenant(name='{self.name}', email='{self.email}')>"
