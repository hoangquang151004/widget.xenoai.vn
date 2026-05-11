"""Admin API — connector, đồng bộ sản phẩm, đơn hàng / lead (Plan V2)."""

from __future__ import annotations

import logging
import time
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


ALLOWED_GENERIC_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
REQUIRED_GENERIC_ENDPOINTS = ("products", "create_order", "order_history")
LEGACY_ENDPOINT_FIELD_MAP = {
    "products": "products_endpoint",
    "create_order": "order_endpoint",
    "order_history": "order_history_endpoint",
}
DEFAULT_GENERIC_ENDPOINTS = {
    "products": {
        "label": "Products API",
        "method": "GET",
        "path": "/products",
        "path_template": "/products",
        "query_template": {"page": "{page}", "limit": "{limit}", "q": "{q}"},
        "body_template": None,
    },
    "create_order": {
        "label": "Create Order API",
        "method": "POST",
        "path": "/orders",
        "path_template": "/orders",
        "query_template": {},
        "body_template": {
            "payload": {
                "customer_name": "{customer_name}",
                "customer_phone": "{customer_phone}",
                "customer_address": "{customer_address}",
                "customer_email": "{customer_email}",
                "items": "{items}",
                "note": "{note}",
                "payment_method": "{payment_method}",
            }
        },
    },
    "order_history": {
        "label": "Order History API",
        "method": "GET",
        "path": "/orders",
        "path_template": "/orders",
        "query_template": {"phone": "{customer_phone}", "order_id": "{external_order_id}"},
        "body_template": None,
    },
}


def _normalize_generic_endpoint_item(item: dict[str, Any]) -> dict[str, Any]:
    code = str(item.get("code", "")).strip().lower()
    label = str(item.get("label", "")).strip()
    method = str(item.get("method", "GET")).strip().upper()
    path = str(item.get("path", "")).strip()
    path_template = str(item.get("path_template", "")).strip()
    query_template = item.get("query_template")
    body_template = item.get("body_template")
    enabled = bool(item.get("enabled", True))
    return {
        "code": code,
        "label": label or code,
        "method": method or "GET",
        "path": path,
        "path_template": path_template or path,
        "query_template": query_template if isinstance(query_template, dict) else {},
        "body_template": body_template if isinstance(body_template, dict) else None,
        "enabled": enabled,
    }


def _normalize_generic_config(config: dict[str, Any]) -> dict[str, Any]:
    out = dict(config or {})
    existing = out.get("endpoints")
    endpoints: list[dict[str, Any]] = []
    if isinstance(existing, list):
        for raw in existing:
            if isinstance(raw, dict):
                endpoints.append(_normalize_generic_endpoint_item(raw))
    by_code = {ep["code"]: ep for ep in endpoints if ep.get("code")}

    for code, field in LEGACY_ENDPOINT_FIELD_MAP.items():
        if code in by_code:
            continue
        legacy_path = str(out.get(field, "")).strip()
        if legacy_path:
            default = DEFAULT_GENERIC_ENDPOINTS[code]
            by_code[code] = {
                "code": code,
                "label": default["label"],
                "method": default["method"],
                "path": legacy_path,
                "path_template": legacy_path,
                "query_template": default["query_template"],
                "body_template": default["body_template"],
                "enabled": True,
            }

    for code in REQUIRED_GENERIC_ENDPOINTS:
        if code in by_code:
            continue
        default = DEFAULT_GENERIC_ENDPOINTS[code]
        by_code[code] = {
            "code": code,
            "label": default["label"],
            "method": default["method"],
            "path": default["path"],
            "path_template": default["path_template"],
            "query_template": default["query_template"],
            "body_template": default["body_template"],
            "enabled": True,
        }

    ordered_codes = list(dict.fromkeys([ep["code"] for ep in endpoints if ep.get("code")]))
    for code in REQUIRED_GENERIC_ENDPOINTS:
        if code not in ordered_codes:
            ordered_codes.append(code)
    normalized = [by_code[c] for c in ordered_codes if c in by_code]
    for ep in normalized:
        code = str(ep.get("code", "")).strip().lower()
        default = DEFAULT_GENERIC_ENDPOINTS.get(code)
        if not default:
            if not ep.get("path_template"):
                ep["path_template"] = ep.get("path", "")
            if "query_template" not in ep or not isinstance(ep.get("query_template"), dict):
                ep["query_template"] = {}
            if "body_template" not in ep:
                ep["body_template"] = None
            continue
        if not ep.get("path_template"):
            ep["path_template"] = ep.get("path", "") or default["path_template"]
        if "query_template" not in ep or not isinstance(ep.get("query_template"), dict):
            ep["query_template"] = default["query_template"]
        if "body_template" not in ep or (
            ep.get("body_template") is None and default["body_template"] is not None
        ):
            ep["body_template"] = default["body_template"]
    out["endpoints"] = normalized

    for code, field in LEGACY_ENDPOINT_FIELD_MAP.items():
        matched = next((ep for ep in normalized if ep.get("code") == code), None)
        out[field] = str(matched.get("path", "")).strip() if matched else ""
    return out


def _validate_generic_config_or_raise(config: dict[str, Any]) -> dict[str, Any]:
    normalized = _normalize_generic_config(config)
    endpoints = normalized.get("endpoints")
    if not isinstance(endpoints, list):
        raise HTTPException(status_code=400, detail="config.endpoints phải là danh sách.")

    seen_codes: set[str] = set()
    enabled_required: set[str] = set()
    for ep in endpoints:
        code = str(ep.get("code", "")).strip().lower()
        method = str(ep.get("method", "")).strip().upper()
        path = str(ep.get("path", "")).strip()
        enabled = bool(ep.get("enabled", True))
        if not code:
            raise HTTPException(status_code=400, detail="Mỗi endpoint cần có code.")
        if code in seen_codes:
            raise HTTPException(status_code=400, detail=f"code endpoint bị trùng: {code}")
        seen_codes.add(code)
        if method not in ALLOWED_GENERIC_METHODS:
            raise HTTPException(
                status_code=400,
                detail=f"method không hợp lệ cho endpoint '{code}': {method}",
            )
        if not path.startswith("/"):
            raise HTTPException(
                status_code=400,
                detail=f"path endpoint '{code}' phải bắt đầu bằng '/'.",
            )
        path_template = str(ep.get("path_template", "")).strip() or path
        if not path_template.startswith("/"):
            raise HTTPException(
                status_code=400,
                detail=f"path_template endpoint '{code}' phải bắt đầu bằng '/'.",
            )
        query_template = ep.get("query_template")
        if query_template is not None and not isinstance(query_template, dict):
            raise HTTPException(
                status_code=400,
                detail=f"query_template endpoint '{code}' phải là object.",
            )
        if isinstance(query_template, dict):
            for qk, qv in query_template.items():
                if not str(qk).strip():
                    raise HTTPException(
                        status_code=400,
                        detail=f"query_template endpoint '{code}' có key rỗng.",
                    )
                if not isinstance(qv, (str, int, float, bool)):
                    raise HTTPException(
                        status_code=400,
                        detail=f"query_template endpoint '{code}' có value không hợp lệ.",
                    )
        body_template = ep.get("body_template")
        if body_template is not None and not isinstance(body_template, dict):
            raise HTTPException(
                status_code=400,
                detail=f"body_template endpoint '{code}' phải là object hoặc null.",
            )
        if method in ("POST", "PUT", "PATCH") and code == "create_order" and not body_template:
            raise HTTPException(
                status_code=400,
                detail="endpoint 'create_order' cần body_template.",
            )
        if code in REQUIRED_GENERIC_ENDPOINTS and enabled:
            enabled_required.add(code)

    missing = [code for code in REQUIRED_GENERIC_ENDPOINTS if code not in enabled_required]
    if missing:
        missing_text = ", ".join(missing)
        raise HTTPException(
            status_code=400,
            detail=f"Thiếu endpoint bắt buộc hoặc đang tắt: {missing_text}",
        )
    return normalized


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
    if platform == "generic":
        return {
            "base_url": creds.get("base_url", ""),
            "auth_type": creds.get("auth_type", "bearer"),
            "auth_value": "***" if creds.get("auth_value") or creds.get("token") else "",
        }
    return {k: ("***" if v else "") for k, v in creds.items()}


def _looks_masked_or_empty(value: Any) -> bool:
    text = str(value or "").strip()
    return text in {"", "***", "********"}


def _merge_credentials_with_existing(
    platform: str, existing: dict[str, Any], incoming: dict[str, Any]
) -> dict[str, Any]:
    """Giữ lại secret hiện có nếu payload mới gửi lên đang rỗng/masked."""
    out = dict(incoming or {})
    old = dict(existing or {})
    if platform == "woocommerce":
        for key in ("consumer_key", "consumer_secret"):
            if _looks_masked_or_empty(out.get(key)) and str(old.get(key) or "").strip():
                out[key] = old.get(key)
        return out
    if platform == "shopify":
        key = "access_token"
        if _looks_masked_or_empty(out.get(key)) and str(old.get(key) or "").strip():
            out[key] = old.get(key)
        return out
    if platform == "generic":
        # Hỗ trợ cả key cũ "token" lẫn key mới "auth_value".
        if _looks_masked_or_empty(out.get("auth_value")) and str(old.get("auth_value") or "").strip():
            out["auth_value"] = old.get("auth_value")
        if _looks_masked_or_empty(out.get("token")) and str(old.get("token") or "").strip():
            out["token"] = old.get("token")
        return out
    return out


class ConnectorUpsertBody(BaseModel):
    platform: str = Field(..., description="woocommerce | shopify | generic")
    credentials: dict[str, Any]
    config: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class ConnectorTestBody(BaseModel):
    platform: str
    credentials: dict[str, Any]
    config: dict[str, Any] = Field(default_factory=dict)


class ConnectorTestEndpointBody(BaseModel):
    platform: str
    credentials: dict[str, Any]
    config: dict[str, Any] = Field(default_factory=dict)
    code: str = Field(..., min_length=1)


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
        output = []
        for c in rows:
            cfg = c.config or {}
            if c.platform == "generic":
                cfg = _normalize_generic_config(cfg)
            output.append(
                {
                    "id": str(c.id),
                    "platform": c.platform,
                    "is_active": c.is_active,
                    "config": cfg,
                    "credentials_preview": _mask_creds(c.platform, c.credentials),
                    "sync_status": c.sync_status,
                    "sync_error": c.sync_error,
                    "last_synced_at": c.last_synced_at.isoformat() if c.last_synced_at else None,
                }
            )
        return output


@router.post("/connector")
async def upsert_connector(body: ConnectorUpsertBody, request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    if body.platform not in CONNECTOR_MAP:
        raise HTTPException(status_code=400, detail="platform không hợp lệ")
    connector_config = body.config or {}
    if body.platform == "generic":
        connector_config = _validate_generic_config_or_raise(connector_config)

    incoming_credentials = dict(body.credentials or {})
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
                config=connector_config,
            )
            row.credentials = incoming_credentials
            session.add(row)
        else:
            row.credentials = _merge_credentials_with_existing(
                body.platform,
                row.credentials or {},
                incoming_credentials,
            )
            row.config = connector_config
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
    connector_config = body.config or {}
    if body.platform == "generic":
        connector_config = _validate_generic_config_or_raise(connector_config)

    cls = CONNECTOR_MAP[body.platform]
    impl = cls(credentials=body.credentials, config=connector_config)
    ok, err = await impl.test_connection()
    if not ok:
        raise HTTPException(status_code=400, detail=err or "Kết nối thất bại")
    return {"ok": True, "message": "Kết nối thành công."}


@router.post("/connector/test-endpoint")
async def test_connector_single_endpoint(
    body: ConnectorTestEndpointBody, request: Request
):
    """Test một endpoint cụ thể trong cấu hình connector.

    - `products`: gọi `fetch_products(page=1, per_page=1)`, đếm số row + lấy mẫu đầu.
    - `order_history`: gọi `get_order_status('__test__')`, pass khi không 5xx.
    - `create_order`: KHÔNG gọi POST thật; chỉ validate body_template + path.
    - Các code khác (chỉ với REST generic): smoke GET/method config với context rỗng,
      pass khi HTTP < 500.
    """
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    if body.platform not in CONNECTOR_MAP:
        raise HTTPException(status_code=400, detail="platform không hợp lệ")
    code = body.code.strip().lower()
    if not code:
        raise HTTPException(status_code=400, detail="code không được để trống")

    connector_config: dict[str, Any] = body.config or {}
    if body.platform == "generic":
        connector_config = _normalize_generic_config(connector_config)

    cls = CONNECTOR_MAP[body.platform]
    impl = cls(credentials=body.credentials, config=connector_config)
    started = time.perf_counter()

    def _latency_ms() -> int:
        return int((time.perf_counter() - started) * 1000)

    try:
        if code == "products":
            products = await impl.fetch_products(page=1, per_page=1)
            count = len(products)
            sample: Optional[dict[str, Any]] = None
            if count:
                p = products[0]
                sample = {
                    "external_id": p.external_id,
                    "name": p.name,
                    "price": p.price,
                    "stock_quantity": p.stock_quantity,
                }
            return {
                "ok": True,
                "code": code,
                "message": f"Lấy được {count} sản phẩm từ trang đầu.",
                "details": {"count": count, "sample": sample},
                "latency_ms": _latency_ms(),
            }

        if code == "order_history":
            try:
                data = await impl.get_order_status("__test__")
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"order_history lỗi khi gọi: {exc}",
                )
            return {
                "ok": True,
                "code": code,
                "message": "Endpoint order_history phản hồi không có lỗi 5xx.",
                "details": {"sample": data if isinstance(data, dict) else None},
                "latency_ms": _latency_ms(),
            }

        if code == "create_order":
            if body.platform == "generic":
                endpoints = (
                    connector_config.get("endpoints", [])
                    if isinstance(connector_config.get("endpoints"), list)
                    else []
                )
                ep = next(
                    (e for e in endpoints if str(e.get("code", "")).lower() == "create_order"),
                    None,
                )
                if not ep:
                    raise HTTPException(
                        status_code=400, detail="Chưa cấu hình endpoint create_order."
                    )
                if not ep.get("path"):
                    raise HTTPException(
                        status_code=400, detail="create_order thiếu path."
                    )
                if not ep.get("body_template"):
                    raise HTTPException(
                        status_code=400,
                        detail="create_order thiếu body_template (bắt buộc cho POST).",
                    )
            return {
                "ok": True,
                "code": code,
                "message": "Cấu hình hợp lệ — không gọi POST để tránh tạo đơn thật.",
                "details": {
                    "note": "Test thật sẽ chạy khi user đặt đơn qua chatbot."
                },
                "latency_ms": _latency_ms(),
            }

        # Custom code (chỉ áp dụng cho REST generic)
        if body.platform != "generic":
            raise HTTPException(
                status_code=400,
                detail=f"Code '{code}' chỉ được test trên REST generic.",
            )
        endpoints_list = (
            connector_config.get("endpoints", [])
            if isinstance(connector_config.get("endpoints"), list)
            else []
        )
        ep = next(
            (e for e in endpoints_list if str(e.get("code", "")).lower() == code),
            None,
        )
        if not ep:
            raise HTTPException(
                status_code=404, detail=f"Không tìm thấy endpoint code '{code}'."
            )
        method, path, query, _body_data = impl._build_request_from_template(
            ep, context={}
        )
        base = str(impl.credentials.get("base_url", "")).rstrip("/")
        if not base:
            raise HTTPException(status_code=400, detail="Thiếu base_url.")
        try:
            r = await impl._request(method, f"{base}{path}", params=query)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Smoke test lỗi: {exc}")
        if r.status_code >= 500:
            raise HTTPException(
                status_code=400,
                detail=f"Endpoint '{code}' trả HTTP {r.status_code}.",
            )
        return {
            "ok": True,
            "code": code,
            "message": f"Smoke test ok (HTTP {r.status_code}).",
            "details": {"http_status": r.status_code},
            "latency_ms": _latency_ms(),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("test_connector_single_endpoint")
        raise HTTPException(status_code=400, detail=f"Test '{code}' thất bại: {exc}")


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
