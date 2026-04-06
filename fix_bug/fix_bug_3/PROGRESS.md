# PROGRESS.md — Lộ trình hoàn thiện dự án (fix_bug_3)

> Cập nhật: 2026-04-06 | Mục tiêu: Production Ready (Sẵn sàng triển khai)
> Trạng thái hiện tại: ~85–90% tính năng lõi; một số hạng mục đã có trong code, cần đồng bộ tài liệu và hoàn thiện phần còn lại.

---

## Tổng quan tiến độ fix_bug_3

| Task ID | Tên Task | Trạng thái | Ưu tiên | Ghi chú ngắn |
|---------|----------|------------|---------|----------------|
| TASK-01 | SQL Agent Integration & Guarding | Hoàn thành | Cao | Guard orchestrator + `tenant_databases`; prompt dialect/schema phức tạp; log pipeline `run_text_to_sql`; test mock — `task_01_sql_integration.md` |
| TASK-02 | Production Hardening & SSL | Một phần (code/repo) | Cao | Nginx: header + rate limit IP `/api/`, snippets SSL/HSTS, `server_tokens off`; env dev/prod example; runbook Certbot. **Còn:** bật HTTPS trên server thật + audit điểm A |
| TASK-03 | Billing & PayOS | Hoàn thành (cấu hình PayOS trên my.payos.vn) | Trung bình | Checkout + webhook `/api/v1/webhooks/payos`, bảng `payos_payment_intents`, dashboard Billing — cần bật biến môi trường + webhook công khai |
| TASK-04 | Analytics & Usage Dashboard | Todo | Trung bình | `chat_analytics` có model; cần API `admin/analytics/*` + biểu đồ Dashboard |
| TASK-05 | Platform Admin Dashboard | Một phần | Thấp | Schema dùng `tenants.role = 'platform_admin'` (không dùng flag `is_platform_admin`). Còn router/UI/impersonate |
| TASK-06 | E-commerce / Ordering | Todo (epic tùy chọn) | Tùy sản phẩm | **Không** mặc định ưu tiên cao cho mọi tenant. Xem [task_06_ecommerce_ordering.md](task_06_ecommerce_ordering.md) — mâu thuẫn với Text-to-SQL chỉ SELECT trong AGENTS.md nếu mở INSERT tự do |

---

## Chi tiết các hạng mục

### 1. AI Engine & SQL (TASK-01, 06)
- [x] Kiểm tra DB config trước khi coi SQL khả dụng trong Orchestrator (kết hợp plan + `is_sql_enabled` + bản ghi `tenant_databases` active).
- [x] Prompt Text-to-SQL: dialect PostgreSQL/MySQL từ schema inspect, mục hướng dẫn JOIN/FK/aggregate; few-shot động từ `few_shot_examples.json` (có thể bổ sung ví dụ theo tenant sau).
- [ ] **(TASK-06, tùy chọn):** Luồng đặt hàng an toàn — không mở Text-to-SQL sang INSERT tùy ý; xem task_06.

### 2. Infrastructure & Security (TASK-02)
- [ ] SSL Let's Encrypt trên máy chủ production (theo [docs/PRODUCTION_RUNBOOK.md](../../docs/PRODUCTION_RUNBOOK.md)).
- [x] Rate limiting API (Redis + tenant key) và Nginx `limit_req` theo IP cho `/api/`.
- [x] Header bảo mật Nginx + snippet HSTS cho HTTPS; tách file env dev/prod example.

### 3. Business & Dashboard (TASK-03, 04, 05)
- [x] PayOS webhook + tạo link thanh toán → cập nhật `tenants.plan`.
- [ ] Biểu đồ tin nhắn / usage trên Dashboard.
- [ ] Platform admin: API + UI (dựa trên `role = platform_admin`).

---

## Nhật ký thay đổi
- **2026-04-06**: Khởi tạo giai đoạn `fix_bug_3` để xử lý các hạng mục cuối cùng trước khi release.
- **2026-04-06**: Đồng bộ PROGRESS với code hiện tại (plan limits, rate limit, schema `plan` / `role`); TASK-06 ghi nhận là epic tùy chọn.
- **2026-04-06**: TASK-01 hoàn thành — guard DB, prompt dialect + schema phức tạp, logging pipeline, test `test_task01_sql_pipeline.py` / `test_sql_generator_dialect.py`.
- **2026-04-06**: TASK-02 (repo) — Nginx header + rate limit IP, snippets SSL, env example dev/prod, runbook Certbot.
- **2026-04-06**: TASK-03 — PayOS SDK, migration `payos_payment_intents`, webhook + checkout API, dashboard Billing.
