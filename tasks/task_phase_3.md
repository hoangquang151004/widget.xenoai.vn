# Task Phase 3 — Backend API Refactor

> **Mục tiêu:** Cập nhật tất cả endpoints để làm việc với schema mới.
> **Yêu cầu:** Phase 1 + Phase 2 phải hoàn thành trước.

---

## Checklist

### 3.1 — Cập nhật `api/middleware.py`

**Vấn đề:** Hiện tại middleware lookup `public_key` và `secret_key` trực tiếp từ bảng `tenants`. Schema mới dùng bảng `tenant_keys`.

- [x] Sửa hàm `_authenticate_by_api_key`:
  - Thay query `Tenant.public_key == api_key` → query `TenantKey.key_value == api_key`
  - Join với `Tenant` để lấy `tenant.is_active`
  - Cập nhật `TenantKey.last_used_at = datetime.utcnow()`
- [x] Import thêm `TenantKey` từ `models.tenant_key`
- [x] Cập nhật logic `is_public` dựa trên `TenantKey.key_type == 'public'`
- [x] Cập nhật origin check: thay `tenant.allowed_origins` → query từ bảng `TenantAllowedOrigin`

**Pattern mới:**

```python
from models.tenant_key import TenantKey
from models.allowed_origin import TenantAllowedOrigin

# Lookup bằng key
result = await session.execute(
    select(TenantKey, Tenant)
    .join(Tenant, TenantKey.tenant_id == Tenant.id)
    .filter(TenantKey.key_value == api_key, TenantKey.is_active == True, Tenant.is_active == True)
)
row = result.first()
if not row:
    return 401...
tenant_key, tenant = row
```

---

### 3.2 — Refactor `api/v1/admin.py`

#### 3.2.1 — `POST /register`

- [x] Sau khi tạo `Tenant`, tạo thêm 3 bản ghi:
  - `TenantWidgetConfig(tenant_id=tenant.id)` — defaults
  - `TenantAiSettings(tenant_id=tenant.id)` — defaults
  - `TenantKey(tenant_id, key_type='public', key_value=pk_live_...)`
  - `TenantKey(tenant_id, key_type='admin', key_value=sk_live_...)`
- [x] Xóa `slug` field khỏi RegisterSchema
- [x] Trả về `public_key` trong response

#### 3.2.2 — `POST /login`

- [x] Giữ nguyên — không thay đổi

#### 3.2.3 — `GET /me`

- [x] Join với `TenantWidgetConfig` và `TenantAiSettings`
- [x] Trả về object đầy đủ gồm: tenant + widget_config + ai_settings
- [x] Thêm `public_key` lấy từ TenantKey (key_type='public', is_active=True)

**Response mới:**

```json
{
  "id": "...",
  "name": "...",
  "email": "...",
  "plan": "starter",
  "public_key": "pk_live_...",
  "widget": {
    "bot_name": "Trợ lý AI",
    "primary_color": "#2563eb",
    "greeting": "Xin chào!",
    "placeholder": "Nhập câu hỏi...",
    "position": "bottom-right",
    "show_sources": true,
    "font_size": "14px"
  },
  "ai_settings": {
    "system_prompt": "...",
    "is_rag_enabled": true,
    "is_sql_enabled": false
  }
}
```

#### 3.2.4 — `PATCH /widget` (endpoint MỚI)

- [x] Tạo endpoint mới thay thế `PATCH /me`
- [x] Schema: `WidgetUpdateSchema` với các field widget config
- [x] Update `TenantWidgetConfig` record

#### 3.2.5 — `PATCH /ai-settings` (endpoint MỚI)

- [x] Tạo endpoint mới
- [x] Schema: `AiSettingsUpdateSchema`
- [x] Update `TenantAiSettings` record

#### 3.2.6 — `GET /keys` (endpoint MỚI)

- [x] Query tất cả `TenantKey` của tenant hiện tại
- [x] Trả về list với: `id`, `key_type`, `key_value` (masked), `label`, `is_active`, `last_used_at`, `created_at`
- [x] **Không bao giờ** trả về key value đầy đủ sau khi tạo

#### 3.2.7 — `POST /keys` (endpoint MỚI)

- [x] Schema: `CreateKeySchema { key_type: 'public'|'admin', label: str }`
- [x] Tạo `TenantKey` mới với `_generate_key()`
- [x] **Chỉ lần này** trả về `key_value` đầy đủ (không lưu lại được)

#### 3.2.8 — `DELETE /keys/{key_id}` (endpoint MỚI)

- [x] Verify key thuộc về tenant hiện tại
- [x] Set `is_active = False` (không xóa cứng để giữ audit log)

#### 3.2.9 — `GET /origins` (endpoint MỚI)

- [x] Query `TenantAllowedOrigin` của tenant

#### 3.2.10 — `POST /origins` (endpoint MỚI)

- [x] Schema: `AddOriginSchema { origin: str, note: str }`
- [x] Validate format origin (phải là domain, không có path)
- [x] Tạo `TenantAllowedOrigin`

#### 3.2.11 — `DELETE /origins/{origin_id}` (endpoint MỚI)

- [x] Xóa cứng (hard delete)

#### 3.2.12 — Xóa endpoints cũ

- [x] Xóa `PATCH /me` → thay bằng `PATCH /widget` + `PATCH /ai-settings`
- [x] Xóa `POST /rotate-keys` → thay bằng `DELETE /keys/{id}` + `POST /keys`
- [x] Giữ nguyên `GET /database`, `POST /database`, `POST /database/test`

#### 3.2.13 — `GET /billing/summary`

- [x] Cập nhật query `plan` từ bảng `tenants.plan` thay vì raw SQL

---

### 3.3 — Cập nhật `api/v1/chat.py`

#### 3.3.1 — `GET /config`

- [x] Thay query `Tenant` → query `TenantKey` JOIN `TenantWidgetConfig`
- [x] Lookup tenant bằng `TenantKey.key_value == api_key`
- [x] Lấy widget config từ `TenantWidgetConfig`
- [x] Origin check: query `TenantAllowedOrigin` thay vì `tenant.allowed_origins`

**Response mới:**

```json
{
  "bot_name": "Trợ lý AI",
  "primary_color": "#2563eb",
  "greeting": "Xin chào!",
  "placeholder": "Nhập câu hỏi...",
  "position": "bottom-right",
  "show_sources": true
}
```

#### 3.3.2 — `POST /stream`

- [x] Sau khi request bắt đầu: tìm hoặc tạo `ChatSession(tenant_id, visitor_id=session_id)`
- [x] Sau khi hoàn thành: lưu `ChatMessage(session_id, role='user', content=query)` và `ChatMessage(role='assistant', content=response)`
- [x] Đây là best-effort (không block stream nếu DB ghi thất bại)

---

### 3.4 — Cập nhật `api/v1/files.py`

- [x] Cập nhật luồng xóa tài liệu để xóa vectors trong Qdrant theo tenant-safe filter
- [x] Đảm bảo thao tác xóa là tenant-safe (`tenant_id` filter bắt buộc)

---

### 3.5 — Cập nhật Pydantic Schemas

- [x] Xóa `TenantUpdateSchema` cũ
- [x] Tạo `WidgetUpdateSchema`
- [x] Tạo `AiSettingsUpdateSchema`
- [x] Tạo `CreateKeySchema`
- [x] Tạo `AddOriginSchema`
- [x] Cập nhật `RegisterTenantSchema` (xóa `slug`)

---

### 3.6 — Refactor RAG storage/search sang Qdrant

- [x] Cập nhật `ai/vector_store.py` dùng Qdrant vector store (dense/sparse nếu cần)
- [x] Cập nhật `ai/rag/processor.py` để upsert/delete vectors vào Qdrant theo payload (`tenant_id`, `document_id`)
- [x] Cập nhật `ai/rag_agent.py` để search top-k từ Qdrant theo `tenant_id`
- [x] Đảm bảo metadata trả về sources không đổi format để tránh break UI
- [x] Cập nhật `main.py` health check detailed:
  - Giữ check `postgresql`, `redis`, `qdrant`
  - Bỏ check `postgres_vector` trong runtime hiện tại

---

## Kiểm tra hoàn thành Phase 3

```bash
# Khởi động server
cd apps/api
.venv/Scripts/python -m uvicorn main:app --reload --port 8001

# Test register
curl -X POST http://localhost:8001/api/v1/admin/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Corp","email":"test@test.com","password":"password123"}'

# Test login
curl -X POST http://localhost:8001/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'

# (Lưu token từ login, dùng cho các request tiếp theo)
TOKEN="..."

# Test GET /me
curl http://localhost:8001/api/v1/admin/me \
  -H "Authorization: Bearer $TOKEN"

# Test GET /keys
curl http://localhost:8001/api/v1/admin/keys \
  -H "Authorization: Bearer $TOKEN"

# Test POST /keys
curl -X POST http://localhost:8001/api/v1/admin/keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key_type":"public","label":"Production"}'
```

✅ Phase 3 hoàn thành khi tất cả curl commands trả về 2xx.
