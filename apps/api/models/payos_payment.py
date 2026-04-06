import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from models.base import Base


class PayosPaymentIntent(Base):
    """Giao dịch chờ thanh toán PayOS (order_code map tới webhook)."""

    __tablename__ = "payos_payment_intents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_code = Column(BigInteger, nullable=False, unique=True)
    target_plan = Column(String(32), nullable=False)
    amount_vnd = Column(Integer, nullable=False)
    status = Column(String(32), nullable=False, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
