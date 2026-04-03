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
| 4     | Frontend Integration     | ⬜ Chưa bắt đầu | `tasks/task_phase_4.md` |
| 5     | Testing & Verification   | 🔄 Đang làm     | `tasks/task_phase_5.md` |

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

- Tách `PATCH /me` → `PATCH /widget` + `PATCH /ai-settings`
- Thêm section cấu hình AI riêng biệt

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

- [ ] Register → kiểm tra 4 bảng được tạo (tenants, widget_configs, ai_settings, tenant_keys)
- [ ] Login → JWT token hợp lệ
- [ ] GET /me → trả về đầy đủ thông tin từ joins
- [ ] Widget config API → đọc từ TenantWidgetConfig
- [ ] CRUD Keys → tạo/xóa key hoạt động
- [x] Upload document → hoạt động end-to-end (2026-04-02)
- [x] RAG retrieval/storage chạy trên Qdrant (2026-04-02)
- [ ] Stream chat → vẫn hoạt động
- [ ] Frontend Settings → save/load đúng dữ liệu
- [ ] Frontend Keys → hiện danh sách thật

---

## Rủi ro & Lưu ý

| Rủi ro                                                  | Mức độ     | Xử lý                                                       |
| ------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| Sai lệch dữ liệu vector sau rollback pgvector -> Qdrant | Cao        | Re-index từ file gốc + regression test upload/search/delete |
| Break SQL agent (dùng TenantDatabaseConfig)             | Cao        | Giữ nguyên interface TenantDatabaseConfig                   |
| Break Widget SDK (dùng public_key)                      | Trung bình | Cập nhật middleware lookup                                  |
| Break Celery tasks                                      | Trung bình | Kiểm tra import models                                      |

---

## Ghi chú Cleanup Legacy (2026-04-03)

- Đã thêm migration cleanup: `f2a4d1c7b9e0_cleanup_legacy_tenants_columns.py` để loại bỏ cột/index legacy khỏi bảng `tenants`.
- Đã gỡ lớp tương thích tạm trong model `Tenant` (không còn mapping `slug/public_key/secret_key/allowed_origins/widget_* cũ/system_prompt/is_*`).
- Register flow và scripts seed backend đã chuyển hoàn toàn sang schema v2 (`tenant_keys`, `tenant_allowed_origins`, `tenant_widget_configs`, `tenant_ai_settings`).
