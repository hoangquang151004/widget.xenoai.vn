"""Admin API — connector, đồng bộ sản phẩm, đơn hàng / lead (Plan V2)."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import String, func, select

from core.deps import require_tenant_account
from db.session import async_session
from models.sales import PlatformConnector, Product, SalesOrder
from models.tenant import Tenant
from models.widget_config import TenantWidgetConfig
from services.connectors.factory import CONNECTOR_MAP
from services.sales.product_sync import sync_connector_products

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sales", dependencies=[Depends(require_tenant_account)])


def _mask_creds(platform: str, creds: dict) -> dict:
    if platform == "woocommerce":
        site = creds.get("site_url") or ""
        return {
            "site_url": site,
            "consumer_key": "***" if creds.get("consumer_key") else "",
            "consumer_secret": "***" if creds.get("consumer_secret") else "",
        }
    if platform == "shopify":
        return {
            "shop_domain": creds.get("shop_domain", ""),
            "access_token": "***" if creds.get("access_token") else "",
        }
    return {k: ("***" if v else "") for k, v in creds.items()}


class ConnectorUpsertBody(BaseModel):
    platform: str = Field(..., description="woocommerce | shopify | generic")
    credentials: dict[str, Any]
    config: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class ConnectorTestBody(BaseModel):
    platform: str
    credentials: dict[str, Any]
    config: dict[str, Any] = Field(default_factory=dict)


class OrderStatusPatch(BaseModel):
    status: str


class WidgetConfigBody(BaseModel):
    bot_name: Optional[str] = None
    primary_color: Optional[str] = None
    font_family: Optional[str] = None
    product_layout: Optional[str] = None
    show_stock: Optional[bool] = None
    show_rating: Optional[bool] = None
    form_fields: Optional[list[dict[str, Any]]] = None
    payment_methods: Optional[dict[str, Any]] = None
    bank_info: Optional[dict[str, Any]] = None
    action_mode: Optional[str] = None


class OnboardingCompleteBody(BaseModel):
    enable_sales: bool = True
    action_mode: Optional[str] = "lead"
    bot_name: Optional[str] = None
    primary_color: Optional[str] = None


def _allowed_transitions(source_mode: str) -> dict[str, set[str]]:
    mode = (source_mode or "").strip().lower()
    if mode == "lead":
        return {
            "pending": {"contacted", "converted", "lost"},
            "contacted": {"converted", "lost"},
            "converted": set(),
            "lost": set(),
        }
    if mode == "link":
        return {
            "pending": {"checkout_opened", "paid", "abandoned"},
            "checkout_opened": {"paid", "abandoned"},
            "paid": set(),
            "abandoned": set(),
        }
    if mode == "direct":
        return {
            "pending": {"confirmed", "cancelled"},
            "confirmed": {"processing", "cancelled"},
            "processing": {"shipped", "cancelled"},
            "shipped": {"delivered", "cancelled"},
            "delivered": set(),
            "cancelled": set(),
        }
    return {}


def _can_transition(source_mode: str, current: str, target: str) -> bool:
    cur = (current or "").strip().lower()
    nxt = (target or "").strip().lower()
    if cur == nxt:
        return True
    allowed = _allowed_transitions(source_mode)
    if not allowed or cur not in allowed:
        return False
    return nxt in allowed[cur]


@router.get("/widget-config")
async def get_widget_config(request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        cfg = await session.get(TenantWidgetConfig, tid)
        if not cfg:
            raise HTTPException(status_code=404, detail="Widget config chưa tồn tại")
        return {
            "bot_name": cfg.bot_name,
            "primary_color": cfg.primary_color,
            "font_family": cfg.font_family,
            "product_layout": cfg.product_layout,
            "show_stock": cfg.show_stock,
            "show_rating": cfg.show_rating,
            "form_fields": cfg.form_fields or [],
            "payment_methods": cfg.payment_methods or {},
            "bank_info": cfg.bank_info,
            "action_mode": cfg.action_mode,
        }


@router.put("/widget-config")
async def upsert_widget_config(body: WidgetConfigBody, request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        cfg = await session.get(TenantWidgetConfig, tid)
        if not cfg:
            cfg = TenantWidgetConfig(tenant_id=tid)
            session.add(cfg)
        payload = body.model_dump(exclude_unset=True)
        for key, value in payload.items():
            setattr(cfg, key, value)
        cfg.updated_at = datetime.utcnow()
        await session.commit()
        return {"ok": True, "message": "Đã cập nhật widget-config"}


@router.get("/connector")
async def get_connectors(request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        r = await session.execute(
            select(PlatformConnector).filter(PlatformConnector.tenant_id == tid)
        )
        rows = r.scalars().all()
        return [
            {
                "id": str(c.id),
                "platform": c.platform,
                "is_active": c.is_active,
                "config": c.config or {},
                "credentials_preview": _mask_creds(c.platform, c.credentials),
                "sync_status": c.sync_status,
                "sync_error": c.sync_error,
                "last_synced_at": c.last_synced_at.isoformat() if c.last_synced_at else None,
            }
            for c in rows
        ]


@router.post("/connector")
async def upsert_connector(body: ConnectorUpsertBody, request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    if body.platform not in CONNECTOR_MAP:
        raise HTTPException(status_code=400, detail="platform không hợp lệ")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        r = await session.execute(
            select(PlatformConnector).filter(
                PlatformConnector.tenant_id == tid,
                PlatformConnector.platform == body.platform,
            )
        )
        row = r.scalars().first()
        if not row:
            row = PlatformConnector(
                tenant_id=tid,
                platform=body.platform,
                is_active=body.is_active,
                config=body.config or {},
            )
            row.credentials = body.credentials
            session.add(row)
        else:
            row.credentials = body.credentials
            row.config = body.config or {}
            row.is_active = body.is_active
            row.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(row)
        return {
            "id": str(row.id),
            "platform": row.platform,
            "message": "Đã lưu connector.",
            "credentials_preview": _mask_creds(row.platform, row.credentials),
        }


@router.delete("/connector")
async def delete_connector(request: Request, platform: str = Query(...)):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        r = await session.execute(
            select(PlatformConnector).filter(
                PlatformConnector.tenant_id == tid,
                PlatformConnector.platform == platform,
            )
        )
        row = r.scalars().first()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy connector")
        await session.delete(row)
        await session.commit()
        return {"ok": True, "message": "Đã xóa connector"}


@router.post("/connector/test")
async def test_connector(body: ConnectorTestBody, request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    if body.platform not in CONNECTOR_MAP:
        raise HTTPException(status_code=400, detail="platform không hợp lệ")
    cls = CONNECTOR_MAP[body.platform]
    impl = cls(credentials=body.credentials, config=body.config or {})
    ok, err = await impl.test_connection()
    if not ok:
        raise HTTPException(status_code=400, detail=err or "Kết nối thất bại")
    return {"ok": True, "message": "Kết nối thành công."}


@router.post("/connector/sync")
async def sync_connector(request: Request, platform: str = Query("woocommerce")):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        r = await session.execute(
            select(PlatformConnector).filter(
                PlatformConnector.tenant_id == tid,
                PlatformConnector.platform == platform,
                PlatformConnector.is_active == True,
            )
        )
        row = r.scalars().first()
        if not row:
            raise HTTPException(status_code=404, detail="Không có connector active")
        try:
            n = await sync_connector_products(session, tid, row, index_qdrant=False)
        except Exception as e:
            logger.exception("sync_connector")
            raise HTTPException(status_code=500, detail=str(e))
        return {"synced": n, "sync_status": row.sync_status}


@router.get("/connector/sync-status")
async def get_connector_sync_status(request: Request, platform: str = Query("woocommerce")):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        r = await session.execute(
            select(PlatformConnector).filter(
                PlatformConnector.tenant_id == tid,
                PlatformConnector.platform == platform,
            )
        )
        row = r.scalars().first()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy connector")
        return {
            "platform": row.platform,
            "sync_status": row.sync_status,
            "sync_error": row.sync_error,
            "last_synced_at": row.last_synced_at.isoformat() if row.last_synced_at else None,
        }


@router.post("/connector/sync-index")
async def sync_connector_with_index(request: Request, platform: str = Query("woocommerce")):
    """Đồng bộ + đẩy vector Qdrant (nặng hơn)."""
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        r = await session.execute(
            select(PlatformConnector).filter(
                PlatformConnector.tenant_id == tid,
                PlatformConnector.platform == platform,
                PlatformConnector.is_active == True,
            )
        )
        row = r.scalars().first()
        if not row:
            raise HTTPException(status_code=404, detail="Không có connector active")
        try:
            n = await sync_connector_products(session, tid, row, index_qdrant=True)
        except Exception as e:
            logger.exception("sync_index")
            raise HTTPException(status_code=500, detail=str(e))
        return {"synced": n, "sync_status": row.sync_status}


@router.get("/products")
async def list_products(
    request: Request,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        stmt = select(Product).filter(Product.tenant_id == tid)
        if q and q.strip():
            from sqlalchemy import or_

            pat = f"%{q.strip()}%"
            stmt = stmt.filter(or_(Product.name.ilike(pat), Product.sku.ilike(pat)))
        stmt = stmt.order_by(Product.updated_at.desc()).offset((page - 1) * per_page).limit(per_page)
        r = await session.execute(stmt)
        rows = r.scalars().all()
        return {
            "items": [
                {
                    "id": str(p.id),
                    "external_id": p.external_id,
                    "platform": p.platform,
                    "name": p.name,
                    "price": int(p.price) if p.price is not None else None,
                    "in_stock": p.in_stock,
                    "sku": p.sku,
                    "vector_synced": p.vector_synced,
                    "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                }
                for p in rows
            ],
            "page": page,
            "per_page": per_page,
        }


@router.get("/orders")
async def list_orders(
    request: Request,
    status: Optional[str] = None,
    source_mode: Optional[str] = None,
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        stmt = select(SalesOrder).filter(SalesOrder.tenant_id == tid)
        if status:
            stmt = stmt.filter(SalesOrder.status == status)
        if source_mode:
            stmt = stmt.filter(SalesOrder.source_mode == source_mode)
        if q and q.strip():
            from sqlalchemy import or_

            pat = f"%{q.strip()}%"
            stmt = stmt.filter(
                or_(
                    SalesOrder.customer_name.ilike(pat),
                    SalesOrder.customer_phone.ilike(pat),
                    func.cast(SalesOrder.id, String).ilike(pat),
                )
            )
        if date_from:
            try:
                dt_from = datetime.fromisoformat(date_from)
                stmt = stmt.filter(SalesOrder.created_at >= dt_from)
            except ValueError:
                raise HTTPException(status_code=400, detail="date_from không hợp lệ (ISO format)")
        if date_to:
            try:
                dt_to = datetime.fromisoformat(date_to)
                stmt = stmt.filter(SalesOrder.created_at <= dt_to)
            except ValueError:
                raise HTTPException(status_code=400, detail="date_to không hợp lệ (ISO format)")
        stmt = stmt.order_by(SalesOrder.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
        r = await session.execute(stmt)
        rows = r.scalars().all()
        return {
            "items": [
                {
                    "id": str(o.id),
                    "source_mode": o.source_mode,
                    "status": o.status,
                    "customer_name": o.customer_name,
                    "customer_phone": o.customer_phone,
                    "subtotal": int(o.subtotal) if o.subtotal is not None else None,
                    "payment_status": o.payment_status,
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                }
                for o in rows
            ],
            "page": page,
            "per_page": per_page,
        }


@router.get("/orders/{order_id}")
async def get_order(order_id: UUID, request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        o = await session.get(SalesOrder, order_id)
        if not o or o.tenant_id != tid:
            raise HTTPException(status_code=404, detail="Không tìm thấy")
        return {
            "id": str(o.id),
            "chat_session_id": str(o.chat_session_id) if o.chat_session_id else None,
            "source_mode": o.source_mode,
            "status": o.status,
            "customer_name": o.customer_name,
            "customer_phone": o.customer_phone,
            "customer_email": o.customer_email,
            "customer_address": o.customer_address,
            "items": o.items,
            "subtotal": int(o.subtotal) if o.subtotal is not None else None,
            "external_order_id": o.external_order_id,
            "external_order_url": o.external_order_url,
            "payment_method": o.payment_method,
            "payment_status": o.payment_status,
            "notes": o.notes,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }


@router.patch("/orders/{order_id}/status")
async def patch_order_status(order_id: UUID, body: OrderStatusPatch, request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        o = await session.get(SalesOrder, order_id)
        if not o or o.tenant_id != tid:
            raise HTTPException(status_code=404, detail="Không tìm thấy")
        target = (body.status or "").strip()
        if not target:
            raise HTTPException(status_code=400, detail="status không được để trống")
        if not _can_transition(o.source_mode, o.status, target):
            raise HTTPException(
                status_code=400,
                detail=f"Không cho phép chuyển trạng thái từ '{o.status}' sang '{target}' cho mode '{o.source_mode}'",
            )
        o.status = target
        o.updated_at = datetime.utcnow()
        await session.commit()
        return {"message": "Đã cập nhật", "status": o.status}


@router.get("/analytics")
async def sales_analytics(request: Request, days: int = Query(30, ge=1, le=365)):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        total = await session.scalar(
            select(func.count()).select_from(SalesOrder).filter(SalesOrder.tenant_id == tid)
        )
        by_status = await session.execute(
            select(SalesOrder.status, func.count())
            .filter(SalesOrder.tenant_id == tid)
            .group_by(SalesOrder.status)
        )
        return {
            "orders_total": int(total or 0),
            "by_status": {row[0]: row[1] for row in by_status.fetchall()},
            "products_count": await session.scalar(
                select(func.count()).select_from(Product).filter(Product.tenant_id == tid)
            ),
        }


@router.post("/onboarding/complete")
async def complete_onboarding(body: OnboardingCompleteBody, request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    tid = UUID(str(request.state.tenant_id))
    async with async_session() as session:
        tenant = await session.get(Tenant, tid)
        if not tenant:
            raise HTTPException(status_code=404, detail="Không tìm thấy tenant")
        tenant.sales_enabled = bool(body.enable_sales)

        cfg = await session.get(TenantWidgetConfig, tid)
        if not cfg:
            cfg = TenantWidgetConfig(tenant_id=tid)
            session.add(cfg)
        if body.action_mode:
            cfg.action_mode = body.action_mode
        if body.bot_name:
            cfg.bot_name = body.bot_name
        if body.primary_color:
            cfg.primary_color = body.primary_color
        cfg.updated_at = datetime.utcnow()

        await session.commit()
        return {
            "ok": True,
            "sales_enabled": tenant.sales_enabled,
            "action_mode": cfg.action_mode,
            "message": "Onboarding sales đã hoàn tất.",
        }
