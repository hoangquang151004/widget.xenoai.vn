"""REST generic mapping — MVP: fetch theo field map; cart/order tùy config."""

from __future__ import annotations

import logging
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


class GenericConnector(ConnectorProtocol):
    async def _request(self, method: str, url: str, **kwargs):
        auth_type = str(self.config.get("auth_type") or self.credentials.get("auth_type") or "bearer")
        token = self.credentials.get("auth_value") or self.credentials.get("token") or ""
        headers = dict(kwargs.pop("headers", {}))
        if auth_type == "bearer":
            headers["Authorization"] = f"Bearer {token}"
        elif auth_type == "api_key":
            hname = self.config.get("api_key_header", "X-API-Key")
            headers[hname] = str(token)
        kwargs["headers"] = headers
        async with httpx.AsyncClient(timeout=60.0) as client:
            return await getattr(client, method)(url, **kwargs)

    async def test_connection(self) -> tuple[bool, str]:
        base = str(self.credentials.get("base_url", "")).rstrip("/")
        path = str(self.config.get("products_endpoint", "/products"))
        try:
            r = await self._request("GET", f"{base}{path}", params={"limit": 1})
            if r.status_code == 200:
                return True, ""
            return False, f"HTTP {r.status_code}"
        except Exception as e:
            return False, str(e)

    def _pick(self, row: dict, key: str, default: Any = None) -> Any:
        field_name = self.config.get(key) or key
        return row.get(field_name, default)

    async def fetch_products(self, page: int = 1, per_page: int = 100) -> list[ProductData]:
        base = str(self.credentials.get("base_url", "")).rstrip("/")
        path = str(self.config.get("products_endpoint", "/products"))
        r = await self._request(
            "GET",
            f"{base}{path}",
            params={"page": page, "limit": per_page},
        )
        r.raise_for_status()
        data = r.json()
        rows = data if isinstance(data, list) else data.get("items") or data.get("data") or []
        out: list[ProductData] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            pid = str(self._pick(row, "product_id_field", row.get("id")))
            name = str(self._pick(row, "product_name_field", row.get("name")) or "")
            price_raw = self._pick(row, "product_price_field", row.get("price"))
            stock_raw = self._pick(row, "product_stock_field", row.get("stock"))
            try:
                price = int(float(price_raw)) if price_raw is not None else None
            except (TypeError, ValueError):
                price = None
            try:
                sq = int(stock_raw) if stock_raw is not None else None
            except (TypeError, ValueError):
                sq = None
            in_stock = sq is None or sq > 0
            out.append(
                ProductData(
                    external_id=pid,
                    name=name,
                    description="",
                    price=price,
                    compare_price=None,
                    sku=None,
                    stock_quantity=sq,
                    in_stock=in_stock,
                    images=[],
                    variants=[],
                    tags=[],
                    category=None,
                    raw_data=row,
                )
            )
        return out

    async def get_product(self, external_id: str) -> Optional[ProductData]:
        allp = await self.fetch_products(1, 500)
        for p in allp:
            if p.external_id == external_id:
                return p
        return None

    async def generate_cart_link(self, items: list[dict]) -> CartLinkResult:
        base = str(self.credentials.get("base_url", "")).rstrip("/")
        return CartLinkResult(url=base or "/")

    async def create_order(self, payload: OrderPayload) -> OrderResult:
        base = str(self.credentials.get("base_url", "")).rstrip("/")
        ep = self.config.get("order_endpoint")
        if not ep:
            return OrderResult(success=False, error="Chưa cấu hình order_endpoint.")
        try:
            r = await self._request("POST", f"{base}{ep}", json={"payload": payload.__dict__})
            if r.status_code not in (200, 201):
                return OrderResult(success=False, error=r.text[:300])
            return OrderResult(success=True, external_order_id=str(r.json().get("id", "")))
        except Exception as e:
            return OrderResult(success=False, error=str(e))

    async def get_order_status(self, external_order_id: str) -> Optional[dict]:
        return None
