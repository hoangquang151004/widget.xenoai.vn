"""Thông báo lead/đơn (MVP: log; mở rộng email/webhook sau)."""

from __future__ import annotations

import logging

from models.sales import SalesOrder
from models.tenant import Tenant

logger = logging.getLogger(__name__)


async def notify_new_lead(order: SalesOrder, tenant: Tenant) -> None:
    logger.info(
        "sales_notify event=new_lead tenant_id=%s order_id=%s phone=%s",
        tenant.id,
        order.id,
        order.customer_phone,
    )


async def notify_payment_update(order: SalesOrder, tenant: Tenant) -> None:
    logger.info(
        "sales_notify event=payment tenant_id=%s order_id=%s status=%s",
        tenant.id,
        order.id,
        order.payment_status,
    )
