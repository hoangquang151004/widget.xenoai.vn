"""WooCommerce REST API v3 connector."""

from __future__ import annotations

import logging
import re
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

import httpx

from services.connectors.base import (
    CartLinkResult,
    ConnectorProtocol,
    OrderPayload,
    OrderResult,
    ProductData,
)

logger = logging.getLogger(__name__)

WC_STATUS_MAP = {
    "pending": "pending",
    "processing": "confirmed",
    "on-hold": "pending",
    "completed": "delivered",
    "cancelled": "cancelled",
    "refunded": "cancelled",
    "failed": "failed",
}


def _strip_html(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"<[^>]+>", " ", text).strip()


def _to_int_price(val: Any) -> Optional[int]:
    if val is None or val == "":
        return None
    try:
        return int(Decimal(str(val)).quantize(Decimal("1")))
    except (InvalidOperation, ValueError, TypeError):
        return None


class WooCommerceConnector(ConnectorProtocol):
    def _base(self) -> str:
        site = str(self.credentials.get("site_url", "")).rstrip("/")
        return f"{site}/wp-json/wc/v3"

    def _auth_params(self) -> dict[str, str]:
        return {
            "consumer_key": str(self.credentials.get("consumer_key", "")),
            "consumer_secret": str(self.credentials.get("consumer_secret", "")),
        }

    async def test_connection(self) -> tuple[bool, str]:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    f"{self._base()}/products",
                    params={**self._auth_params(), "per_page": 1},
                )
            if r.status_code == 200:
                return True, ""
            if r.status_code in (401, 403):
                return False, "Sai consumer_key/consumer_secret hoặc không có quyền."
            return False, f"HTTP {r.status_code}: {r.text[:200]}"
        except Exception as e:
            logger.exception("WC test_connection")
            return False, str(e)

    def _map_product(self, row: dict) -> ProductData:
        imgs = row.get("images") or []
        images = [{"url": i.get("src", ""), "alt": i.get("name") or i.get("alt") or ""} for i in imgs if i.get("src")]
        categories = row.get("categories") or []
        cat = categories[0].get("name") if categories else None
        in_stock = (row.get("stock_status") == "instock") and row.get("purchasable", True)
        qty = row.get("stock_quantity")
        if qty is not None:
            try:
                qty = int(qty)
            except (TypeError, ValueError):
                qty = None
        return ProductData(
            external_id=str(row.get("id", "")),
            name=str(row.get("name", "")),
            description=_strip_html(str(row.get("description") or row.get("short_description") or "")),
            price=_to_int_price(row.get("price")),
            compare_price=_to_int_price(row.get("regular_price")),
            sku=row.get("sku") or None,
            stock_quantity=qty,
            in_stock=bool(in_stock),
            images=images,
            variants=[],
            tags=[t.get("name", "") for t in (row.get("tags") or []) if t.get("name")],
            category=cat,
            raw_data=row,
        )

    async def fetch_products(self, page: int = 1, per_page: int = 100) -> list[ProductData]:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(
                f"{self._base()}/products",
                params={
                    **self._auth_params(),
                    "page": page,
                    "per_page": per_page,
                    "status": "publish",
                },
            )
        r.raise_for_status()
        return [self._map_product(row) for row in r.json()]

    async def get_product(self, external_id: str) -> Optional[ProductData]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.get(
                    f"{self._base()}/products/{external_id}",
                    params=self._auth_params(),
                )
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return self._map_product(r.json())
        except Exception:
            logger.exception("WC get_product")
            return None

    async def generate_cart_link(self, items: list[dict]) -> CartLinkResult:
        site = str(self.credentials.get("site_url", "")).rstrip("/")
        if not items:
            return CartLinkResult(url=site or "/")
        first = items[0]
        ext_id = first.get("external_id") or first.get("product_id")
        qty = int(first.get("quantity") or 1)
        if len(items) == 1 and ext_id:
            url = f"{site}/?add-to-cart={ext_id}&quantity={qty}"
            return CartLinkResult(url=url)
        return CartLinkResult(url=f"{site}/cart/" if site else "/")

    async def create_order(self, payload: OrderPayload) -> OrderResult:
        line_items = []
        for it in payload.items:
            ext = it.get("external_id")
            if not ext:
                continue
            line_items.append(
                {
                    "product_id": int(ext),
                    "quantity": int(it.get("quantity") or 1),
                }
            )
        body = {
            "payment_method": "bacs",
            "payment_method_title": payload.payment_method or "Chat",
            "set_paid": False,
            "billing": {
                "first_name": payload.customer_name[:50] if payload.customer_name else "Guest",
                "phone": payload.customer_phone or "",
                "email": payload.customer_email or "",
                "address_1": payload.customer_address or "",
            },
            "line_items": line_items or [],
            "customer_note": payload.note or "",
        }
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                r = await client.post(
                    f"{self._base()}/orders",
                    params=self._auth_params(),
                    json=body,
                )
            if r.status_code not in (200, 201):
                return OrderResult(success=False, error=r.text[:500])
            data = r.json()
            return OrderResult(
                success=True,
                external_order_id=str(data.get("id", "")),
                external_order_url=data.get("permalink"),
            )
        except Exception as e:
            logger.exception("WC create_order")
            return OrderResult(success=False, error=str(e))

    async def get_order_status(self, external_order_id: str) -> Optional[dict]:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    f"{self._base()}/orders/{external_order_id}",
                    params=self._auth_params(),
                )
            if r.status_code != 200:
                return None
            d = r.json()
            wc_status = str(d.get("status") or "")
            mapped = WC_STATUS_MAP.get(wc_status, wc_status or "pending")
            return {
                "status": mapped,
                "payment_status": d.get("payment_status"),
                "raw_status": wc_status,
            }
        except Exception:
            return None
