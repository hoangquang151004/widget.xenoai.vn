# Implementation Plan — Migration Cleanup Legacy Columns

> Ngày cập nhật: 2026-04-03
> Trạng thái: Đã triển khai xong
> Mục tiêu: Loại bỏ dứt điểm cột legacy trên bảng `tenants` và gỡ lớp tương thích tạm trong backend.

---

## 1) Hiện trạng cần cleanup

- Model [apps/api/models/tenant.py](apps/api/models/tenant.py) vẫn chứa compatibility fields tạm:
  - `slug`, `public_key`, `secret_key`, `legacy_allowed_origins`
  - `widget_color`, `widget_placeholder`, `widget_position`, `widget_welcome_message`, `widget_avatar_url`, `widget_font_size`, `widget_show_logo`
  - `system_prompt`, `is_rag_enabled`, `is_sql_enabled`
- Register flow ở [apps/api/api/v1/admin.py](apps/api/api/v1/admin.py) vẫn auto-generate `slug` và ghi các trường legacy để đi qua NOT NULL cũ.
- Các script seed cũ vẫn phụ thuộc trực tiếp vào `Tenant.slug/public_key/secret_key`:
  - [apps/api/scripts/seed.py](apps/api/scripts/seed.py)
  - [apps/api/scripts/seed_tenant.py](apps/api/scripts/seed_tenant.py)

---

## 2) Phạm vi triển khai cleanup

### Bước A — Tạo Alembic migration cleanup (non-destructive-safe theo điều kiện tồn tại)

- Tạo revision mới (down_revision từ `e99a6b0ac34c`) tại `apps/api/db/alembic/versions/`.
- Trong `upgrade()`:
  - Xóa các cột legacy trên `tenants` nếu tồn tại:
    - `slug`, `public_key`, `secret_key`, `allowed_origins`
    - `widget_color`, `widget_placeholder`, `widget_position`, `widget_welcome_message`, `widget_avatar_url`, `widget_font_size`, `widget_show_logo`
    - `system_prompt`, `is_rag_enabled`, `is_sql_enabled`
  - Xóa index legacy nếu tồn tại:
    - `ix_tenants_slug`, `ix_tenants_public_key`, `ix_tenants_secret_key`
- Trong `downgrade()`:
  - Để `pass` (không rollback destructive schema).

### Bước B — Gỡ compatibility layer khỏi model Tenant

- Cập nhật [apps/api/models/tenant.py](apps/api/models/tenant.py):
  - Giữ lại đúng schema v2 core: `id`, `name`, `email`, `password_hash`, `plan`, `is_active`, `created_at`, `updated_at`.
  - Giữ các relationships v2 (`widget_config`, `ai_settings`, `keys`, `allowed_origins`, `databases`, `documents`, `chat_sessions`, `chat_analytics`).
  - Bỏ toàn bộ cột legacy liệt kê ở Bước A.

### Bước C — Cập nhật code còn phụ thuộc legacy

- Cập nhật [apps/api/api/v1/admin.py](apps/api/api/v1/admin.py):
  - Bỏ helper `_slugify` và logic check unique slug.
  - Register chỉ tạo `Tenant` theo schema v2 + tạo `TenantKey`/`TenantWidgetConfig`/`TenantAiSettings` như hiện tại.
- Cập nhật scripts để không crash sau cleanup:
  - [apps/api/scripts/seed.py](apps/api/scripts/seed.py): chuyển sang seed theo `email`, tạo key qua `tenant_keys`, origin qua `tenant_allowed_origins`.
  - [apps/api/scripts/seed_tenant.py](apps/api/scripts/seed_tenant.py): tương tự, bỏ gán field legacy.

### Bước D — Đồng bộ tài liệu kỹ thuật

- Cập nhật [tasks/task_phase_5.md](tasks/task_phase_5.md) thêm mục verification cleanup migration.
- Ghi chú vào [PROGRESS.md](PROGRESS.md) rằng compatibility layer đã được gỡ.

---

## 3) Rủi ro và kiểm soát

- Rủi ro migration fail do object không tồn tại giữa các môi trường.
  - Kiểm soát: dùng `inspector`/`IF EXISTS` trước khi `drop`.
- Rủi ro script seed cũ bị hỏng sau khi drop cột.
  - Kiểm soát: refactor script cùng lượt cleanup.
- Rủi ro sót reference legacy gây lỗi runtime.
  - Kiểm soát: quét toàn bộ `apps/api/**/*.py` theo symbol cũ trước và sau chỉnh sửa.

---

## 4) Tiêu chí nghiệm thu

- `alembic upgrade head` chạy thành công với revision cleanup mới.
- Bảng `tenants` không còn các cột/index legacy nêu ở Bước A.
- Backend khởi động thành công sau khi bỏ compatibility fields khỏi model.
- Register/Login/GET me vẫn trả 2xx.
- Scripts seed chính không còn dùng `Tenant.slug/public_key/secret_key/allowed_origins` trực tiếp.

---

## 5) Lệnh verify sau triển khai

```bash
cd apps/api
.venv/Scripts/alembic current
.venv/Scripts/alembic upgrade head

# Kiểm tra cột tenants
.venv/Scripts/python -c "import asyncio; from db.session import async_session; from sqlalchemy import text;\
async def main():\
  async with async_session() as s:\
    r=await s.execute(text(\"SELECT column_name FROM information_schema.columns WHERE table_name='tenants' ORDER BY column_name\"));\
    print([x[0] for x in r.fetchall()]);\
asyncio.run(main())"
```

---

## 6) Kết quả triển khai

- Đã tạo migration cleanup tại `apps/api/db/alembic/versions/f2a4d1c7b9e0_cleanup_legacy_tenants_columns.py`.
- Đã chạy thành công `alembic upgrade head` với log nâng cấp từ `e99a6b0ac34c` lên `f2a4d1c7b9e0`.
- Đã gỡ compatibility fields trong `Tenant` model ở `apps/api/models/tenant.py`.
- Đã refactor register flow trong `apps/api/api/v1/admin.py` để không còn phụ thuộc `slug/public_key/secret_key/allowed_origins` trên bảng `tenants`.
- Đã refactor `apps/api/scripts/seed.py` và `apps/api/scripts/seed_tenant.py` theo schema v2 (`tenant_keys`, `tenant_allowed_origins`, `tenant_widget_configs`, `tenant_ai_settings`).
- Đã verify bằng truy vấn `information_schema.columns`: không còn cột legacy trên `tenants`.
