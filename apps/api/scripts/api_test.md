# API test cho Dashboard `widget-sales` (REST generic)

Tài liệu này dùng để lấy dữ liệu test cho trang `dashboard/widget-sales` phần **REST generic**, dựa trên:

- `apps/api/scripts/mock_da_muoi_shop.py`
- `apps/api/scripts/da_muoi_db.sql`

---

## 1) Chuẩn bị dữ liệu và mock server

### Import DB MySQL

- Tạo database `da_muoi_db`.
- Import file:

```bash
mysql -u root -p da_muoi_db < apps/api/scripts/da_muoi_db.sql
```

### Chạy mock API

Từ thư mục gốc project:

```bash
apps/api/.venv/Scripts/python.exe apps/api/scripts/mock_da_muoi_shop.py
```

Mặc định server chạy tại: `http://localhost:8090`

### Biến môi trường (tuỳ chọn)

```bash
DA_MUOI_MYSQL_HOST=localhost
DA_MUOI_MYSQL_PORT=3306
DA_MUOI_MYSQL_DB=da_muoi_db
DA_MUOI_MYSQL_USER=root
DA_MUOI_MYSQL_PASSWORD=
DA_MUOI_PORT=8090
DA_MUOI_TOKEN=demo-da-muoi-token
```

> Nếu `DA_MUOI_TOKEN` rỗng thì mock API tắt auth.

---

## 2) Cấu hình điền trực tiếp trên trang `dashboard/widget-sales`

Trong card **Cấu hình chung**:

- `Nền tảng`: `REST Generic`
- `Base URL API`: `http://localhost:8090`
- `Loại Auth`: `Bearer Token`
- `Token / API Key`: `demo-da-muoi-token`

Trong card **Danh sách API Endpoints**, điền đúng 3 API bắt buộc:

## 2.1 Mẫu copy/paste đúng theo popup "Chỉnh sửa API"

> Dán đúng chuỗi bên dưới vào các ô `Mã API`, `Tên hiển thị`, `Method`, `Endpoint Path`, `Tham số`, `Body Template`.
> 
> Lưu ý quan trọng: placeholder phải dùng dấu gạch dưới, ví dụ `{customer_name}` (không dùng `{customer name}`).

### API 1: `products`

- `Mã API (Code)`: `products`
- `Tên hiển thị`: `Products API`
- `Method`: `GET`
- `Endpoint Path`: `/products`
- `Trạng thái`: bật
- `Tham số (Query Params)`:
  - `page` = `{page}`
  - `limit` = `{limit}`
  - `q` = `{q}`
- `Body Template (JSON)`: để trống

Giá trị chuẩn (đúng với UI mặc định):

```txt
Mã API (Code): products
Tên hiển thị: Products API
Method: GET
Endpoint Path: /products
```

```json
{"page":"{page}","limit":"{limit}","q":"{q}"}
```

### API 2: `create_order`

- `Mã API (Code)`: `create_order`
- `Tên hiển thị`: `Create Order API`
- `Method`: `POST`
- `Endpoint Path`: `/orders`
- `Trạng thái`: bật
- `Tham số (Query Params)`: để trống
- `Body Template (JSON)`:

```json
{"payload":{"customer_name":"{customer_name}","customer_phone":"{customer_phone}","customer_address":"{customer_address}","customer_email":"{customer_email}","items":"{items}","note":"{note}","payment_method":"{payment_method}"}}
```

Giá trị chuẩn (đúng với UI mặc định):

```txt
Mã API (Code): create_order
Tên hiển thị: Create Order API
Method: POST
Endpoint Path: /orders
```

### API 3: `order_history`

- `Mã API (Code)`: `order_history`
- `Tên hiển thị`: `Order History API`
- `Method`: `GET`
- `Endpoint Path`: `/orders`
- `Trạng thái`: bật
- `Tham số (Query Params)`:
  - `phone` = `{customer_phone}`
  - `order_id` = `{external_order_id}`
- `Body Template (JSON)`: để trống

Giá trị chuẩn (đúng với UI mặc định):

```txt
Mã API (Code): order_history
Tên hiển thị: Order History API
Method: GET
Endpoint Path: /orders
```

```json
{"phone":"{customer_phone}","order_id":"{external_order_id}"}
```

Thao tác cuối:

1. Bấm `Test kết nối`.
2. Bấm test từng endpoint (nút play ở từng dòng).
3. Bấm `Lưu connector`.

## 2.2 JSON cấu hình tổng để đối chiếu nhanh

Khi lưu thành công, phần `config.endpoints` tương ứng sẽ tương đương:

```json
[
  {
    "code": "products",
    "label": "Products API",
    "method": "GET",
    "path": "/products",
    "path_template": "/products",
    "query_template": {"page":"{page}","limit":"{limit}","q":"{q}"},
    "body_template": null,
    "enabled": true
  },
  {
    "code": "create_order",
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
        "payment_method": "{payment_method}"
      }
    },
    "enabled": true
  },
  {
    "code": "order_history",
    "label": "Order History API",
    "method": "GET",
    "path": "/orders",
    "path_template": "/orders",
    "query_template": {"phone":"{customer_phone}","order_id":"{external_order_id}"},
    "body_template": null,
    "enabled": true
  }
]
```

> Trang này không có ô thêm custom headers; backend sẽ tự gắn auth header theo `auth_type` + `auth_value`.

Header thực tế khi gọi mock API:

```http
Authorization: Bearer demo-da-muoi-token
Content-Type: application/json
Accept: application/json
```

---

## 3) Endpoint chính để test

## Healthcheck

### GET `/health`

```bash
curl -X GET "http://localhost:8090/health"
```

Kỳ vọng:

```json
{
  "status": "ok",
  "db": "ok"
}
```

## Products

### GET `/products?page=1&limit=20`

```bash
curl -X GET "http://localhost:8090/products?page=1&limit=20" ^
  -H "Authorization: Bearer demo-da-muoi-token" ^
  -H "Accept: application/json"
```

Kỳ vọng response có format:

```json
{
  "items": [
    {
      "id": 1,
      "name": "Muoi Hong Himalaya",
      "slug": "muoi-hong-himalaya",
      "description": "...",
      "price": 120000,
      "original_price": 150000,
      "stock": 100,
      "image_url": "https://...",
      "category": "Muoi tam",
      "is_featured": true,
      "is_active": true
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "data": []
}
```

> Lưu ý: API trả cả `items` và `data` để dễ map theo từng UI.

### GET `/products?q=muoi&only_active=true&page=1&limit=10`

```bash
curl -X GET "http://localhost:8090/products?q=muoi&only_active=true&page=1&limit=10" ^
  -H "Authorization: Bearer demo-da-muoi-token"
```

### GET `/products/{id}`

```bash
curl -X GET "http://localhost:8090/products/1" ^
  -H "Authorization: Bearer demo-da-muoi-token"
```

Response detail có thêm `images`:

```json
{
  "id": 1,
  "name": "Muoi Hong Himalaya",
  "price": 120000,
  "images": ["https://.../1.jpg", "https://.../2.jpg"]
}
```

## Orders

### POST `/orders`

```bash
curl -X POST "http://localhost:8090/orders" ^
  -H "Authorization: Bearer demo-da-muoi-token" ^
  -H "Content-Type: application/json" ^
  -d "{
    \"payload\": {
      \"customer_name\": \"Nguyen Van A\",
      \"customer_phone\": \"0909123456\",
      \"customer_address\": \"123 Le Loi, Q1, TP.HCM\",
      \"customer_email\": \"a@example.com\",
      \"note\": \"Giao gio hanh chinh\",
      \"payment_method\": \"cod\",
      \"items\": [
        { \"product_id\": 1, \"qty\": 2 },
        { \"product_id\": 2, \"qty\": 1, \"price\": 99000 }
      ]
    }
  }"
```

Kỳ vọng:

```json
{
  "id": 101,
  "status": "pending",
  "total_amount": 339000,
  "subtotal": 339000,
  "message": "Don hang demo (da_muoi_db) da duoc tao thanh cong."
}
```

### GET `/orders?phone=0909123456&limit=20`

```bash
curl -X GET "http://localhost:8090/orders?phone=0909123456&limit=20" ^
  -H "Authorization: Bearer demo-da-muoi-token"
```

Kỳ vọng response list:

```json
{
  "items": [
    {
      "id": 101,
      "status": "pending",
      "customer_name": "Nguyen Van A",
      "customer_phone": "0909123456",
      "customer_address": "123 Le Loi, Q1, TP.HCM",
      "note": "Giao gio hanh chinh",
      "payment_method": "cod",
      "total_amount": 339000,
      "created_at": "2026-05-08T09:00:00+00:00",
      "updated_at": "2026-05-08T09:00:00+00:00"
    }
  ],
  "total": 1,
  "data": []
}
```

### GET `/orders/{order_id}`

```bash
curl -X GET "http://localhost:8090/orders/101" ^
  -H "Authorization: Bearer demo-da-muoi-token"
```

Kỳ vọng detail có `items`:

```json
{
  "id": 101,
  "status": "pending",
  "customer_name": "Nguyen Van A",
  "total_amount": 339000,
  "items": [
    {
      "product_id": 1,
      "product_name": "Muoi Hong Himalaya",
      "product_image": "https://...",
      "qty": 2,
      "quantity": 2,
      "price": 120000,
      "unit_price": 120000,
      "line_total": 240000,
      "subtotal": 240000
    }
  ]
}
```

---

## 4) Mapping gợi ý cho `widget-sales` (REST generic)

Nếu UI cần mapping thủ công trường dữ liệu:

- **Danh sách sản phẩm**: lấy từ `products.items` (fallback `products.data`)
- **Chi tiết sản phẩm**: lấy từ response `GET /products/{id}`
- **Tạo đơn**: dùng `POST /orders` với body wrapper `payload`
- **Lịch sử đơn**: lấy từ `orders.items` (filter qua `phone` hoặc `order_id`)
- **Chi tiết đơn**: lấy từ `GET /orders/{order_id}` và dùng `items[]` để render line items

---

## 5) Bộ test nhanh theo flow

1. `GET /health` -> DB và API OK.
2. `GET /products?page=1&limit=20` -> có data sản phẩm.
3. `POST /orders` -> tạo đơn mới thành công (nhận `id`).
4. `GET /orders?order_id={id}` -> đơn vừa tạo xuất hiện trong list.
5. `GET /orders/{id}` -> kiểm tra line item + tổng tiền.

---

## 6) Lỗi thường gặp

- `401 Unauthorized`: thiếu/sai `Authorization: Bearer demo-da-muoi-token`.
- `500 MySQL ... failed`: sai cấu hình MySQL hoặc DB chưa import.
- `400 items không được để trống`: body `POST /orders` thiếu `payload.items`.
- `400 payment_method ... không hợp lệ`: chỉ chấp nhận `cod` hoặc `bank_transfer`.

