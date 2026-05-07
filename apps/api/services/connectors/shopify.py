"""Shopify Admin API — MVP: test + fetch một phần; cart/order mở rộng sau."""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from services.connectors.base import (
    CartLinkResult,
    ConnectorProtocol,
    OrderPayload,
    OrderResult,
    ProductData,
)

logger = logging.getLogger(__name__)


class ShopifyConnector(ConnectorProtocol):
    def _headers(self) -> dict[str, str]:
        token = str(self.credentials.get("access_token", ""))
        return {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}

    def _base(self) -> str:
        domain = str(self.credentials.get("shop_domain", "")).rstrip("/")
        if not domain.endswith(".myshopify.com") and "." not in domain:
            domain = f"{domain}.myshopify.com"
        return f"https://{domain}/admin/api/2024-01"

    async def test_connection(self) -> tuple[bool, str]:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    f"{self._base()}/products.json?limit=1",
                    headers=self._headers(),
                )
            if r.status_code == 200:
                return True, ""
            return False, f"HTTP {r.status_code}: {r.text[:200]}"
        except Exception as e:
            logger.exception("Shopify test")
            return False, str(e)

    async def fetch_products(self, page: int = 1, per_page: int = 100) -> list[ProductData]:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(
                f"{self._base()}/products.json",
                params={"limit": min(per_page, 250), "page": page},
                headers=self._headers(),
            )
        r.raise_for_status()
        out: list[ProductData] = []
        for row in r.json().get("products", []):
            variants = row.get("variants") or []
            v0 = variants[0] if variants else {}
            imgs = row.get("images") or []
            images = [{"url": i.get("src", ""), "alt": i.get("alt") or ""} for i in imgs if i.get("src")]
            price = None
            if v0.get("price"):
                try:
                    price = int(float(v0["price"]))
                except (TypeError, ValueError):
                    price = None
            qty = v0.get("inventory_quantity")
            try:
                qty = int(qty) if qty is not None else None
            except (TypeError, ValueError):
                qty = None
            out.append(
                ProductData(
                    external_id=str(row.get("id", "")),
                    name=str(row.get("title", "")),
                    description=str(row.get("body_html") or "")[:8000],
                    price=price,
                    compare_price=None,
                    sku=v0.get("sku"),
                    stock_quantity=qty,
                    in_stock=bool(v0.get("available", True)),
                    images=images,
                    variants=[],
                    tags=[t.strip() for t in str(row.get("tags") or "").split(",") if t.strip()],
                    category=None,
                    raw_data=row,
                )
            )
        return out

    async def get_product(self, external_id: str) -> Optional[ProductData]:
        rows = await self.fetch_products(page=1, per_page=250)
        for p in rows:
            if p.external_id == external_id:
                return p
        return None

    async def generate_cart_link(self, items: list[dict]) -> CartLinkResult:
        domain = str(self.credentials.get("shop_domain", "")).replace("https://", "").split("/")[0]
        if not items:
            return CartLinkResult(url=f"https://{domain}" if domain else "/")
        parts = []
        for it in items:
            vid = it.get("variant_id") or it.get("external_id")
            q = int(it.get("quantity") or 1)
            if vid:
                parts.append(f"{vid}:{q}")
        path = "/cart/" + ",".join(parts) if parts else "/cart"
        return CartLinkResult(url=f"https://{domain}{path}" if domain else path)

    async def create_order(self, payload: OrderPayload) -> OrderResult:
        return OrderResult(success=False, error="Shopify create_order chưa bật trong MVP.")

    async def get_order_status(self, external_order_id: str) -> Optional[dict]:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    f"{self._base()}/orders/{external_order_id}.json",
                    headers=self._headers(),
                )
            if r.status_code != 200:
                return None
            d = r.json().get("order") or {}
            return {"status": d.get("financial_status"), "payment_status": d.get("financial_status")}
        except Exception:
            return None
