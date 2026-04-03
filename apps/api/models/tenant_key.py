import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from models.base import Base


class TenantKey(Base):
    __tablename__ = "tenant_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    key_type = Column(String(20), nullable=False)
    key_value = Column(String(255), nullable=False, unique=True, index=True)
    label = Column(String(255), nullable=False, default="Default")
    is_active = Column(Boolean, nullable=False, default=True)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    tenant = relationship("Tenant", back_populates="keys")

    __table_args__ = (
        CheckConstraint("key_type IN ('public', 'admin')", name="ck_tenant_keys_key_type"),
    )
