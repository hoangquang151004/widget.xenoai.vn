from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from models.base import Base


class TenantAiSettings(Base):
    __tablename__ = "tenant_ai_settings"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True)
    system_prompt = Column(
        String(2000),
        nullable=False,
        default="Ban la mot tro ly AI chuyen nghiep va than thien.",
    )
    is_rag_enabled = Column(Boolean, nullable=False, default=True)
    is_sql_enabled = Column(Boolean, nullable=False, default=False)
    temperature = Column(Float, nullable=False, default=0.7)
    max_tokens = Column(Integer, nullable=False, default=2048)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tenant = relationship("Tenant", back_populates="ai_settings")
