# PROGRESS.md — Tiến độ Migration Database v2

> Cập nhật lần cuối: 2026-04-03
> Mục tiêu: Ổn định hệ thống theo hướng PostgreSQL + Qdrant (rollback từ pgvector)

---

## Tổng quan

**Kiến trúc hạ tầng dữ liệu đã chốt:**

- PostgreSQL: relational data
- Redis: cache / rate-limit / Celery broker
- Qdrant: vector search cho RAG ingest/retrieval

| Phase | Tên                      | Trạng thái      | File Task               |
| ----- | ------------------------ | --------------- | ----------------------- |
| 1     | Database Models & Schema | ✅ Hoàn thành   | `tasks/task_phase_1.md` |
| 2     | Alembic Migration        | ✅ Hoàn thành   | `tasks/task_phase_2.md` |
| 3     | Backend API Refactor     | ✅ Hoàn thành   | `tasks/task_phase_3.md` |
| 4     | Frontend Integration     | ✅ Hoàn thành   | `tasks/task_phase_4.md` |
| 5     | Testing & Verification   | ✅ Hoàn thành   | `tasks/task_phase_5.md` |
| 6     | Dashboard & Product gaps | ✅ Hoàn thành   | `tasks/task_phase_6.md` |
| 7     | Billing/Commercial       | 🔄 Đang làm     | `tasks/task_billing_commercial.md` |

**Legend:** ⬜ Chưa bắt đầu | 🔄 Đang làm | ✅ Hoàn thành | ❌ Lỗi

---

## Phase 1 — Database Models & Schema

> **Mục tiêu:** Viết lại toàn bộ SQLAlchemy models theo kiến trúc v2.

**Deliverables:**

- `models/base.py` — Base class
- `models/tenant.py` — Tenant tinh gọn (chỉ account info + plan)
- `models/widget_config.py` — TenantWidgetConfig
- `models/ai_settings.py` — TenantAiSettings
- `models/tenant_key.py` — TenantKey (multi-key support)
- `models/allowed_origin.py` — TenantAllowedOrigin
- `models/document.py` — TenantDocument (gộp tenant_files)
- `models/chat.py` — ChatSession, ChatMessage, ChatAnalytics
- `models/__init__.py` — Export tất cả

**Xóa:**

- `models/tenant_file.py` ← merged vào document.py

---

## Phase 2 — Alembic Migration

> **Mục tiêu:** Ổn định schema theo runtime hiện tại, tránh reset dữ liệu không cần thiết.

**Chiến lược:** Migration tối thiểu, không ép reset toàn bộ DB ở đợt rollback Qdrant.

**Deliverables đã hoàn thành:**

- Migration stabilization: `1ca289585fb8_v2_schema_stabilization.py`
- Migration autogenerate review (an toàn/no-op): `e99a6b0ac34c_v2_create_new_schema.py`
- `alembic upgrade head` thành công, current tại `e99a6b0ac34c`
- Bảng lõi v2 đã có đầy đủ trên PostgreSQL
- Index `tenant_keys.key_value` đã được tạo
- `db/schema.sql` đã cập nhật theo schema v2 runtime PostgreSQL + Qdrant

---

## Phase 3 — Backend API Refactor

> **Mục tiêu:** Cập nhật tất cả endpoints để dùng models mới.

### Middleware

- `api/middleware.py` → Validate `public_key` qua bảng `tenant_keys`

### Admin Router (`api/v1/admin.py`)

- `POST /register` → Tạo tenant + widget_config + ai_settings + 1 cặp key mặc định
- `POST /login` → Không đổi
- `GET /me` → Join với widget_config và ai_settings
- `PATCH /widget` → Cập nhật TenantWidgetConfig
- `PATCH /ai-settings` → Cập nhật TenantAiSettings
- `GET /keys` → Danh sách TenantKey
- `POST /keys` → Tạo key mới (public hoặc admin)
- `DELETE /keys/{id}` → Xóa/thu hồi key
- `GET /origins` → Danh sách origins
- `POST /origins` → Thêm origin
- `DELETE /origins/{id}` → Xóa origin
- `GET /database` → Không đổi
- `POST /database` → Không đổi
- `POST /database/test` → Không đổi
- `GET /billing/summary` → Cập nhật query

### Chat Router (`api/v1/chat.py`)

- `GET /config` → Đọc từ TenantWidgetConfig
- `POST /stream` → Lưu ChatSession + ChatMessage

---

## Phase 4 — Frontend Integration

> **Mục tiêu:** Kết nối Frontend với API thật.

### Settings Page (`dashboard/settings/page.tsx`)

- **Hiện trạng:** Lưu/tải qua `GET` + `PATCH /api/v1/admin/me` (cập nhật gộp tenant + widget + AI). Vẫn có thể tách riêng `PATCH /widget` + `PATCH /ai-settings` nếu cần tối ưu partial update — không bắt buộc.
- Section cấu hình AI (system prompt, RAG/SQL) đã nằm trong cùng trang Settings.

### Keys Page (`dashboard/keys/page.tsx`)

- Thay mock data bằng `GET /api/v1/admin/keys`
- Implement tạo key: `POST /api/v1/admin/keys`
- Implement xóa key: `DELETE /api/v1/admin/keys/{id}`

### AuthContext (`context/AuthContext.tsx`)

- Cập nhật type `Tenant` theo schema mới

---

## Phase 5 — Testing & Verification

> **Mục tiêu:** Đảm bảo hệ thống hoạt động end-to-end.

**Test cases:**

- [x] Register → kiểm tra 4 bảng được tạo (tenants, widget_configs, ai_settings, tenant_keys) (2026-04-03)
- [x] Login → JWT token hợp lệ (2026-04-03)
- [x] GET /me → trả về đầy đủ thông tin từ joins (2026-04-03)
- [x] Widget config API → đọc từ TenantWidgetConfig (2026-04-03)
- [x] CRUD Keys → tạo/xóa key hoạt động (2026-04-03)
- [x] Upload document → hoạt động end-to-end (2026-04-02)
- [x] RAG retrieval/storage chạy trên Qdrant (2026-04-02)
- [x] Stream chat → vẫn hoạt động (2026-04-03)
- [x] Frontend Settings → save/load đúng dữ liệu (2026-04-03)
- [x] Frontend Keys → hiện danh sách thật (2026-04-03)

---

## Phase 6 — Dashboard & Product gaps

> **Mục tiêu:** Các trang/menu dashboard phản ánh đúng tính năng production: không link chết, quản trị origins (CORS widget), chuẩn hóa gọi API frontend, và làm rõ billing (hoặc ẩn/ghi chú cho đến khi tích hợp thanh toán).

**Phạm vi (chi tiết trong `tasks/task_phase_6.md`):**

- Trang **Hỗ trợ** (`/dashboard/support`) đã có page + contact mail.
- Trang **Allowed origins** đã có UI CRUD và mục sidebar.
- **Billing** đã sync usage thật; upgrade/payment ở trạng thái roadmap tiếp theo.
- **Knowledge Base** đã chuyển sang `useApi` + upload `FormData`.
- **Sidebar** đã bind nhãn gói từ `tenant.plan`.
- **Database page**: FAB đã gắn hành vi cuộn tới form kết nối.

**Trạng thái:** ✅ Hoàn thành (2026-04-03): trang Domain/CORS, Hỗ trợ, `useApi` + upload FormData, Billing trung thực, sidebar theo `plan`, FAB database cuộn về form.

---

## Phase 7 — Billing & Commercial Expansion

> **Mục tiêu:** Hoàn thiện lớp thương mại của sản phẩm: tự động hóa vòng đời thanh toán/subscription và mở rộng feature thương mại theo gói.

**Deliverables bắt buộc (chi tiết trong `tasks/task_billing_commercial.md`):**

- Billing automation đầy đủ: checkout → webhook xác thực/idempotent → cập nhật plan → audit trail.
- Subscription lifecycle tối thiểu: upgrade/downgrade/cancel + đồng bộ hạn mức theo plan.
- Khung commercial features theo roadmap: TTS, multi-widget, bán hàng trên chat, orchestration nâng cao.
- Tối thiểu hóa chênh lệch vận hành billing: runbook đối soát trạng thái thanh toán và cảnh báo lỗi webhook.

**Checklist hoàn tất phase:**

- [ ] Có task file triển khai chi tiết được duy trì: `tasks/task_billing_commercial.md`.
- [ ] Luồng billing automation có test regression backend và chạy trong CI.
- [ ] Có quy trình đối soát billing (reconciliation) và hướng dẫn xử lý mismatch.
- [ ] Các commercial features được tách rõ theo milestone (MVP/Phase sau), không mơ hồ phạm vi.

---

## Rủi ro & Lưu ý

| Rủi ro                                                  | Mức độ     | Xử lý                                                       |
| ------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| Sai lệch dữ liệu vector sau rollback pgvector -> Qdrant | Cao        | Re-index từ file gốc + regression test upload/search/delete |
| Break SQL agent (dùng TenantDatabaseConfig)             | Cao        | Giữ nguyên interface TenantDatabaseConfig                   |
| Break Widget SDK (dùng public_key)                      | Trung bình | Cập nhật middleware lookup                                  |
| Break Celery tasks                                      | Trung bình | Kiểm tra import models                                      |
| Billing state mismatch giữa webhook và tenant plan      | Cao        | Bắt buộc idempotency + đối soát định kỳ                    |
| Retry webhook gây cập nhật trùng / lệch trạng thái      | Cao        | Lưu trạng thái intent + chặn commit trùng theo order code  |
| Quota drift sau đổi plan                                | Trung bình | Recompute usage/limits sau mỗi sự kiện billing             |

---

## Định nghĩa gói dịch vụ (Billing UI + backend)

> 2026-04-03: Trang **Billing** + `core/plan_limits.py`: hạn mức **50 tin user/tháng** (starter), **400/ngày** (pro), RAG theo byte + tối đa **2 tài liệu** (starter), SQL theo gói, `enterprise_pro` trong CHECK constraint. Enforcement: upload files, chat (429), admin DB save/test, orchestrator tắt SQL nếu gói không hỗ trợ. Chi tiết: **`tasks/task_billing_plans.md`**.

---

## Ghi chú đồng bộ tiến độ (2026-04-03)

- **Phase 6** được thêm để theo dõi hạng mục dashboard còn thiếu (support 404, origins UI, billing placeholder, `useApi` cho files). Checklist: `tasks/task_phase_6.md`, sprint hiện tại: `task.md`.
- Phase 4–5 đánh dấu hoàn thành theo checklist `tasks/task_phase_5.md` và regression dashboard/widget/RAG/stream; trang **Database** đã nối API và có kiểm thử tích hợp `tests/test_admin_database_integration.py` (load/test/lưu + introspection schema Text-to-SQL).
- CI backend: thêm service **Qdrant**, bước **Alembic upgrade head** trước pytest; smoke cục bộ: `apps/api/scripts/run_smoke_integration.py`.
- Production: header bảo mật tối thiểu khi `ENV=production` và runbook `docs/PRODUCTION_RUNBOOK.md`.

## Ghi chú Cleanup Legacy (2026-04-03)

- Đã thêm migration cleanup: `f2a4d1c7b9e0_cleanup_legacy_tenants_columns.py` để loại bỏ cột/index legacy khỏi bảng `tenants`.
- Đã gỡ lớp tương thích tạm trong model `Tenant` (không còn mapping `slug/public_key/secret_key/allowed_origins/widget_* cũ/system_prompt/is_*`).
- Register flow và scripts seed backend đã chuyển hoàn toàn sang schema v2 (`tenant_keys`, `tenant_allowed_origins`, `tenant_widget_configs`, `tenant_ai_settings`).
