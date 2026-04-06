"""API quản trị nền tảng — chỉ `tenants.role = platform_admin`."""

from __future__ import annotations

import logging
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, update
from core.config import settings
from core.deps import require_platform_admin
from core.security import security_utils
from db.session import async_session
from models.payos_payment import PayosPaymentIntent
from models.tenant import Tenant

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_platform_admin)])


class TenantStatusBody(BaseModel):
    is_active: bool


class ImpersonateBody(BaseModel):
    tenant_id: UUID


def _celery_ping() -> dict[str, Any]:
    try:
        from worker.celery_app import celery_app

        insp = celery_app.control.inspect(timeout=1.0)
        ping = insp.ping()
        ok = bool(ping)
        return {"status": "ok" if ok else "error", "workers": len(ping) if ping else 0}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


async def _collect_infra_status() -> dict[str, Any]:
    """Cùng logic với GET /api/health/detailed (PostgreSQL, Redis, Qdrant) + Celery ping."""
    checks: dict[str, Any] = {}

    try:
        from sqlalchemy import text

        from db.session import async_session

        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        checks["postgresql"] = {"status": "ok"}
    except Exception as e:
        checks["postgresql"] = {"status": "error", "detail": str(e)}

    try:
        from redis import Redis

        r = Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, socket_timeout=2)
        r.ping()
        checks["redis"] = {"status": "ok"}
    except Exception as e:
        checks["redis"] = {"status": "error", "detail": str(e)}

    try:
        from qdrant_client import AsyncQdrantClient

        client = AsyncQdrantClient(
            host=settings.QDRANT_HOST, port=settings.QDRANT_PORT, timeout=2
        )
        await client.get_collections()
        checks["qdrant"] = {"status": "ok"}
    except Exception as e:
        checks["qdrant"] = {"status": "error", "detail": str(e)}

    checks["celery"] = _celery_ping()

    overall = (
        "ok"
        if all(
            v.get("status") == "ok"
            for k, v in checks.items()
            if k != "celery"
        )
        and checks.get("celery", {}).get("status") == "ok"
        else "degraded"
    )
    return {"overall": overall, "services": checks}


@router.get("/stats")
async def platform_stats():
    """Số liệu tổng quan nền tảng."""
    async with async_session() as session:
        total_t = await session.scalar(
            select(func.count(Tenant.id)).where(Tenant.role == "tenant")
        )
        active_t = await session.scalar(
            select(func.count(Tenant.id)).where(
                Tenant.role == "tenant", Tenant.is_active.is_(True)
            )
        )
        total_pa = await session.scalar(
            select(func.count(Tenant.id)).where(Tenant.role == "platform_admin")
        )

        plan_rows = await session.execute(
            select(Tenant.plan, func.count(Tenant.id))
            .where(Tenant.role == "tenant")
            .group_by(Tenant.plan)
        )
        plan_distribution = {row[0]: int(row[1]) for row in plan_rows.all()}

        rev = await session.scalar(
            select(func.coalesce(func.sum(PayosPaymentIntent.amount_vnd), 0)).where(
                PayosPaymentIntent.status == "completed"
            )
        )
        pay_count = await session.scalar(
            select(func.count(PayosPaymentIntent.id)).where(
                PayosPaymentIntent.status == "completed"
            )
        )

    return {
        "tenants_total": int(total_t or 0),
        "tenants_active": int(active_t or 0),
        "platform_admins": int(total_pa or 0),
        "plan_distribution": plan_distribution,
        "payos": {
            "completed_payments": int(pay_count or 0),
            "revenue_vnd": int(rev or 0),
        },
    }


@router.get("/tenants")
async def list_customers(
    q: Optional[str] = Query(None, max_length=200),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Danh sách khách hàng (role = tenant)."""
    async with async_session() as session:
        stmt = select(Tenant).where(Tenant.role == "tenant")
        if q and q.strip():
            pattern = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(Tenant.name.ilike(pattern), Tenant.email.ilike(pattern))
            )
        stmt = stmt.order_by(Tenant.created_at.desc()).limit(limit).offset(offset)
        result = await session.execute(stmt)
        rows: List[Tenant] = list(result.scalars().all())

        count_stmt = select(func.count(Tenant.id)).where(Tenant.role == "tenant")
        if q and q.strip():
            pattern = f"%{q.strip()}%"
            count_stmt = count_stmt.where(
                or_(Tenant.name.ilike(pattern), Tenant.email.ilike(pattern))
            )
        total = await session.scalar(count_stmt)
        total = int(total or 0)

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [
            {
                "id": str(t.id),
                "name": t.name,
                "email": t.email,
                "plan": t.plan,
                "is_active": t.is_active,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in rows
        ],
    }


@router.patch("/tenants/{tenant_id}")
async def set_tenant_active(tenant_id: UUID, body: TenantStatusBody):
    """Kích hoạt / khóa tài khoản tenant."""
    async with async_session() as session:
        res = await session.execute(
            select(Tenant).where(Tenant.id == tenant_id, Tenant.role == "tenant")
        )
        tenant = res.scalars().first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Không tìm thấy tenant.")

        await session.execute(
            update(Tenant).where(Tenant.id == tenant_id).values(is_active=body.is_active)
        )
        await session.commit()

    logger.info(
        "platform_admin_tenant_status",
        extra={"tenant_id": str(tenant_id), "is_active": body.is_active},
    )
    return {"id": str(tenant_id), "is_active": body.is_active}


@router.post("/impersonate")
async def impersonate_tenant(payload: ImpersonateBody, request: Request):
    """Cấp token Bearer để thao tác dashboard như tenant (audit qua log + JWT claim)."""
    admin_id = request.state.tenant_id
    async with async_session() as session:
        res = await session.execute(
            select(Tenant).where(Tenant.id == payload.tenant_id, Tenant.role == "tenant")
        )
        target = res.scalars().first()
        if not target:
            raise HTTPException(status_code=404, detail="Không tìm thấy tenant.")
        if not target.is_active:
            raise HTTPException(status_code=400, detail="Tenant đang bị khóa.")

    token = security_utils.generate_admin_token(
        str(target.id),
        target.email or "",
        role="tenant",
        impersonator_sub=str(admin_id),
    )
    logger.info(
        "impersonate_issued",
        extra={
            "impersonator_sub": str(admin_id),
            "target_tenant_id": str(target.id),
        },
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        "tenant": {
            "id": str(target.id),
            "name": target.name,
            "email": target.email,
        },
    }


@router.get("/billing/summary")
async def platform_billing_summary():
    """Tổng hợp giao dịch PayOS (nếu có bảng)."""
    async with async_session() as session:
        rev = await session.scalar(
            select(func.coalesce(func.sum(PayosPaymentIntent.amount_vnd), 0)).where(
                PayosPaymentIntent.status == "completed"
            )
        )
        pending = await session.scalar(
            select(func.count(PayosPaymentIntent.id)).where(
                PayosPaymentIntent.status == "pending"
            )
        )
        completed = await session.scalar(
            select(func.count(PayosPaymentIntent.id)).where(
                PayosPaymentIntent.status == "completed"
            )
        )
        recent = await session.execute(
            select(PayosPaymentIntent)
            .order_by(PayosPaymentIntent.created_at.desc())
            .limit(20)
        )
        intents = recent.scalars().all()

    items = []
    for p in intents:
        items.append(
            {
                "id": str(p.id),
                "tenant_id": str(p.tenant_id),
                "order_code": int(p.order_code),
                "target_plan": p.target_plan,
                "amount_vnd": p.amount_vnd,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "completed_at": p.completed_at.isoformat() if p.completed_at else None,
            }
        )

    return {
        "revenue_vnd_total": int(rev or 0),
        "payments_pending": int(pending or 0),
        "payments_completed": int(completed or 0),
        "recent": items,
    }


@router.get("/system/status")
async def platform_system_status():
    """Trạng thái PostgreSQL, Redis, Qdrant, Celery."""
    data = await _collect_infra_status()
    return data
