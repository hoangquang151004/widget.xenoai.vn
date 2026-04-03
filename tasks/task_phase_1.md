# Task Phase 1 — Database Models & Schema

> Mục tiêu: Viết lại toàn bộ SQLAlchemy models theo kiến trúc v2.
> Trạng thái: Đã triển khai (2026-04-03)

---

## Checklist

### 1.1 — Tạo `models/base.py`

- [x] Tạo file mới `apps/api/models/base.py`
- [x] Định nghĩa `Base = declarative_base()` dùng chung
- [x] Không import ngược gây circular import

### 1.2 — Refactor `models/tenant.py`

- [x] Tách `Tenant` về phần account core
- [x] Bỏ các field widget/AI trực tiếp khỏi `Tenant`
- [x] Bỏ `public_key`, `secret_key`, `allowed_origins`, `slug`
- [x] Giữ các field cốt lõi: `id`, `name`, `email`, `password_hash`, `plan`, `is_active`, `created_at`, `updated_at`
- [x] Thêm `plan` với CHECK constraint `starter|pro|enterprise`
- [x] Thêm quan hệ tới bảng con (`widget_config`, `ai_settings`, `keys`, `allowed_origins`, `documents`, `chat_sessions`, `chat_analytics`)

### 1.3 — Tạo `models/widget_config.py`

- [x] Tạo model `TenantWidgetConfig` (1-1 theo `tenant_id`)
- [x] Có đủ các field: `bot_name`, `primary_color`, `logo_url`, `greeting`, `placeholder`, `position`, `show_sources`, `font_size`, `updated_at`
- [x] Có quan hệ ngược về `Tenant`

### 1.4 — Tạo `models/ai_settings.py`

- [x] Tạo model `TenantAiSettings` (1-1 theo `tenant_id`)
- [x] Có đủ các field: `system_prompt`, `is_rag_enabled`, `is_sql_enabled`, `temperature`, `max_tokens`, `updated_at`
- [x] Có quan hệ ngược về `Tenant`

### 1.5 — Tạo `models/tenant_key.py`

- [x] Tạo model `TenantKey`
- [x] `key_type` có CHECK (`public`, `admin`)
- [x] `key_value` là UNIQUE + INDEX
- [x] Có field `label`, `is_active`, `last_used_at`, `created_at`
- [x] Mapping hỗ trợ 1 tenant có nhiều keys

### 1.6 — Tạo `models/allowed_origin.py`

- [x] Tạo model `TenantAllowedOrigin`
- [x] Có UNIQUE constraint `(tenant_id, origin)`

### 1.7 — Refactor `models/document.py`

- [x] Dùng `Base` từ `models.base`
- [x] Giữ tương thích schema hiện tại, không ép re-add `qdrant_ids`
- [x] Bổ sung quan hệ `TenantDocument -> Tenant`

### 1.7.1 — Model chunks/vector PostgreSQL (tùy chọn)

- [ ] Chỉ thực hiện khi có quyết định quay lại pgvector
- [x] Trong đợt rollback Qdrant, mục này không phải tiêu chí bắt buộc để đóng Phase 1

### 1.8 — Tạo `models/chat.py`

- [x] Tạo `ChatSession`
- [x] Tạo `ChatMessage`
- [x] Tạo `ChatAnalytics`
- [x] Thiết lập quan hệ `ChatSession <-> ChatMessage`
- [x] Có CHECK cho `role` và UNIQUE `(tenant_id, date)` cho analytics

### 1.9 — Cập nhật `models/__init__.py`

- [x] Export đầy đủ các models mới
- [x] Chuẩn hóa `__all__`

### 1.10 — Xóa file thừa

- [x] Xóa `apps/api/models/tenant_file.py`

---

## Kiểm tra hoàn thành Phase 1

- [x] Chạy import smoke test thành công:

```bash
cd apps/api
.venv/Scripts/python -c "from models import *; print('OK')"
```

Kết quả: `OK`

✅ Phase 1 hoàn thành khi không có ImportError.
