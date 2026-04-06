# TASK-03: Billing, Plan Enforcement & PayOS

## 1. Bối cảnh (đã có trong code)
- Giới hạn theo gói được định nghĩa trong `core/plan_limits.py` và cột `tenants.plan` (chuỗi: `starter`, `pro`, `enterprise`, `enterprise_pro`) — **không** dùng `plan_id`.
- **Đã thực thi:**
  - Upload RAG: số tài liệu tối đa + tổng dung lượng (`api/v1/files.py`).
  - Chat widget: hạn mức tin nhắn AI theo tháng/ngày (`api/v1/plan_enforcement.py` + `chat_quota_exceeded`).

## 2. Phần đã triển khai (PayOS)
- SDK **`payos`** (Python): tạo link thanh toán + xác thực webhook theo tài liệu PayOS.
- Biến môi trường: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PAYOS_CHECKOUT_RETURN_URL`, `PAYOS_CHECKOUT_CANCEL_URL`, mức giá VND (`PAYOS_AMOUNT_*`) — xem `apps/api/.env.example`.
- **POST `/api/v1/admin/billing/payos/checkout`**: Bearer tenant — tạo `payos_payment_intents`, gọi API PayOS, trả `checkout_url`.
- **POST `/api/v1/webhooks/payos`**: không Bearer; verify signature → cập nhật `tenants.plan` (khớp `order_code` + số tiền).
- **GET `/api/v1/admin/billing/payos/config`**: `{ payos_enabled }` cho dashboard.
- Migration: bảng `payos_payment_intents` (`db/alembic/versions/d1e2f3a4b5c6_...`).
- Dashboard **Billing**: khi `payos_enabled`, nút **Thanh toán PayOS** cho các gói trả phí (map `basic`→`pro`, `enterprise`, `enterprise_pro`); query `?payos=success` hiển thị thông báo.

## 3. Việc cần làm trên PayOS (my.payos.vn)
- Tạo kênh thanh toán, lấy Client ID / API Key / Checksum Key.
- Cấu hình **Webhook URL** công khai: `https://<API-domain>/api/v1/webhooks/payos`.
- (Tuỳ chọn) Dùng API PayOS **confirm webhook** để đăng ký URL — SDK có `client.webhooks.confirm(...)`.

## 4. Định nghĩa hoàn thành (DoD)
- [x] Không upload vượt giới hạn số tài liệu / dung lượng theo gói (đã có).
- [x] Không chat widget vượt hạn mức tin nhắn theo gói (đã có).
- [x] Webhook PayOS + cập nhật `tenants.plan` (code + migration + test cơ bản).
- [x] Dashboard: nút thanh toán khi PayOS bật; thông báo khi `?payos=success`; usage vẫn từ `billing/summary`.
