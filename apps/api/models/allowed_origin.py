import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from models.base import Base


class TenantAllowedOrigin(Base):
    __tablename__ = "tenant_allowed_origins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    origin = Column(String(255), nullable=False)
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    tenant = relationship("Tenant", back_populates="allowed_origins")

    __table_args__ = (
        UniqueConstraint("tenant_id", "origin", name="uq_tenant_allowed_origins_tenant_origin"),
    )
