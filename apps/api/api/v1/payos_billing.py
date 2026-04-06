"""PayOS: cấu hình, tạo link thanh toán, webhook cập nhật tenants.plan."""

from __future__ import annotations

import logging
import random
import time
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from core.config import settings
from core.deps import require_tenant_account
from core.payos_plans import amount_vnd_for_plan, can_upgrade_to
from core.plan_limits import normalize_plan
from db.session import async_session
from models.payos_payment import PayosPaymentIntent
from models.tenant import Tenant

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Billing — PayOS"])


def _payos_fully_configured() -> bool:
    return bool(
        settings.PAYOS_CLIENT_ID.strip()
        and settings.PAYOS_API_KEY.strip()
        and settings.PAYOS_CHECKSUM_KEY.strip()
        and settings.PAYOS_CHECKOUT_RETURN_URL.strip()
        and settings.PAYOS_CHECKOUT_CANCEL_URL.strip()
    )


def _amounts() -> tuple[int, int, int]:
    return (
        int(settings.PAYOS_AMOUNT_PRO_VND),
        int(settings.PAYOS_AMOUNT_ENTERPRISE_VND),
        int(settings.PAYOS_AMOUNT_ENTERPRISE_PRO_VND),
    )


def _generate_order_code() -> int:
    """Số nguyên duy nhất cho PayOS (thử vài lần nếu trùng)."""
    base = int(time.time() * 1000) % 10**10
    return base * 10000 + random.randint(0, 9999)


class PayosConfigResponse(BaseModel):
    payos_enabled: bool


@router.get(
    "/admin/billing/payos/config",
    response_model=PayosConfigResponse,
    dependencies=[Depends(require_tenant_account)],
)
async def get_payos_config(request: Request) -> PayosConfigResponse:
    if not getattr(request.state, "is_admin", False):
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")
    return PayosConfigResponse(payos_enabled=_payos_fully_configured())


class PayosCheckoutBody(BaseModel):
    target_plan: str = Field(
        ...,
        description="pro | enterprise | enterprise_pro",
    )


class PayosCheckoutResponse(BaseModel):
    checkout_url: str
    order_code: int


@router.post(
    "/admin/billing/payos/checkout",
    response_model=PayosCheckoutResponse,
    dependencies=[Depends(require_tenant_account)],
)
async def create_payos_checkout(
    request: Request,
    body: PayosCheckoutBody,
) -> PayosCheckoutResponse:
    if not getattr(request.state, "is_admin", False):
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    if not _payos_fully_configured():
        raise HTTPException(
            status_code=503,
            detail="PayOS chưa được cấu hình đầy đủ (CLIENT_ID, API_KEY, CHECKSUM_KEY, RETURN/CANCEL URL).",
        )

    target = normalize_plan(body.target_plan.strip().lower())
    if target not in ("pro", "enterprise", "enterprise_pro"):
        raise HTTPException(status_code=400, detail="Gói đích không hỗ trợ thanh toán trực tuyến.")

    a_pro, a_ent, a_ep = _amounts()
    amount = amount_vnd_for_plan(target, a_pro, a_ent, a_ep)
    if amount is None or amount <= 0:
        raise HTTPException(status_code=400, detail="Không có mức giá cho gói này.")

    tenant_uuid = UUID(str(request.state.tenant_id))

    from payos import AsyncPayOS
    from payos.types.v2 import CreatePaymentLinkRequest

    async with async_session() as session:
        tenant = await session.get(Tenant, tenant_uuid)
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant không tồn tại")

        if not can_upgrade_to(tenant.plan, target):
            raise HTTPException(
                status_code=400,
                detail="Bạn đã ở gói cao hơn hoặc cùng gói — không cần thanh toán nâng cấp.",
            )

        buyer_email = tenant.email
        buyer_name = tenant.name

        order_code: int | None = None
        for _ in range(15):
            candidate = _generate_order_code()
            intent = PayosPaymentIntent(
                tenant_id=tenant_uuid,
                order_code=candidate,
                target_plan=target,
                amount_vnd=amount,
                status="pending",
            )
            session.add(intent)
            try:
                await session.commit()
                order_code = candidate
                break
            except IntegrityError:
                await session.rollback()
                continue

        if order_code is None:
            raise HTTPException(
                status_code=500, detail="Không tạo được mã đơn hàng PayOS (trùng). Thử lại."
            )

    client = AsyncPayOS(
        client_id=settings.PAYOS_CLIENT_ID.strip(),
        api_key=settings.PAYOS_API_KEY.strip(),
        checksum_key=settings.PAYOS_CHECKSUM_KEY.strip(),
    )

    req = CreatePaymentLinkRequest(
        order_code=order_code,
        amount=amount,
        description=f"Widget Chatbot — nâng cấp {target}",
        cancel_url=settings.PAYOS_CHECKOUT_CANCEL_URL.strip(),
        return_url=settings.PAYOS_CHECKOUT_RETURN_URL.strip(),
        buyer_email=buyer_email,
        buyer_name=buyer_name,
    )

    try:
        res = await client.payment_requests.create(req)
    except Exception as e:
        async with async_session() as sdel:
            await sdel.execute(
                delete(PayosPaymentIntent).where(
                    PayosPaymentIntent.order_code == order_code
                )
            )
            await sdel.commit()
        logger.exception("PayOS create payment failed: %s", e)
        raise HTTPException(
            status_code=502,
            detail="Không tạo được link thanh toán PayOS. Thử lại sau.",
        ) from e

    return PayosCheckoutResponse(
        checkout_url=res.checkout_url,
        order_code=order_code,
    )


@router.post("/webhooks/payos")
async def payos_webhook(request: Request) -> dict:
    """PayOS gọi — không Bearer; xác thực bằng signature."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if not settings.PAYOS_CHECKSUM_KEY.strip():
        raise HTTPException(status_code=503, detail="PayOS checksum chưa cấu hình")

    from payos import AsyncPayOS, WebhookError

    if not (
        settings.PAYOS_CLIENT_ID.strip()
        and settings.PAYOS_API_KEY.strip()
    ):
        raise HTTPException(status_code=503, detail="PayOS API chưa cấu hình")

    client = AsyncPayOS(
        client_id=settings.PAYOS_CLIENT_ID.strip(),
        api_key=settings.PAYOS_API_KEY.strip(),
        checksum_key=settings.PAYOS_CHECKSUM_KEY.strip(),
    )

    try:
        data = await client.webhooks.verify(body)
    except WebhookError as e:
        logger.warning("PayOS webhook verify failed: %s", e)
        raise HTTPException(status_code=400, detail="Chữ ký webhook không hợp lệ") from e
    except Exception as e:
        logger.exception("PayOS webhook error: %s", e)
        raise HTTPException(status_code=400, detail="Webhook không hợp lệ") from e

    if body.get("code") != "00":
        logger.info("PayOS webhook non-success code=%s", body.get("code"))
        return {"success": True}

    order_code = int(data.order_code)
    amount = int(data.amount)

    async with async_session() as session:
        result = await session.execute(
            select(PayosPaymentIntent).where(
                PayosPaymentIntent.order_code == order_code
            )
        )
        intent = result.scalar_one_or_none()
        if not intent:
            logger.error("PayOS webhook: unknown order_code=%s", order_code)
            return {"success": True}

        if intent.status == "completed":
            return {"success": True}

        if amount != intent.amount_vnd:
            logger.error(
                "PayOS webhook amount mismatch order=%s expected=%s got=%s",
                order_code,
                intent.amount_vnd,
                amount,
            )
            raise HTTPException(status_code=400, detail="Số tiền không khớp")

        tenant = await session.get(Tenant, intent.tenant_id)
        if tenant:
            tenant.plan = intent.target_plan
            tenant.updated_at = datetime.utcnow()
        intent.status = "completed"
        intent.completed_at = datetime.utcnow()
        await session.commit()

    logger.info(
        "PayOS payment completed tenant=%s plan=%s order=%s",
        intent.tenant_id,
        intent.target_plan,
        order_code,
    )
    return {"success": True}
