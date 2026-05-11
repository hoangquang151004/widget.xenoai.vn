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
from services.connectors.base import ProductData, UnsupportedOperation
from services.connectors.factory import get_connector
from services.notify import notify_new_lead
from services.sales.agent import SalesAgent
from services.sales.intent import classify_intent
from services.sales.session_utils import get_or_create_chat_session
from services.sales.slots import SalesSlotState, get_slot, save_slot
from services.sales.slot_filler import OrderSlots, SlotFiller

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
CART_TRIGGERS = (
    "giỏ hàng",
    "gio hang",
    "xem giỏ",
    "xem gio",
    "xem cart",
    "cart",
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


def _product_data_to_cards(products: list[ProductData], widget: TenantWidgetConfig) -> dict:
    layout = widget.product_layout if widget else "card"
    primary = widget.primary_color if widget else "#2563eb"
    items = []
    for p in products:
        items.append(
            {
                "id": str(p.external_id),
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


def _payment_selection_ui(widget: TenantWidgetConfig) -> dict:
    primary = widget.primary_color if widget else "#2563eb"
    methods_cfg = widget.payment_methods or {}
    bank_info = widget.bank_info or {}
    options: list[dict[str, Any]] = []
    labels = {
        "cod": "Thanh toán khi nhận hàng",
        "bank_transfer": "Chuyển khoản ngân hàng",
        "momo": "Ví MoMo",
        "vnpay": "VNPay",
    }
    for key, enabled in methods_cfg.items():
        if not enabled:
            continue
        item: dict[str, Any] = {"key": str(key), "label": labels.get(str(key), str(key))}
        if key == "bank_transfer" and isinstance(bank_info, dict):
            item["bank_info"] = bank_info
        options.append(item)
    if not options:
        options = [{"key": "cod", "label": labels["cod"]}]
    return {"type": "payment_selection", "data": {"methods": options, "primary_color": primary}}


def _connector_supports_create_order(connector: Optional[PlatformConnector]) -> bool:
    """Connector đã đủ thông tin để gọi API tạo đơn trên web tenant chưa?

    - WooCommerce/Shopify: chỉ cần connector active + creds đầy đủ (luôn có create_order built-in).
    - REST Generic: phải có endpoint code='create_order' enabled, kèm path + body_template hợp lệ.
    """
    if not connector or not connector.is_active:
        return False
    creds = connector.credentials or {}
    cfg = connector.config or {}
    if connector.platform == "woocommerce":
        return all(str(creds.get(k) or "").strip() for k in ("site_url", "consumer_key", "consumer_secret"))
    if connector.platform == "shopify":
        return all(str(creds.get(k) or "").strip() for k in ("shop_domain", "access_token"))
    if connector.platform == "generic":
        endpoints = cfg.get("endpoints")
        if not isinstance(endpoints, list):
            return False
        for ep in endpoints:
            if not isinstance(ep, dict):
                continue
            if str(ep.get("code", "")).strip().lower() != "create_order":
                continue
            if not ep.get("enabled", True):
                return False
            path = str(ep.get("path") or ep.get("path_template") or "").strip()
            body = ep.get("body_template")
            return bool(path) and isinstance(body, dict) and len(body) > 0
        return False
    return False


def _resolve_effective_action_mode(
    widget: TenantWidgetConfig, connector: Optional[PlatformConnector]
) -> str:
    """Auto chọn mode: 'link' nếu user explicit chọn link; ngược lại direct nếu connector đủ; còn lại lead."""
    explicit = (getattr(widget, "action_mode", None) or "lead").strip().lower()
    if explicit == "link":
        return "link"
    if _connector_supports_create_order(connector):
        return "direct"
    return "lead"


async def _create_sales_order_from_slot(
    db: AsyncSession,
    *,
    tenant_uuid: UUID,
    session_id: str,
    slot: SalesSlotState,
    widget: TenantWidgetConfig,
    connector: PlatformConnector,
) -> tuple[SalesOrder, str]:
    cs_row = await get_or_create_chat_session(db, tenant_uuid, session_id)
    items_json = list(slot.cart_items) if slot.cart_items else []
    subtotal = sum(int(i.get("price") or 0) * int(i.get("quantity") or 1) for i in items_json)
    effective_mode = _resolve_effective_action_mode(widget, connector)

    order = SalesOrder(
        tenant_id=tenant_uuid,
        chat_session_id=cs_row.id,
        source_mode=effective_mode,
        customer_name=slot.name,
        customer_phone=slot.phone,
        customer_email=slot.email,
        customer_address=slot.address,
        items=items_json,
        subtotal=Decimal(subtotal) if subtotal else None,
        status="pending",
        payment_method=slot.payment_method or "cod",
        payment_status="unpaid",
        notes=slot.note,
    )

    if effective_mode == "direct":
        from services.connectors.base import OrderPayload, OrderResult

        # Enrich items dict bằng nhiều alias khoá để mỗi connector / API tenant
        # đều đọc được trường mong muốn (mock da_muoi cần product_id/qty/price;
        # WooCommerce/Shopify đọc external_id/quantity). Pydantic phía mock sẽ
        # tự bỏ qua extra fields nên không gây lỗi.
        normalized_items: list[dict[str, Any]] = []
        for x in items_json:
            ext = x.get("external_id") or x.get("product_id")
            qty = int(x.get("quantity") or x.get("qty") or 1)
            price_raw = x.get("price")
            try:
                price_int: Optional[int] = int(price_raw) if price_raw is not None else None
            except (TypeError, ValueError):
                price_int = None
            normalized_items.append(
                {
                    "external_id": ext,
                    "product_id": ext,
                    "name": x.get("name"),
                    "price": price_int,
                    "quantity": qty,
                    "qty": qty,
                    "variant_id": x.get("variant_id"),
                    "variant_key": x.get("variant_key"),
                    "variant_value": x.get("variant_value"),
                }
            )

        try:
            impl = get_connector(connector)
            payload = OrderPayload(
                customer_name=slot.name or "",
                customer_phone=slot.phone or "",
                customer_address=slot.address or "",
                customer_email=slot.email,
                items=normalized_items,
                note=slot.note,
                payment_method=slot.payment_method or "cod",
            )
            res = await impl.create_order(payload)
        except Exception as e:
            logger.exception("create_order_direct tenant_id=%s", tenant_uuid)
            res = OrderResult(success=False, error=str(e))

        if res.success:
            order.external_order_id = res.external_order_id
            order.external_order_url = res.external_order_url
            order.status = "confirmed"
            logger.info(
                "create_order_direct ok tenant_id=%s platform=%s external_id=%s",
                tenant_uuid,
                connector.platform,
                res.external_order_id,
            )
        else:
            logger.warning(
                "create_order_direct failed tenant_id=%s platform=%s error=%s",
                tenant_uuid,
                connector.platform,
                res.error,
            )
            order.source_mode = "lead"
            order.notes = (order.notes or "") + f" | direct_fallback_lead: {res.error}"
            effective_mode = "lead"

    if effective_mode == "link" and items_json:
        try:
            impl = get_connector(connector)
            link_res = await impl.generate_cart_link(items_json)
            order.external_order_url = link_res.url
            order.status = "checkout_opened"
        except UnsupportedOperation:
            order.source_mode = "lead"
            order.notes = (order.notes or "") + " | fallback_mode_c"
            effective_mode = "lead"
        except Exception as e:
            logger.exception("generate_cart_link")
            order.notes = (order.notes or "") + f" | link_error: {e}"

    db.add(order)
    await db.flush()
    await db.commit()
    await db.refresh(order)
    return order, effective_mode


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
        sales_agent = SalesAgent(bot_name=widget.bot_name, action_mode=widget.action_mode or "lead")
        slot_filler = SlotFiller(tenant_id, session_id)

        # ── Actions từ widget ─────────────────────────────
        if action and isinstance(action, dict):
            at = action.get("type") or action.get("action")
            data = action.get("data") if isinstance(action.get("data"), dict) else {}

            if at == "add_to_cart":
                pid = data.get("product_id")
                if pid:
                    if connector.platform == "generic":
                        slot.cart_items.append(
                            {
                                "product_id": str(pid),
                                "external_id": str(data.get("external_id") or pid),
                                "name": str(data.get("name") or "Sản phẩm"),
                                "price": int(data.get("price") or 0),
                                "quantity": int(data.get("quantity") or 1),
                                "variant_key": data.get("variant_key"),
                                "variant_value": data.get("variant_value"),
                            }
                        )
                    else:
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
                content = "Đã thêm sản phẩm vào giỏ hàng thành công."
                intent = "add_to_cart"

            elif at == "checkout":
                if not slot.cart_items:
                    content = "Giỏ hàng đang trống, vui lòng chọn sản phẩm trước khi thanh toán."
                else:
                    slot.step = "form"
                    await save_slot(tenant_id, session_id, slot)
                    ui_components.append(_order_form_ui(widget, slot))
                    content = "Vui lòng điền thông tin thanh toán bên dưới."
                intent = "checkout"

            elif at == "submit_form":
                for key in ("name", "phone", "address", "email", "note"):
                    if data.get(key):
                        setattr(slot, key, str(data.get(key)))
                if data.get("payment_method"):
                    slot.payment_method = str(data.get("payment_method"))
                slot.step = "form"
                await save_slot(tenant_id, session_id, slot)

                order, mode = await _create_sales_order_from_slot(
                    db,
                    tenant_uuid=tenant_uuid,
                    session_id=session_id,
                    slot=slot,
                    widget=widget,
                    connector=connector,
                )
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

            elif at == "select_payment":
                if data.get("payment_method"):
                    slot.payment_method = str(data.get("payment_method"))
                    slot.step = "payment"
                    await save_slot(tenant_id, session_id, slot)
                    content = "Đã chọn phương thức thanh toán."
                    intent = "select_payment"
                else:
                    ui_components.append(_payment_selection_ui(widget))
                    content = "Vui lòng chọn phương thức thanh toán."
                    intent = "checkout"

            elif at == "confirm_order":
                if data.get("payment_method"):
                    slot.payment_method = str(data.get("payment_method"))
                if data.get("name"):
                    slot.name = str(data.get("name"))
                if data.get("phone"):
                    slot.phone = str(data.get("phone"))
                if data.get("address"):
                    slot.address = str(data.get("address"))
                if data.get("email"):
                    slot.email = str(data.get("email"))
                if data.get("note"):
                    slot.note = str(data.get("note"))

                if not slot.cart_items:
                    content = "Giỏ hàng đang trống, vui lòng chọn sản phẩm trước khi xác nhận."
                    intent = "confirm_order"
                else:
                    slot.step = "confirm"
                    await save_slot(tenant_id, session_id, slot)
                    order, mode = await _create_sales_order_from_slot(
                        db,
                        tenant_uuid=tenant_uuid,
                        session_id=session_id,
                        slot=slot,
                        widget=widget,
                        connector=connector,
                    )
                    await notify_new_lead(order, tenant)
                    slot.step = "done"
                    slot.cart_items = []
                    await save_slot(tenant_id, session_id, slot)
                    if mode == "link" and order.external_order_url:
                        sub_i = int(order.subtotal) if order.subtotal is not None else 0
                        ui_components.append(_checkout_link_ui(order.external_order_url, sub_i, widget))
                        content = "Đây là liên kết thanh toán trên website shop."
                    else:
                        ui_components.append(_confirmation_ui(order, widget))
                        content = "Đơn hàng đã được xác nhận thành công."
                intent = "confirm_order"

        # ── Free text ─────────────────────────────────────
        if not content:
            q = _lower(query)
            try:
                agent_out = await sales_agent.process(
                    query,
                    slot.to_dict(),
                    form_fields=widget.form_fields or [],
                )
                intent = agent_out.intent or classify_intent(query)
            except Exception:
                logger.exception("sales_agent_failed tenant_id=%s", tenant_id)
                intent = classify_intent(query)
            order_slots = OrderSlots(
                selected_products=list(slot.cart_items or []),
                name=slot.name,
                phone=slot.phone,
                address=slot.address,
                email=slot.email,
                note=slot.note,
                payment_method=slot.payment_method,
                current_step=slot.step if slot.step in ("product", "cart", "form", "payment", "confirm") else "product",
                confirmed=False,
            )
            filled = await slot_filler.extract_slots(query, order_slots, widget.form_fields or [])
            # đồng bộ ngược sang slot runtime hiện tại để tận dụng data extract từ free-text.
            slot.name = filled.name or slot.name
            slot.phone = filled.phone or slot.phone
            slot.address = filled.address or slot.address
            slot.email = filled.email or slot.email
            slot.note = filled.note or slot.note
            if any(t in q for t in ORDER_TRIGGERS):
                missing = slot_filler.get_missing_required_fields(filled, widget.form_fields or [])
                if missing:
                    ui_components.append(_order_form_ui(widget, slot))
                    content = "Vui lòng điền thông tin giao hàng còn thiếu bên dưới."
                else:
                    ui_components.append(_payment_selection_ui(widget))
                    content = "Mình đã nhận đủ thông tin, vui lòng chọn phương thức thanh toán và xác nhận đơn."
                intent = "checkout"
            elif any(t in q for t in BROWSE_TRIGGERS):
                m = re.search(r"^\s*search:\s*(.+)$", query, re.I)
                search_q = m.group(1).strip() if m else ""
                runtime_error = None
                runtime_products: list[ProductData] = []
                if connector.platform == "generic":
                    try:
                        impl = get_connector(connector)
                        runtime_products = await impl.fetch_products(page=1, per_page=5, search_q=search_q)
                    except Exception as e:
                        logger.exception("generic_fetch_products_runtime tenant_id=%s", tenant_id)
                        runtime_error = str(e)
                if runtime_products:
                    ui_components.append(_product_data_to_cards(runtime_products, widget))
                    content = "Một số sản phẩm gợi ý:"
                else:
                    products = await _search_products_db(db, tenant_uuid, search_q, limit=5)
                    if products:
                        ui_components.append(_products_to_cards(products, widget))
                        content = "Một số sản phẩm gợi ý:"
                    elif runtime_error:
                        content = (
                            "Không lấy được sản phẩm từ API tenant lúc này. "
                            "Vui lòng kiểm tra lại endpoint products/query template."
                        )
                    else:
                        content = "Hiện chưa có sản phẩm trong kho. Vui lòng liên hệ shop hoặc thử lại sau."
                intent = "product_search"
            elif any(t in q for t in CART_TRIGGERS):
                ui_components.append(_cart_ui(slot, widget))
                content = "Đây là giỏ hàng hiện tại của bạn."
                intent = "view_cart"
            elif q.startswith("/shop") or q.startswith("shop:"):
                sq = q.replace("/shop", "", 1).replace("shop:", "", 1).strip()
                runtime_error = None
                runtime_products: list[ProductData] = []
                if connector.platform == "generic":
                    try:
                        impl = get_connector(connector)
                        runtime_products = await impl.fetch_products(page=1, per_page=5, search_q=sq)
                    except Exception as e:
                        logger.exception("generic_fetch_products_runtime tenant_id=%s", tenant_id)
                        runtime_error = str(e)
                if runtime_products:
                    ui_components.append(_product_data_to_cards(runtime_products, widget))
                    content = "Kết quả tìm kiếm:"
                else:
                    products = await _search_products_db(db, tenant_uuid, sq, limit=5)
                    if products:
                        ui_components.append(_products_to_cards(products, widget))
                        content = "Kết quả tìm kiếm:"
                    elif runtime_error:
                        content = (
                            "Không lấy được sản phẩm từ API tenant lúc này. "
                            "Vui lòng kiểm tra lại endpoint products/query template."
                        )
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
    if (
        any(t in q for t in ORDER_TRIGGERS)
        or any(t in q for t in BROWSE_TRIGGERS)
        or any(t in q for t in CART_TRIGGERS)
    ):
        return True
    if q.startswith("/shop") or q.startswith("shop:"):
        return True
    return False
