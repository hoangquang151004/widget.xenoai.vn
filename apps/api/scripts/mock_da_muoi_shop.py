"""Mock REST shop bám sát schema `da_muoi_db` (MySQL) để test REST generic connector.

Khởi động:
    apps/api/.venv/Scripts/python.exe apps/api/scripts/mock_da_muoi_shop.py

Cấu hình env (tùy chọn, mặc định localhost):
    DA_MUOI_MYSQL_HOST=localhost
    DA_MUOI_MYSQL_PORT=3306
    DA_MUOI_MYSQL_DB=da_muoi_db
    DA_MUOI_MYSQL_USER=root
    DA_MUOI_MYSQL_PASSWORD=
    DA_MUOI_PORT=8090
    DA_MUOI_TOKEN=demo-da-muoi-token   # truyền chuỗi rỗng để tắt auth
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import aiomysql
import uvicorn
from fastapi import FastAPI, Header, HTTPException, Path, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

logger = logging.getLogger("mock_da_muoi_shop")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def _env(key: str, default: str) -> str:
    raw = os.getenv(key)
    if raw is None:
        return default
    raw = raw.strip()
    return raw or default


MYSQL_HOST = _env("DA_MUOI_MYSQL_HOST", "localhost")
MYSQL_PORT = int(_env("DA_MUOI_MYSQL_PORT", "3306"))
MYSQL_DB = _env("DA_MUOI_MYSQL_DB", "da_muoi_db")
MYSQL_USER = _env("DA_MUOI_MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("DA_MUOI_MYSQL_PASSWORD", "")
SERVER_PORT = int(_env("DA_MUOI_PORT", "8090"))
DEMO_TOKEN = os.getenv("DA_MUOI_TOKEN", "demo-da-muoi-token")

ALLOWED_PAYMENT = {"cod", "bank_transfer"}
ALLOWED_STATUS = {"pending", "confirmed", "packing", "shipping", "delivered", "cancelled"}


class OrderItemIn(BaseModel):
    product_id: int = Field(..., gt=0)
    qty: int = Field(..., ge=1)
    price: int | None = Field(default=None, ge=0)


class OrderPayloadIn(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=100)
    customer_phone: str = Field(..., min_length=3, max_length=20)
    customer_address: str = Field(..., min_length=1, max_length=500)
    customer_email: str | None = None
    items: list[OrderItemIn] = Field(default_factory=list)
    note: str | None = None
    payment_method: str = Field(default="cod")


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
        charset="utf8mb4",
    )
    app.state.db_pool = pool
    logger.info(
        "MySQL pool ready -> %s:%s/%s as %s", MYSQL_HOST, MYSQL_PORT, MYSQL_DB, MYSQL_USER
    )
    try:
        yield
    finally:
        pool.close()
        await pool.wait_closed()


app = FastAPI(
    title="Mock Da Muoi Shop (MySQL)",
    version="1.0.0",
    description="Mock REST API ánh xạ schema `da_muoi_db` để test REST generic connector.",
    lifespan=_lifespan,
)


def _require_auth(authorization: str | None) -> None:
    if not DEMO_TOKEN:
        return
    if not authorization:
        raise HTTPException(status_code=401, detail="Thiếu header Authorization Bearer.")
    raw = authorization.strip()
    expected = f"Bearer {DEMO_TOKEN}".lower()
    if raw.lower() == expected or DEMO_TOKEN.lower() in raw.lower():
        return
    raise HTTPException(status_code=401, detail="Bearer token không hợp lệ.")


def _to_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, Decimal):
        return int(value)
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _to_iso(value: Any) -> str:
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=UTC)
        return dt.isoformat()
    return str(value or "")


def _serialize_product(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _to_int(row.get("id")),
        "name": str(row.get("name") or ""),
        "slug": str(row.get("slug") or ""),
        "description": str(row.get("description") or ""),
        "price": _to_int(row.get("price")),
        "original_price": _to_int(row.get("original_price"))
        if row.get("original_price") is not None
        else None,
        "stock": _to_int(row.get("stock")),
        "image_url": str(row.get("image_url") or ""),
        "category": str(row.get("category_name") or "") or None,
        "is_featured": bool(row.get("is_featured")),
        "is_active": bool(row.get("is_active")),
    }


def _serialize_order(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _to_int(row.get("id")),
        "status": str(row.get("status") or "pending"),
        "customer_name": str(row.get("receiver_name") or ""),
        "customer_phone": str(row.get("receiver_phone") or ""),
        "customer_address": str(row.get("receiver_address") or ""),
        "note": str(row.get("note") or ""),
        "payment_method": str(row.get("payment_method") or ""),
        "total_amount": _to_int(row.get("total_amount")),
        "created_at": _to_iso(row.get("created_at")),
        "updated_at": _to_iso(row.get("updated_at")),
    }


@app.get("/", response_class=HTMLResponse)
async def storefront() -> str:
    auth_note = (
        f"Bearer <code>{DEMO_TOKEN}</code>"
        if DEMO_TOKEN
        else "<em>auth đã tắt (DA_MUOI_TOKEN rỗng)</em>"
    )
    return f"""
<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Da Muoi Shop · Mock REST</title>
  <style>
    body {{ font-family: Inter, system-ui, sans-serif; max-width: 820px; margin: 30px auto; padding: 0 16px; background:#f8fafc; color:#0f172a; }}
    h1 {{ margin: 0 0 4px; }}
    code {{ background:#e2e8f0; border-radius:6px; padding:2px 6px; }}
    table {{ border-collapse: collapse; margin-top: 12px; width: 100%; background: white; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; }}
    th, td {{ text-align:left; padding:10px 12px; border-bottom:1px solid #e2e8f0; font-size:14px; }}
    th {{ background:#f1f5f9; }}
  </style>
</head>
<body>
  <h1>Mock REST shop · da_muoi_db</h1>
  <p>MySQL: <code>{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}</code> · auth: {auth_note}</p>
  <p>Mở <a href="/docs">Swagger UI</a> hoặc <a href="/redoc">ReDoc</a> để test trực tiếp.</p>
  <table>
    <tr><th>Method</th><th>Path</th><th>Mô tả</th></tr>
    <tr><td>GET</td><td><code>/products</code></td><td>List sản phẩm (`page`, `limit`, `q`)</td></tr>
    <tr><td>GET</td><td><code>/products/{{id}}</code></td><td>Chi tiết 1 sản phẩm</td></tr>
    <tr><td>POST</td><td><code>/orders</code></td><td>Tạo đơn hàng (body `{{ "payload": {{...}} }}`)</td></tr>
    <tr><td>GET</td><td><code>/orders</code></td><td>Lịch sử đơn theo `phone` / `order_id`</td></tr>
    <tr><td>GET</td><td><code>/orders/{{order_id}}</code></td><td>Chi tiết đơn + items</td></tr>
    <tr><td>GET</td><td><code>/health</code></td><td>Healthcheck</td></tr>
  </table>
</body>
</html>
"""


@app.get("/health")
async def health() -> dict[str, Any]:
    try:
        async with app.state.db_pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT 1")
                await cur.fetchone()
        return {"status": "ok", "db": "ok"}
    except Exception as exc:
        return {"status": "degraded", "db_error": str(exc)}


@app.get("/products")
async def list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    q: str | None = Query(default=None),
    only_active: bool = Query(default=True),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_auth(authorization)
    offset = (page - 1) * limit
    conditions: list[str] = []
    params: list[Any] = []
    if only_active:
        conditions.append("p.is_active = 1")
    if q:
        conditions.append("(p.name LIKE %s OR p.description LIKE %s)")
        like = f"%{q.strip()}%"
        params.extend([like, like])
    where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    list_sql = f"""
        SELECT
            p.id, p.name, p.slug, p.description, p.price, p.original_price,
            p.stock, p.image_url, p.is_featured, p.is_active, p.category_id,
            c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        {where_sql}
        ORDER BY p.is_featured DESC, p.id ASC
        LIMIT %s OFFSET %s
    """
    count_sql = f"SELECT COUNT(*) AS total FROM products p {where_sql}"

    list_params = (*params, limit, offset)
    count_params = tuple(params)
    try:
        async with app.state.db_pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(list_sql, list_params)
                rows = await cur.fetchall()
                await cur.execute(count_sql, count_params)
                total_row = await cur.fetchone()
    except Exception as exc:
        logger.exception("list_products failed")
        raise HTTPException(status_code=500, detail=f"MySQL list_products failed: {exc}")
    items = [_serialize_product(r) for r in rows]
    total = _to_int((total_row or {}).get("total"))
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "data": items,
    }


@app.get("/products/{product_id}")
async def get_product(
    product_id: int = Path(..., gt=0),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_auth(authorization)
    sql = """
        SELECT
            p.id, p.name, p.slug, p.description, p.price, p.original_price,
            p.stock, p.image_url, p.is_featured, p.is_active, p.category_id,
            c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = %s
        LIMIT 1
    """
    try:
        async with app.state.db_pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(sql, (product_id,))
                row = await cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm.")
                await cur.execute(
                    "SELECT image_url FROM product_images WHERE product_id = %s",
                    (product_id,),
                )
                imgs = await cur.fetchall()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("get_product failed")
        raise HTTPException(status_code=500, detail=f"MySQL get_product failed: {exc}")
    detail = _serialize_product(row)
    detail["images"] = [str(i.get("image_url") or "") for i in imgs if i.get("image_url")]
    return detail


async def _fetch_unit_price(conn: aiomysql.Connection, product_id: int) -> int:
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            "SELECT price, stock FROM products WHERE id = %s LIMIT 1", (product_id,)
        )
        row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=400, detail=f"product_id={product_id} không tồn tại.")
    return _to_int(row.get("price"))


@app.post("/orders", status_code=201)
async def create_order(
    body: CreateOrderBody,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_auth(authorization)
    payload = body.payload
    if not payload.items:
        raise HTTPException(status_code=400, detail="items không được để trống.")
    payment_method = (payload.payment_method or "cod").strip().lower()
    if payment_method not in ALLOWED_PAYMENT:
        raise HTTPException(
            status_code=400,
            detail=f"payment_method '{payment_method}' không hợp lệ. Cho phép: {sorted(ALLOWED_PAYMENT)}",
        )
    now = datetime.now(UTC).replace(tzinfo=None)

    try:
        async with app.state.db_pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                insert_order_sql = """
                    INSERT INTO orders (
                        user_id, receiver_name, receiver_phone, receiver_address,
                        note, payment_method, status, total_amount,
                        created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                await cur.execute(
                    insert_order_sql,
                    (
                        None,
                        payload.customer_name.strip(),
                        payload.customer_phone.strip(),
                        payload.customer_address.strip(),
                        payload.note,
                        payment_method,
                        "pending",
                        0,
                        now,
                        now,
                    ),
                )
                order_id = int(cur.lastrowid)

                total_amount = 0
                for item in payload.items:
                    unit_price = (
                        _to_int(item.price)
                        if item.price is not None
                        else await _fetch_unit_price(conn, item.product_id)
                    )
                    qty = int(item.qty)
                    line_subtotal = unit_price * qty
                    total_amount += line_subtotal
                    await cur.execute(
                        """
                        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (order_id, item.product_id, qty, unit_price, line_subtotal),
                    )

                await cur.execute(
                    "UPDATE orders SET total_amount = %s, updated_at = %s WHERE id = %s",
                    (total_amount, now, order_id),
                )
            await conn.commit()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("create_order failed")
        raise HTTPException(status_code=500, detail=f"MySQL create_order failed: {exc}")

    return {
        "id": order_id,
        "status": "pending",
        "total_amount": total_amount,
        "subtotal": total_amount,
        "message": "Đơn hàng demo (da_muoi_db) đã được tạo thành công.",
    }


@app.get("/orders")
async def list_orders(
    phone: str | None = Query(default=None),
    order_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(20, ge=1, le=100),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_auth(authorization)
    conditions: list[str] = []
    params: list[Any] = []
    if order_id and order_id.strip().isdigit():
        conditions.append("id = %s")
        params.append(int(order_id.strip()))
    if phone:
        conditions.append("receiver_phone = %s")
        params.append(phone.strip())
    if status and status.strip().lower() in ALLOWED_STATUS:
        conditions.append("status = %s")
        params.append(status.strip().lower())
    where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    sql = f"""
        SELECT id, user_id, receiver_name, receiver_phone, receiver_address,
               note, payment_method, status, total_amount, created_at, updated_at
        FROM orders
        {where_sql}
        ORDER BY created_at DESC
        LIMIT %s
    """
    try:
        async with app.state.db_pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(sql, (*params, limit))
                rows = await cur.fetchall()
    except Exception as exc:
        logger.exception("list_orders failed")
        raise HTTPException(status_code=500, detail=f"MySQL list_orders failed: {exc}")
    items = [_serialize_order(r) for r in rows]
    return {"items": items, "total": len(items), "data": items}


@app.get("/orders/{order_id}")
async def get_order_detail(
    order_id: int = Path(..., gt=0),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_auth(authorization)
    try:
        async with app.state.db_pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    """
                    SELECT id, user_id, receiver_name, receiver_phone, receiver_address,
                           note, payment_method, status, total_amount, created_at, updated_at
                    FROM orders WHERE id = %s LIMIT 1
                    """,
                    (order_id,),
                )
                order = await cur.fetchone()
                if not order:
                    raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng.")
                await cur.execute(
                    """
                    SELECT oi.product_id, oi.quantity, oi.unit_price, oi.subtotal,
                           p.name AS product_name, p.image_url AS product_image
                    FROM order_items oi
                    LEFT JOIN products p ON p.id = oi.product_id
                    WHERE oi.order_id = %s
                    ORDER BY oi.id ASC
                    """,
                    (order_id,),
                )
                items_rows = await cur.fetchall()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("get_order_detail failed")
        raise HTTPException(status_code=500, detail=f"MySQL get_order_detail failed: {exc}")

    payload = _serialize_order(order)
    payload["items"] = [
        {
            "product_id": _to_int(r.get("product_id")),
            "product_name": str(r.get("product_name") or ""),
            "product_image": str(r.get("product_image") or ""),
            "qty": _to_int(r.get("quantity")),
            "quantity": _to_int(r.get("quantity")),
            "price": _to_int(r.get("unit_price")),
            "unit_price": _to_int(r.get("unit_price")),
            "line_total": _to_int(r.get("subtotal")),
            "subtotal": _to_int(r.get("subtotal")),
        }
        for r in items_rows
    ]
    return payload


if __name__ == "__main__":
    uvicorn.run(
        "scripts.mock_da_muoi_shop:app"
        if __package__
        else app,
        host="0.0.0.0",
        port=SERVER_PORT,
        reload=False,
    )
