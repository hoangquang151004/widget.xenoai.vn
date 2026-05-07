import json
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from core.security import security_utils
from models.base import Base

class PlatformConnector(Base):
    __tablename__ = "platform_connectors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    platform = Column(String(20), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    credentials_enc = Column(Text, nullable=False)
    config = Column(JSONB, nullable=False, default=lambda: {})
    last_synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String(20), nullable=False, default="pending")
    sync_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tenant = relationship("Tenant", back_populates="platform_connectors")

    __table_args__ = (
        UniqueConstraint("tenant_id", "platform", name="uq_platform_connectors_tenant_platform"),
        CheckConstraint(
            "platform IN ('woocommerce', 'shopify', 'generic')",
            name="ck_platform_connectors_platform",
        ),
    )

    @property
    def credentials(self) -> dict[str, Any]:
        raw = security_utils.decrypt(self.credentials_enc)
        return json.loads(raw)

    @credentials.setter
    def credentials(self, value: dict[str, Any]) -> None:
        self.credentials_enc = security_utils.encrypt(json.dumps(value, ensure_ascii=False))


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    external_id = Column(String(255), nullable=False)
    platform = Column(String(20), nullable=False)
    name = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(12, 0), nullable=True)
    compare_price = Column(Numeric(12, 0), nullable=True)
    sku = Column(String(255), nullable=True)
    stock_quantity = Column(Integer, nullable=True)
    in_stock = Column(Boolean, nullable=False, default=True)
    images = Column(JSONB, nullable=False, default=lambda: [])
    variants = Column(JSONB, nullable=False, default=lambda: [])
    tags = Column(ARRAY(Text), nullable=True)
    category = Column(String(255), nullable=True)
    raw_data = Column(JSONB, nullable=True)
    vector_synced = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tenant = relationship("Tenant", back_populates="products")

    __table_args__ = (
        UniqueConstraint("tenant_id", "platform", "external_id", name="uq_products_tenant_platform_external"),
    )


class SalesOrder(Base):
    """Đơn hàng / lead trên chat — bảng PostgreSQL `orders`."""

    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    chat_session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_mode = Column(String(10), nullable=False)
    customer_name = Column(String(255), nullable=True)
    customer_phone = Column(String(20), nullable=True)
    customer_email = Column(String(255), nullable=True)
    customer_address = Column(Text, nullable=True)
    items = Column(JSONB, nullable=False, default=lambda: [])
    subtotal = Column(Numeric(12, 0), nullable=True)
    status = Column(String(30), nullable=False, default="pending")
    external_order_id = Column(String(255), nullable=True)
    external_order_url = Column(Text, nullable=True)
    payment_method = Column(String(20), nullable=True)
    payment_status = Column(String(20), nullable=False, default="unpaid")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tenant = relationship("Tenant", back_populates="sales_orders")
    chat_session = relationship("ChatSession", back_populates="sales_orders")

    __table_args__ = (
        CheckConstraint(
            "source_mode IN ('lead', 'link', 'direct')",
            name="ck_orders_source_mode",
        ),
    )