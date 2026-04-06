# Task — Gói dịch vụ & trang Billing (theo `gói.txt`)

> Ngày tạo: 2026-04-03  
> Trạng thái: **đã triển khai backend + enforcement cốt lõi** (2026-04-03)

## Định nghĩa gói (marketing — đồng bộ UI)

| Gói | `plan` UI (slug) | `tenants.plan` (DB) |
|-----|------------------|---------------------|
| Miễn phí | `free` | `starter` |
| Cơ bản | `basic` | `pro` |
| Doanh nghiệp | `enterprise` | `enterprise` |
| Doanh nghiệp Pro | `enterprise_pro` | `enterprise_pro` (**nâng cấp** từ Doanh nghiệp — kế thừa toàn bộ tính năng gói 3) |

## Checklist triển khai

### UI (dashboard)

- [x] Trang `apps/web/.../dashboard/billing/page.tsx`: 4 thẻ gói + bullet theo spec `gói.txt`.
- [x] Nút **Liên hệ** cho gói Doanh nghiệp / Doanh nghiệp Pro (mailto) và khối CTA “Không có gói phù hợp”.
- [x] Giữ đồng bộ usage từ `GET /api/v1/admin/billing/summary`.
- [x] `NEXT_PUBLIC_SALES_EMAIL` (ưu tiên trên Billing, fallback `NEXT_PUBLIC_SUPPORT_EMAIL`) — `.env.example`.

### Backend & sản phẩm

- [x] Migration `a1b2c3d4e5f6_add_enterprise_pro_plan.py`: CHECK `enterprise_pro` + model `Tenant`.
- [x] `GET /billing/summary`: hạn mức theo gói — tin nhắn user theo **tháng** (starter 50) / **ngày** (pro 400); RAG theo byte + `document_limit`; SQL `max_sql_connections`.
- [x] Upload RAG: chặn vượt số file / dung lượng (`api/v1/files.py`).
- [x] Chat widget: 429 khi vượt quota; POST `/chat` lưu `ChatMessage` (đồng bộ với thống kê).
- [x] Text-to-SQL: gói không SQL (`starter`) — chặn lưu/test DB admin + `orchestrator` tắt SQL theo gói (dù AI bật flag).
- [ ] TTS, multi-widget, bán hàng trên chat, orchestration nâng cao — **chưa có trong codebase** (placeholder sản phẩm).
- [x] Cổng thanh toán **PayOS** (link + webhook) — xem [fix_bug/fix_bug_3/task_03_billing_enforcement.md](../fix_bug/fix_bug_3/task_03_billing_enforcement.md).

### Code tham chiếu

- `apps/api/core/plan_limits.py` — bảng hạn mức.
- `apps/api/api/v1/plan_enforcement.py` — kiểm tra quota chat.
- `apps/api/tests/test_plan_limits.py` — unit tests.

## Tham chiếu copy gốc

- File người dùng: `gói.txt` (Free → Doanh nghiệp Pro + CTA liên hệ).
