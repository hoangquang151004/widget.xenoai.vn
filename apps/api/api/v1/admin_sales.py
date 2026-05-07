"""Admin API — connector, đồng bộ sản phẩm, đơn hàng / lead (Plan V2)."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from core.deps import require_tenant_account
from db.session import async_session
from models.sales import PlatformConnector, Product, SalesOrder
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
        o.status = body.status
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
