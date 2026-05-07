from copy import deepcopy
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from models.base import Base

_DEFAULT_FORM_FIELDS: list[dict[str, Any]] = [
    {"key": "name", "label": "Họ và tên", "type": "text", "required": True, "enabled": True, "order": 1},
    {"key": "phone", "label": "Số điện thoại", "type": "tel", "required": True, "enabled": True, "order": 2},
    {"key": "address", "label": "Địa chỉ giao hàng", "type": "text", "required": True, "enabled": True, "order": 3},
    {"key": "email", "label": "Email", "type": "email", "required": False, "enabled": False, "order": 4},
    {"key": "note", "label": "Ghi chú", "type": "textarea", "required": False, "enabled": True, "order": 5},
]

_DEFAULT_PAYMENT_METHODS: dict[str, bool] = {
    "cod": True,
    "bank_transfer": False,
    "momo": False,
    "vnpay": False,
}


def _default_form_fields() -> list[dict[str, Any]]:
    return deepcopy(_DEFAULT_FORM_FIELDS)


def _default_payment_methods() -> dict[str, bool]:
    return deepcopy(_DEFAULT_PAYMENT_METHODS)


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
    font_family = Column(String(20), nullable=False, default="sans")
    product_layout = Column(String(10), nullable=False, default="card")
    show_stock = Column(Boolean, nullable=False, default=True)
    show_rating = Column(Boolean, nullable=False, default=False)
    form_fields = Column(JSONB, nullable=False, default=_default_form_fields)
    payment_methods = Column(JSONB, nullable=False, default=_default_payment_methods)
    bank_info = Column(JSONB, nullable=True)
    action_mode = Column(String(10), nullable=False, default="lead")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tenant = relationship("Tenant", back_populates="widget_config")

    __table_args__ = (
        CheckConstraint("position IN ('bottom-right', 'bottom-left')", name="ck_widget_config_position"),
        CheckConstraint("font_family IN ('sans', 'serif')", name="ck_widget_sales_font_family"),
        CheckConstraint("product_layout IN ('card', 'list')", name="ck_widget_sales_product_layout"),
        CheckConstraint("action_mode IN ('lead', 'link', 'direct')", name="ck_widget_sales_action_mode"),
    )
