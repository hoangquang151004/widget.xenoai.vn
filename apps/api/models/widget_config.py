from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from models.base import Base


class TenantWidgetConfig(Base):
    __tablename__ = "tenant_widget_configs"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True)
    bot_name = Column(String(255), nullable=False, default="Tro ly AI")
    primary_color = Column(String(20), nullable=False, default="#2563eb")
    logo_url = Column(String(500), nullable=True)
    greeting = Column(String(500), nullable=False, default="Xin chao! Toi co the giup gi cho ban?")
    placeholder = Column(String(255), nullable=False, default="Nhap cau hoi...")
    position = Column(String(20), nullable=False, default="bottom-right")
    show_sources = Column(Boolean, nullable=False, default=True)
    font_size = Column(String(10), nullable=False, default="14px")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tenant = relationship("Tenant", back_populates="widget_config")

    __table_args__ = (
        CheckConstraint("position IN ('bottom-right', 'bottom-left')", name="ck_widget_config_position"),
    )
