"""REST generic mapping — MVP: fetch theo field map; cart/order tùy config."""

from __future__ import annotations

import logging
import re
from typing import Any, Optional

import httpx

from services.connectors.base import (
    CartLinkResult,
    ConnectorProtocol,
    OrderPayload,
    OrderResult,
    ProductData,
    UnsupportedOperation,
)

logger = logging.getLogger(__name__)
PLACEHOLDER_RE = re.compile(r"^\{([a-zA-Z0-9_]+)\}$")


class GenericConnector(ConnectorProtocol):
    def _resolve_endpoint(self, code: str, fallback_field: str, default_path: str) -> dict[str, Any]:
        endpoints = self.config.get("endpoints")
        if isinstance(endpoints, list):
            for item in endpoints:
                if not isinstance(item, dict):
                    continue
                if str(item.get("code", "")).strip().lower() != code:
                    continue
                path = str(item.get("path", "")).strip()
                method = str(item.get("method", "GET")).strip().upper() or "GET"
                if path:
                    return {
                        "method": method,
                        "path": path,
                        "path_template": str(item.get("path_template", "")).strip() or path,
                        "query_template": item.get("query_template")
                        if isinstance(item.get("query_template"), dict)
                        else {},
                        "body_template": item.get("body_template")
                        if isinstance(item.get("body_template"), dict)
                        else None,
                    }
        legacy_path = str(self.config.get(fallback_field, "")).strip() or default_path
        return {
            "method": "GET" if code != "create_order" else "POST",
            "path": legacy_path,
            "path_template": legacy_path,
            "query_template": {},
            "body_template": None,
        }

    def _render_value(self, value: Any, context: dict[str, Any]) -> Any:
        if isinstance(value, dict):
            return {k: self._render_value(v, context) for k, v in value.items()}
        if isinstance(value, list):
            return [self._render_value(v, context) for v in value]
        if isinstance(value, str):
            m = PLACEHOLDER_RE.match(value.strip())
            if m:
                return context.get(m.group(1))
            return value
        return value

    def _render_path_template(self, path_template: str, context: dict[str, Any]) -> str:
        result = path_template or ""
        for key, val in context.items():
            if val is None:
                continue
            result = result.replace(f"{{{key}}}", str(val))
        return result

    def _build_request_from_template(
        self, endpoint: dict[str, Any], *, context: dict[str, Any]
    ) -> tuple[str, str, dict[str, Any], Optional[dict[str, Any]]]:
        method = str(endpoint.get("method", "GET")).strip().upper() or "GET"
        path_template = str(endpoint.get("path_template") or endpoint.get("path") or "").strip()
        path = self._render_path_template(path_template, context)

        raw_query = endpoint.get("query_template")
        query_tmpl = raw_query if isinstance(raw_query, dict) else {}
        query = self._render_value(query_tmpl, context)
        if not isinstance(query, dict):
            query = {}
        query = {str(k): v for k, v in query.items() if v is not None and str(v) != ""}

        body_tmpl = endpoint.get("body_template")
        body = self._render_value(body_tmpl, context) if isinstance(body_tmpl, dict) else None
        return method, path, query, body

    async def _request(self, method: str, url: str, **kwargs):
        auth_type = str(self.config.get("auth_type") or self.credentials.get("auth_type") or "bearer")
        token = str(self.credentials.get("auth_value") or self.credentials.get("token") or "").strip()
        headers = dict(kwargs.pop("headers", {}))
        if auth_type == "bearer":
            if token:
                headers["Authorization"] = f"Bearer {token}"
        elif auth_type == "api_key":
            hname = self.config.get("api_key_header", "X-API-Key")
            if token:
                headers[hname] = str(token)
        kwargs["headers"] = headers
        async with httpx.AsyncClient(timeout=60.0) as client:
            method_name = str(method or "").strip().lower()
            if method_name in ("get", "post", "put", "patch", "delete"):
                return await getattr(client, method_name)(url, **kwargs)
            return await client.request(method_name.upper(), url, **kwargs)

    async def test_connection(self) -> tuple[bool, str]:
        base = str(self.credentials.get("base_url", "")).rstrip("/")
        endpoint = self._resolve_endpoint("products", "products_endpoint", "/products")
        method, path, query, _ = self._build_request_from_template(
            endpoint, context={"page": 1, "limit": 1, "q": ""}
        )
        if not query:
            query = {"limit": 1}
        try:
            r = await self._request(method, f"{base}{path}", params=query)
            if r.status_code == 200:
                return True, ""
            return False, f"HTTP {r.status_code}"
        except Exception as e:
            return False, str(e)

    def _pick(self, row: dict, key: str, default: Any = None) -> Any:
        field_name = self.config.get(key) or key
        return row.get(field_name, default)

    async def fetch_products(
        self, page: int = 1, per_page: int = 100, search_q: str = ""
    ) -> list[ProductData]:
        base = str(self.credentials.get("base_url", "")).rstrip("/")
        endpoint = self._resolve_endpoint("products", "products_endpoint", "/products")
        method, path, query, _ = self._build_request_from_template(
            endpoint, context={"page": page, "limit": per_page, "q": search_q}
        )
        if not query:
            query = {"page": page, "limit": per_page}
        r = await self._request(
            method,
            f"{base}{path}",
            params=query,
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
        raise UnsupportedOperation(
            "Generic connector không hỗ trợ generate_cart_link; cần fallback sang Mode C."
        )

    async def create_order(self, payload: OrderPayload) -> OrderResult:
        base = str(self.credentials.get("base_url", "")).rstrip("/")
        endpoint = self._resolve_endpoint("create_order", "order_endpoint", "")
        context = {
            "customer_name": payload.customer_name,
            "customer_phone": payload.customer_phone,
            "customer_address": payload.customer_address,
            "customer_email": payload.customer_email,
            "items": payload.items,
            "note": payload.note,
            "payment_method": payload.payment_method,
            "payload": payload.__dict__,
        }
        method, ep, query, body = self._build_request_from_template(endpoint, context=context)
        if not ep:
            return OrderResult(success=False, error="Chưa cấu hình order_endpoint.")
        try:
            req_json = body if isinstance(body, dict) else {"payload": payload.__dict__}
            url = f"{base}{ep}"
            logger.info(
                "generic.create_order POST %s body_keys=%s items_count=%d",
                url,
                list(req_json.keys()) if isinstance(req_json, dict) else None,
                len(payload.items or []),
            )
            r = await self._request(method, url, params=query, json=req_json)
            if r.status_code not in (200, 201):
                err_text = (r.text or "")[:500]
                logger.warning(
                    "generic.create_order HTTP %s url=%s response=%s",
                    r.status_code,
                    url,
                    err_text,
                )
                return OrderResult(success=False, error=f"HTTP {r.status_code}: {err_text}")
            data = r.json() if r.text else {}
            return OrderResult(
                success=True,
                external_order_id=str(data.get("id", "")) if isinstance(data, dict) else "",
            )
        except Exception as e:
            logger.exception("generic.create_order exception url=%s%s", base, ep)
            return OrderResult(success=False, error=str(e))

    async def get_order_status(self, external_order_id: str) -> Optional[dict]:
        base = str(self.credentials.get("base_url", "")).rstrip("/")
        endpoint = self._resolve_endpoint("order_history", "order_history_endpoint", "")
        method, ep, query, _ = self._build_request_from_template(
            endpoint,
            context={
                "external_order_id": external_order_id,
                "order_id": external_order_id,
                "customer_phone": "",
            },
        )
        if not ep:
            return None
        url = f"{base}{ep}"
        try:
            r = await self._request(method, url, params=query)
            if r.status_code >= 400:
                return None
            data = r.json()
            return data if isinstance(data, dict) else {"data": data}
        except Exception:
            return None
