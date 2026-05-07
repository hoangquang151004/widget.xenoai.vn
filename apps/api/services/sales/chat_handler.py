"""Luồng chat bán hàng (Mode C lead) — rule-based MVP + action từ widget."""

from __future__ import annotations

import json
import logging
import re
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import async_session
from models.chat import ChatMessage, ChatSession
from models.sales import PlatformConnector, Product, SalesOrder
from models.tenant import Tenant
from models.widget_config import TenantWidgetConfig
from services.connectors.factory import get_connector
from services.notify import notify_new_lead
from services.sales.session_utils import get_or_create_chat_session
from services.sales.slots import SalesSlotState, get_slot, save_slot

logger = logging.getLogger(__name__)

ORDER_TRIGGERS = (
    "đặt hàng",
    "dat hang",
    "mua hàng",
    "mua hang",
    "đặt mua",
    "order",
    "checkout",
    "thanh toán",
    "thanh toan",
    "form đặt",
)
BROWSE_TRIGGERS = (
    "sản phẩm",
    "san pham",
    "catalog",
    "xem hàng",
    "giá",
    "gia",
    "mua",
    "shop",
)


def _lower(s: str) -> str:
    return (s or "").strip().lower()


async def _load_sales_context(
    db: AsyncSession, tenant_uuid: UUID
) -> tuple[Optional[Tenant], Optional[TenantWidgetConfig], Optional[PlatformConnector]]:
    t = await db.get(Tenant, tenant_uuid)
    if not t or not t.sales_enabled:
        return None, None, None
    wr = await db.execute(select(TenantWidgetConfig).filter(TenantWidgetConfig.tenant_id == tenant_uuid))
    widget = wr.scalars().first()
    cr = await db.execute(
        select(PlatformConnector).filter(
            PlatformConnector.tenant_id == tenant_uuid,
            PlatformConnector.is_active == True,
        )
    )
    conn = cr.scalars().first()
    if not conn:
        return t, widget, None
    return t, widget, conn


async def _search_products_db(
    db: AsyncSession, tenant_id: UUID, q: str, limit: int = 5
) -> list[Product]:
    stmt = select(Product).filter(Product.tenant_id == tenant_id, Product.in_stock == True)
    if q.strip():
        pat = f"%{q.strip()}%"
        stmt = stmt.filter(or_(Product.name.ilike(pat), Product.description.ilike(pat)))
    stmt = stmt.order_by(Product.updated_at.desc()).limit(limit)
    r = await db.execute(stmt)
    return list(r.scalars().all())


def _products_to_cards(products: list[Product], widget: TenantWidgetConfig) -> dict:
    layout = widget.product_layout if widget else "card"
    primary = widget.primary_color if widget else "#2563eb"
    items = []
    for p in products:
        items.append(
            {
                "id": str(p.id),
                "external_id": p.external_id,
                "name": p.name,
                "price": int(p.price) if p.price is not None else 0,
                "compare_price": int(p.compare_price) if p.compare_price is not None else None,
                "in_stock": p.in_stock,
                "stock_quantity": p.stock_quantity,
                "images": p.images or [],
                "variants": p.variants or [],
                "show_stock": widget.show_stock if widget else True,
                "show_rating": widget.show_rating if widget else False,
            }
        )
    return {
        "type": "product_cards",
        "data": {"layout": layout, "products": items, "primary_color": primary},
    }


def _order_form_ui(widget: TenantWidgetConfig, slot: SalesSlotState) -> dict:
    primary = widget.primary_color if widget else "#2563eb"
    fields_cfg = widget.form_fields or []
    if isinstance(fields_cfg, str):
        try:
            fields_cfg = json.loads(fields_cfg)
        except Exception:
            fields_cfg = []
    rows = []
    slot_map = {
        "name": slot.name or "",
        "phone": slot.phone or "",
        "address": slot.address or "",
        "email": slot.email or "",
        "note": slot.note or "",
    }
    for f in sorted(
        [x for x in fields_cfg if isinstance(x, dict) and x.get("enabled", True)],
        key=lambda x: int(x.get("order") or 0),
    ):
        key = f.get("key", "")
        rows.append(
            {
                "key": key,
                "label": f.get("label", key),
                "type": f.get("type", "text"),
                "required": bool(f.get("required")),
                "prefilled": slot_map.get(key, ""),
            }
        )
    return {"type": "order_form", "data": {"fields": rows, "primary_color": primary}}


def _confirmation_ui(order: SalesOrder, widget: TenantWidgetConfig) -> dict:
    primary = widget.primary_color if widget else "#2563eb"
    items = order.items or []
    line_items = []
    for it in items:
        if not isinstance(it, dict):
            continue
        try:
            price = int(it.get("price") or 0)
            qty = int(it.get("quantity") or 1)
        except (TypeError, ValueError):
            price, qty = 0, 1
        line_items.append(
            {
                "product_id": str(it.get("product_id", "")),
                "name": str(it.get("name", "")),
                "price": price,
                "quantity": qty,
                "variant_key": it.get("variant_key"),
                "variant_value": it.get("variant_value"),
                "line_total": price * qty,
            }
        )
    sub = int(order.subtotal) if order.subtotal is not None else sum(x["line_total"] for x in line_items)
    return {
        "type": "order_confirmation",
        "data": {
            "order_id": str(order.id),
            "external_order_id": order.external_order_id,
            "items": line_items,
            "subtotal": sub,
            "payment_method": order.payment_method or "lead",
            "estimated_delivery": None,
            "primary_color": primary,
        },
    }


def _cart_ui(slot: SalesSlotState, widget: TenantWidgetConfig) -> dict:
    primary = widget.primary_color if widget else "#2563eb"
    lines = []
    sub = 0
    for it in slot.cart_items:
        try:
            price = int(it.get("price") or 0)
            qty = int(it.get("quantity") or 1)
        except (TypeError, ValueError):
            price, qty = 0, 1
        lt = price * qty
        sub += lt
        lines.append(
            {
                "product_id": str(it.get("product_id", "")),
                "name": str(it.get("name", "")),
                "price": price,
                "quantity": qty,
                "variant_key": it.get("variant_key"),
                "variant_value": it.get("variant_value"),
                "line_total": lt,
            }
        )
    return {"type": "cart", "data": {"items": lines, "subtotal": sub, "primary_color": primary}}


def _checkout_link_ui(url: str, subtotal: int, widget: TenantWidgetConfig) -> dict:
    return {
        "type": "checkout_link",
        "data": {
            "url": url,
            "expires_minutes": 30,
            "subtotal": subtotal,
            "primary_color": widget.primary_color if widget else "#2563eb",
        },
    }


async def _persist_sales_messages(
    db: AsyncSession,
    tenant_id: UUID,
    visitor_id: str,
    user_text: str,
    assistant_text: str,
    intent: Optional[str] = None,
):
    cs = await get_or_create_chat_session(db, tenant_id, visitor_id)
    um = ChatMessage(
        session_id=cs.id,
        tenant_id=tenant_id,
        role="user",
        content=user_text,
        intent=intent,
    )
    am = ChatMessage(
        session_id=cs.id,
        tenant_id=tenant_id,
        role="assistant",
        content=assistant_text,
        intent=intent,
    )
    db.add(um)
    db.add(am)
    cs.message_count = (cs.message_count or 0) + 2
    cs.last_active_at = cs.last_active_at
    await db.commit()
    return cs


async def handle_sales_chat(
    tenant_id: str,
    session_id: str,
    query: str,
    action: Optional[dict],
    *,
    persist_messages: bool = True,
) -> dict[str, Any]:
    """Trả về dict giống chat JSON: content, metadata, citations, component, ui_components, slots."""
    tenant_uuid = UUID(str(tenant_id))
    ui_components: list[dict] = []
    slots_out: dict = {}
    content = ""
    intent: Optional[str] = None

    async with async_session() as db:
        tenant, widget, connector = await _load_sales_context(db, tenant_uuid)
        if not tenant or not connector or not widget:
            raise RuntimeError("sales_not_ready")

        slot = await get_slot(tenant_id, session_id)

        # ── Actions từ widget ─────────────────────────────
        if action and isinstance(action, dict):
            at = action.get("type") or action.get("action")
            data = action.get("data") if isinstance(action.get("data"), dict) else {}

            if at == "add_to_cart":
                pid = data.get("product_id")
                if pid:
                    pr = await db.get(Product, UUID(str(pid)))
                    if pr and pr.tenant_id == tenant_uuid:
                        slot.cart_items.append(
                            {
                                "product_id": str(pr.id),
                                "external_id": pr.external_id,
                                "name": pr.name,
                                "price": int(pr.price) if pr.price is not None else 0,
                                "quantity": int(data.get("quantity") or 1),
                            }
                        )
                await save_slot(tenant_id, session_id, slot)
                ui_components.append(_cart_ui(slot, widget))
                content = "Đã cập nhật giỏ hàng."
                intent = "add_to_cart"

            elif at == "submit_form":
                for key in ("name", "phone", "address", "email", "note"):
                    if data.get(key):
                        setattr(slot, key, str(data.get(key)))
                slot.step = "form"
                await save_slot(tenant_id, session_id, slot)

                cs_row = await get_or_create_chat_session(db, tenant_uuid, session_id)
                items_json = list(slot.cart_items) if slot.cart_items else []
                subtotal = sum(
                    int(i.get("price") or 0) * int(i.get("quantity") or 1) for i in items_json
                )
                mode = widget.action_mode or "lead"
                order = SalesOrder(
                    tenant_id=tenant_uuid,
                    chat_session_id=cs_row.id,
                    source_mode=mode if mode in ("lead", "link", "direct") else "lead",
                    customer_name=slot.name,
                    customer_phone=slot.phone,
                    customer_email=slot.email,
                    customer_address=slot.address,
                    items=items_json,
                    subtotal=Decimal(subtotal) if subtotal else None,
                    status="pending",
                    payment_method=str(data.get("payment_method") or "cod"),
                    payment_status="unpaid",
                    notes=slot.note,
                )
                db.add(order)
                await db.flush()

                if mode == "direct" and connector.platform == "woocommerce":
                    from services.connectors.base import OrderPayload

                    impl = get_connector(connector)
                    payload = OrderPayload(
                        customer_name=slot.name or "",
                        customer_phone=slot.phone or "",
                        customer_address=slot.address or "",
                        customer_email=slot.email,
                        items=[
                            {"external_id": x.get("external_id"), "quantity": x.get("quantity", 1)}
                            for x in items_json
                        ],
                        note=slot.note,
                        payment_method=str(data.get("payment_method") or "cod"),
                    )
                    res = await impl.create_order(payload)
                    if res.success:
                        order.external_order_id = res.external_order_id
                        order.external_order_url = res.external_order_url
                        order.status = "confirmed"
                    else:
                        order.notes = (order.notes or "") + f" | WC error: {res.error}"

                if mode == "link" and items_json:
                    try:
                        impl = get_connector(connector)
                        link_res = await impl.generate_cart_link(items_json)
                        order.external_order_url = link_res.url
                    except Exception as e:
                        logger.exception("generate_cart_link")
                        order.notes = (order.notes or "") + f" | link_error: {e}"

                await db.commit()
                await db.refresh(order)
                await notify_new_lead(order, tenant)

                slot.step = "done"
                slot.cart_items = []
                await save_slot(tenant_id, session_id, slot)

                if mode == "link" and order.external_order_url:
                    sub_i = int(order.subtotal) if order.subtotal is not None else 0
                    ui_components.append(
                        _checkout_link_ui(order.external_order_url, sub_i, widget)
                    )
                    content = "Đây là liên kết thanh toán trên website shop."
                else:
                    ui_components.append(_confirmation_ui(order, widget))
                    content = "Cảm ơn bạn! Chúng tôi đã ghi nhận đơn hàng."
                intent = "submit_form"

            elif at == "confirm_order":
                # Giống submit_form nếu client gửi riêng
                content = "Vui lòng điền form và gửi lại."
                intent = "confirm_order"

        # ── Free text ─────────────────────────────────────
        if not content:
            q = _lower(query)
            if any(t in q for t in ORDER_TRIGGERS):
                ui_components.append(_order_form_ui(widget, slot))
                content = "Vui lòng điền thông tin giao hàng bên dưới."
                intent = "order_form"
            elif any(t in q for t in BROWSE_TRIGGERS):
                m = re.search(r"^\s*search:\s*(.+)$", query, re.I)
                search_q = m.group(1).strip() if m else ""
                products = await _search_products_db(db, tenant_uuid, search_q, limit=5)
                if products:
                    ui_components.append(_products_to_cards(products, widget))
                    content = "Một số sản phẩm gợi ý:"
                else:
                    content = "Hiện chưa có sản phẩm trong kho. Vui lòng liên hệ shop hoặc thử lại sau."
                intent = "product_search"
            elif q.startswith("/shop") or q.startswith("shop:"):
                sq = q.replace("/shop", "", 1).replace("shop:", "", 1).strip()
                products = await _search_products_db(db, tenant_uuid, sq, limit=5)
                if products:
                    ui_components.append(_products_to_cards(products, widget))
                    content = "Kết quả tìm kiếm:"
                else:
                    content = "Không tìm thấy sản phẩm phù hợp."
                intent = "product_search"
            else:
                content = (
                    "Bạn có thể gõ **sản phẩm** để xem catalog, **đặt hàng** để mở form, "
                    "hoặc **/shop từ khóa** để tìm."
                )
                intent = "general"

        slots_out = slot.to_dict()

        if persist_messages:
            try:
                u_display = query if not action else json.dumps(action, ensure_ascii=False)
                await _persist_sales_messages(db, tenant_uuid, session_id, u_display, content, intent)
            except Exception:
                logger.exception("persist sales messages")

    return {
        "content": content,
        "metadata": {"intent": intent, "sales": True},
        "citations": [],
        "component": None,
        "ui_components": ui_components,
        "slots": slots_out,
        "intent": intent,
    }


async def is_sales_chat_active(tenant_id: str) -> bool:
    tenant_uuid = UUID(str(tenant_id))
    async with async_session() as db:
        tenant, _, conn = await _load_sales_context(db, tenant_uuid)
        return bool(tenant and conn)


async def should_use_sales_chat_path(
    tenant_id: str, query: str, action: Optional[dict]
) -> bool:
    """Chỉ chiếm chat khi có action hoặc từ khóa sales — còn lại dùng orchestrator."""
    if action:
        return await is_sales_chat_active(tenant_id)
    if not await is_sales_chat_active(tenant_id):
        return False
    q = _lower(query)
    if any(t in q for t in ORDER_TRIGGERS) or any(t in q for t in BROWSE_TRIGGERS):
        return True
    if q.startswith("/shop") or q.startswith("shop:"):
        return True
    return False
