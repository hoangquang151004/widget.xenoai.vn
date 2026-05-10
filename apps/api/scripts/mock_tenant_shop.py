from __future__ import annotations

import os
import re
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

import aiomysql
import uvicorn
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

DEMO_TOKEN = "demo-shop-token"
IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _env(key: str, default: str) -> str:
    return os.getenv(key, default).strip() or default


def _safe_ident(raw: str, label: str) -> str:
    value = raw.strip()
    if not IDENTIFIER_RE.match(value):
        raise RuntimeError(f"Invalid SQL identifier for {label}: {raw}")
    return value


MYSQL_HOST = _env("MOCK_MYSQL_HOST", "localhost")
MYSQL_PORT = int(_env("MOCK_MYSQL_PORT", "3306"))
MYSQL_DB = _env("MOCK_MYSQL_DB", "da_muoi_db")
MYSQL_USER = _env("MOCK_MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MOCK_MYSQL_PASSWORD", "")

PRODUCT_TABLE = _safe_ident(_env("MOCK_PRODUCT_TABLE", "products"), "product_table")
ORDER_TABLE = _safe_ident(_env("MOCK_ORDER_TABLE", "orders"), "order_table")
ORDER_ITEM_TABLE = _safe_ident(_env("MOCK_ORDER_ITEM_TABLE", "order_items"), "order_item_table")

PROD_COL_ID = _safe_ident(_env("MOCK_PROD_COL_ID", "id"), "prod_col_id")
PROD_COL_NAME = _safe_ident(_env("MOCK_PROD_COL_NAME", "name"), "prod_col_name")
PROD_COL_PRICE = _safe_ident(_env("MOCK_PROD_COL_PRICE", "price"), "prod_col_price")
PROD_COL_STOCK = _safe_ident(_env("MOCK_PROD_COL_STOCK", "stock"), "prod_col_stock")
PROD_COL_DESC = _safe_ident(_env("MOCK_PROD_COL_DESC", "description"), "prod_col_desc")
PROD_COL_IMAGE = _safe_ident(_env("MOCK_PROD_COL_IMAGE", "image_url"), "prod_col_image")

ORDER_COL_ID = _safe_ident(_env("MOCK_ORDER_COL_ID", "id"), "order_col_id")
ORDER_COL_NAME = _safe_ident(_env("MOCK_ORDER_COL_NAME", "customer_name"), "order_col_name")
ORDER_COL_PHONE = _safe_ident(_env("MOCK_ORDER_COL_PHONE", "customer_phone"), "order_col_phone")
ORDER_COL_ADDRESS = _safe_ident(_env("MOCK_ORDER_COL_ADDRESS", "customer_address"), "order_col_address")
ORDER_COL_EMAIL = _safe_ident(_env("MOCK_ORDER_COL_EMAIL", "customer_email"), "order_col_email")
ORDER_COL_SUBTOTAL = _safe_ident(_env("MOCK_ORDER_COL_SUBTOTAL", "subtotal"), "order_col_subtotal")
ORDER_COL_STATUS = _safe_ident(_env("MOCK_ORDER_COL_STATUS", "status"), "order_col_status")
ORDER_COL_PAYMENT_METHOD = _safe_ident(
    _env("MOCK_ORDER_COL_PAYMENT_METHOD", "payment_method"), "order_col_payment_method"
)
ORDER_COL_NOTE = _safe_ident(_env("MOCK_ORDER_COL_NOTE", "notes"), "order_col_note")
ORDER_COL_CREATED_AT = _safe_ident(_env("MOCK_ORDER_COL_CREATED_AT", "created_at"), "order_col_created_at")

ITEM_COL_ORDER_ID = _safe_ident(_env("MOCK_ITEM_COL_ORDER_ID", "order_id"), "item_col_order_id")
ITEM_COL_PRODUCT_ID = _safe_ident(_env("MOCK_ITEM_COL_PRODUCT_ID", "product_id"), "item_col_product_id")
ITEM_COL_QTY = _safe_ident(_env("MOCK_ITEM_COL_QTY", "qty"), "item_col_qty")
ITEM_COL_PRICE = _safe_ident(_env("MOCK_ITEM_COL_PRICE", "price"), "item_col_price")
ITEM_COL_LINE_TOTAL = _safe_ident(_env("MOCK_ITEM_COL_LINE_TOTAL", "line_total"), "item_col_line_total")


class OrderItemIn(BaseModel):
    product_id: str = Field(..., min_length=1)
    qty: int = Field(..., ge=1)
    price: int | None = Field(default=None, ge=0)


class OrderPayloadIn(BaseModel):
    customer_name: str = Field(..., min_length=1)
    customer_phone: str = Field(..., min_length=1)
    customer_address: str = Field(..., min_length=1)
    customer_email: str | None = None
    items: list[OrderItemIn] = Field(default_factory=list)
    note: str | None = None
    payment_method: str = "cod"


class CreateOrderBody(BaseModel):
    payload: OrderPayloadIn


@asynccontextmanager
async def _lifespan(app: FastAPI):
    pool = await aiomysql.create_pool(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        db=MYSQL_DB,
        minsize=1,
        maxsize=5,
        autocommit=False,
    )
    app.state.db_pool = pool
    try:
        yield
    finally:
        pool.close()
        await pool.wait_closed()


app = FastAPI(title="Mock Tenant Shop (MySQL)", version="2.0.0", lifespan=_lifespan)


def _require_auth(authorization: str | None) -> None:
    if not authorization:
        return
    normalized = authorization.strip().lower()
    if normalized in (f"bearer {DEMO_TOKEN}".lower(), f"bearer bearer {DEMO_TOKEN}".lower()):
        return
    if DEMO_TOKEN.lower() in normalized:
        return
    raise HTTPException(status_code=401, detail="Invalid Bearer token for demo shop")


def _to_int(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, Decimal):
        return int(value)
    return int(float(value))


def _to_iso(value: Any) -> str:
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=UTC)
        return dt.isoformat()
    return str(value or "")


@app.get("/", response_class=HTMLResponse)
async def storefront() -> str:
    return f"""
<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tenant Shop MySQL</title>
  <style>
    body {{ font-family: Inter, system-ui, sans-serif; max-width: 980px; margin: 30px auto; padding: 0 16px; background: #f8fafc; }}
    h1 {{ margin: 0; }}
    .note {{ color: #475569; margin: 8px 0 18px; }}
    code {{ background: #e2e8f0; border-radius: 6px; padding: 2px 6px; }}
  </style>
</head>
<body>
  <h1>Tenant shop demo (MySQL mode)</h1>
  <p class="note">
    MySQL: <code>{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}</code><br/>
    API products: <code>GET /products?page=1&limit=20</code><br/>
    API create order: <code>POST /orders</code><br/>
    API order history: <code>GET /orders?phone=... hoặc GET /orders/{{order_id}}</code><br/>
    Header auth: <code>Authorization: Bearer {DEMO_TOKEN}</code>
  </p>
</body>
</html>
"""


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/products")
async def list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    _require_auth(authorization)
    offset = (page - 1) * limit
    sql = f"""
        SELECT
            `{PROD_COL_ID}` AS id,
            `{PROD_COL_NAME}` AS name,
            `{PROD_COL_PRICE}` AS price,
            `{PROD_COL_STOCK}` AS stock,
            `{PROD_COL_DESC}` AS description,
            `{PROD_COL_IMAGE}` AS image_url
        FROM `{PRODUCT_TABLE}`
        LIMIT %s OFFSET %s
    """
    try:
        async with app.state.db_pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(sql, (limit, offset))
                rows = await cur.fetchall()
        return [
            {
                "id": str(r.get("id", "")),
                "name": str(r.get("name", "")),
                "price": _to_int(r.get("price")),
                "stock": _to_int(r.get("stock")),
                "description": str(r.get("description") or ""),
                "image_url": str(r.get("image_url") or ""),
            }
            for r in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MySQL products query failed: {e}")


async def _find_product_price(conn: aiomysql.Connection, product_id: str) -> int:
    sql = f"SELECT `{PROD_COL_PRICE}` AS price FROM `{PRODUCT_TABLE}` WHERE `{PROD_COL_ID}` = %s LIMIT 1"
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(sql, (product_id,))
        row = await cur.fetchone()
    return _to_int(row.get("price") if row else 0)


@app.post("/orders")
async def create_order(
    body: CreateOrderBody,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_auth(authorization)
    payload = body.payload
    if not payload.items:
        raise HTTPException(status_code=400, detail="items không được để trống")

    order_id = f"mock_order_{uuid4().hex[:12]}"
    subtotal = 0
    try:
        async with app.state.db_pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                insert_order_sql = f"""
                    INSERT INTO `{ORDER_TABLE}` (
                        `{ORDER_COL_ID}`, `{ORDER_COL_NAME}`, `{ORDER_COL_PHONE}`, `{ORDER_COL_ADDRESS}`,
                        `{ORDER_COL_EMAIL}`, `{ORDER_COL_SUBTOTAL}`, `{ORDER_COL_STATUS}`,
                        `{ORDER_COL_PAYMENT_METHOD}`, `{ORDER_COL_NOTE}`, `{ORDER_COL_CREATED_AT}`
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                await cur.execute(
                    insert_order_sql,
                    (
                        order_id,
                        payload.customer_name,
                        payload.customer_phone,
                        payload.customer_address,
                        payload.customer_email,
                        0,
                        "pending",
                        payload.payment_method,
                        payload.note,
                        datetime.now(UTC).replace(tzinfo=None),
                    ),
                )

                for item in payload.items:
                    unit_price = int(
                        item.price
                        if item.price is not None
                        else await _find_product_price(conn, item.product_id)
                    )
                    line_total = unit_price * int(item.qty)
                    subtotal += line_total
                    insert_item_sql = f"""
                        INSERT INTO `{ORDER_ITEM_TABLE}` (
                            `{ITEM_COL_ORDER_ID}`, `{ITEM_COL_PRODUCT_ID}`, `{ITEM_COL_QTY}`,
                            `{ITEM_COL_PRICE}`, `{ITEM_COL_LINE_TOTAL}`
                        )
                        VALUES (%s, %s, %s, %s, %s)
                    """
                    await cur.execute(
                        insert_item_sql,
                        (order_id, item.product_id, int(item.qty), unit_price, line_total),
                    )

                update_subtotal_sql = f"""
                    UPDATE `{ORDER_TABLE}` SET `{ORDER_COL_SUBTOTAL}` = %s WHERE `{ORDER_COL_ID}` = %s
                """
                await cur.execute(update_subtotal_sql, (subtotal, order_id))
            await conn.commit()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MySQL create order failed: {e}")

    return {
        "id": order_id,
        "status": "pending",
        "subtotal": subtotal,
        "message": "Đơn hàng demo đã được tạo thành công",
    }


@app.get("/orders")
async def list_orders(
    phone: str | None = Query(default=None),
    limit: int = Query(20, ge=1, le=100),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_auth(authorization)
    where_sql = ""
    params: list[Any] = []
    if phone:
        where_sql = f"WHERE `{ORDER_COL_PHONE}` = %s"
        params.append(phone.strip())
    params.append(limit)
    sql = f"""
        SELECT
            `{ORDER_COL_ID}` AS id,
            `{ORDER_COL_STATUS}` AS status,
            `{ORDER_COL_NAME}` AS customer_name,
            `{ORDER_COL_PHONE}` AS customer_phone,
            `{ORDER_COL_SUBTOTAL}` AS subtotal,
            `{ORDER_COL_PAYMENT_METHOD}` AS payment_method,
            `{ORDER_COL_CREATED_AT}` AS created_at
        FROM `{ORDER_TABLE}`
        {where_sql}
        ORDER BY `{ORDER_COL_CREATED_AT}` DESC
        LIMIT %s
    """
    try:
        async with app.state.db_pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(sql, tuple(params))
                rows = await cur.fetchall()
        return {
            "items": [
                {
                    "id": str(r.get("id", "")),
                    "status": str(r.get("status", "pending")),
                    "customer_name": str(r.get("customer_name") or ""),
                    "customer_phone": str(r.get("customer_phone") or ""),
                    "subtotal": _to_int(r.get("subtotal")),
                    "payment_method": str(r.get("payment_method") or ""),
                    "created_at": _to_iso(r.get("created_at")),
                }
                for r in rows
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MySQL orders query failed: {e}")


@app.get("/orders/{order_id}")
async def get_order_detail(
    order_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_auth(authorization)
    order_sql = f"""
        SELECT
            `{ORDER_COL_ID}` AS id,
            `{ORDER_COL_STATUS}` AS status,
            `{ORDER_COL_NAME}` AS customer_name,
            `{ORDER_COL_PHONE}` AS customer_phone,
            `{ORDER_COL_ADDRESS}` AS customer_address,
            `{ORDER_COL_EMAIL}` AS customer_email,
            `{ORDER_COL_SUBTOTAL}` AS subtotal,
            `{ORDER_COL_PAYMENT_METHOD}` AS payment_method,
            `{ORDER_COL_NOTE}` AS note,
            `{ORDER_COL_CREATED_AT}` AS created_at
        FROM `{ORDER_TABLE}`
        WHERE `{ORDER_COL_ID}` = %s
        LIMIT 1
    """
    item_sql = f"""
        SELECT
            `{ITEM_COL_PRODUCT_ID}` AS product_id,
            `{ITEM_COL_QTY}` AS qty,
            `{ITEM_COL_PRICE}` AS price,
            `{ITEM_COL_LINE_TOTAL}` AS line_total
        FROM `{ORDER_ITEM_TABLE}`
        WHERE `{ITEM_COL_ORDER_ID}` = %s
    """
    try:
        async with app.state.db_pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(order_sql, (order_id,))
                order = await cur.fetchone()
                if not order:
                    raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
                await cur.execute(item_sql, (order_id,))
                rows = await cur.fetchall()
        return {
            "id": str(order.get("id", "")),
            "status": str(order.get("status", "pending")),
            "customer_name": str(order.get("customer_name") or ""),
            "customer_phone": str(order.get("customer_phone") or ""),
            "customer_address": str(order.get("customer_address") or ""),
            "customer_email": str(order.get("customer_email") or ""),
            "subtotal": _to_int(order.get("subtotal")),
            "payment_method": str(order.get("payment_method") or ""),
            "note": str(order.get("note") or ""),
            "created_at": _to_iso(order.get("created_at")),
            "items": [
                {
                    "product_id": str(r.get("product_id") or ""),
                    "qty": _to_int(r.get("qty")),
                    "price": _to_int(r.get("price")),
                    "line_total": _to_int(r.get("line_total")),
                }
                for r in rows
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MySQL order detail failed: {e}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8090, reload=False)
