# Task Phase 6 — Dashboard & Product gaps

> **Mục tiêu:** Hoàn thiện phần dashboard mà tenant cần để vận hành widget an toàn và nhất quán với backend, không còn link chết hoặc tính năng “giả” gây hiểu nhầm.  
> **Trạng thái:** ✅ Hoàn thành (2026-04-03)

---

## 6.1 — Allowed origins (bắt buộc cho CORS widget)

- [x] Thêm route UI: `/dashboard/origins`.
- [x] `GET /api/v1/admin/origins` — bảng origin, note, created_at.
- [x] `POST /api/v1/admin/origins` — form thêm (chuẩn hóa do backend).
- [x] `DELETE /api/v1/admin/origins/{id}` — xác nhận trước khi xóa.
- [x] Mọi request dùng `useApi` + Bearer.
- [x] `Sidebar.tsx`: mục "Domain cho widget".

---

## 6.2 — Trang Hỗ trợ (sửa link 404)

- [x] `dashboard/support/page.tsx` — hướng dẫn + mailto + biến `NEXT_PUBLIC_SUPPORT_EMAIL`.

---

## 6.3 — Knowledge Base — chuẩn hóa `useApi`

- [x] `useApi`: `postFormData`, không gắn `Content-Type` cho `FormData`.
- [x] `knowledge-base/page.tsx`: list/upload/delete qua `useApi`.

---

## 6.4 — Billing — trung thực với dữ liệu

- [x] Usage/plan: `GET /api/v1/admin/billing/summary`.
- [x] Không hàng invoice demo; empty state có giải thích.
- [x] Nút nâng cấp / thêm thẻ: disabled + `title` giải thích.

---

## 6.5 — Sidebar & polish

- [x] Badge gói từ `tenant.plan` (nhãn Starter / Pro / Enterprise).
- [x] `database/page.tsx`: FAB → cuộn tới form kết nối (`vertical_align_top`).

---

## 6.6 — Kiểm thử & tài liệu

- [x] Link sidebar: `/dashboard/support`, `/dashboard/origins` không 404.
- [x] `PROGRESS.md`: Phase 6 ✅.
- [ ] (Tùy chọn) E2E Playwright cho origins/support — khi có harness.

---

## Ghi chú phạm vi ngoài Phase 6

- Tích hợp **PayOS** (thanh toán / subscription thật) — Phase sau; chi tiết [task_03_billing_enforcement.md](../fix_bug/fix_bug_3/task_03_billing_enforcement.md).
- **PATCH /widget** tách khỏi **PATCH /me** — tùy chọn.
