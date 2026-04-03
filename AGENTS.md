# AGENTS.md — Hướng dẫn cho AI Agent

> File này định nghĩa bối cảnh dự án, quy tắc làm việc và giao thức giao tiếp cho mọi AI Agent tham gia vào dự án **Widget Chatbot**.

---

## 1. Tổng quan dự án

**Widget Chatbot** là nền tảng SaaS multi-tenant cho phép doanh nghiệp nhúng AI Chatbot vào website thông qua một đoạn JavaScript snippet. Agent có thể hỏi/trả lời bằng cách phân tích tài liệu (RAG) hoặc truy vấn database của khách hàng (Text-to-SQL).

### Các thành phần chính
| Thư mục | Vai trò | Stack |
|---------|---------|-------|
| `apps/api/` | Backend REST API | FastAPI, SQLAlchemy, PostgreSQL, Redis, Celery |
| `apps/web/` | Dashboard UI | Next.js 14 (App Router), Tailwind CSS |
| `apps/widget-sdk/` | Script nhúng | Vanilla JS, Vite IIFE |
| `packages/types/` | TypeScript types dùng chung | TypeScript |

---

## 2. Quy tắc TUYỆT ĐỐI

### 2.1 Ngôn ngữ & Python
- **Luôn trả lời bằng Tiếng Việt**.
- Python executable: **`apps/api/.venv/Scripts/python.exe`** — KHÔNG dùng system python.
- Alembic: **`apps/api/.venv/Scripts/alembic`**.

### 2.2 Quy trình Architect First
1. **LUÔN** xuất ra KẾ HOẠCH (`implementation_plan.md`) và chờ người dùng phản hồi **"Duyệt"** trước khi ghi file.
2. Với mỗi Phase trong `PROGRESS.md`, tạo task list tương ứng trong `task.md` trước khi code.

### 2.3 Bảo mật
- Model 2-key: `public_key` (pk_live_...) và `admin_key` (sk_live_...) — xác thực qua bảng `tenant_keys`.
- Kiểm tra `Origin` header cho mọi request từ widget.
- Mã hóa DB credentials bằng AES-256-GCM (key trong `APP_ENCRYPTION_KEY`).
- SQL agent: Chỉ cho phép `SELECT`, luôn inject `tenant_id`.

### 2.4 Database
- **KHÔNG thay đổi** các biến cấu hình model AI trong `.env`: `GEMINI_MODEL`, `EMBEDDING_MODEL`, `EMBEDDING_DIM`.
- Mọi thay đổi schema phải thông qua **Alembic migration**.
- Chạy `alembic upgrade head` sau khi tạo migration mới.

### 2.5 Frontend
- Tất cả API call phải dùng hook `useApi` ở `apps/web/src/hooks/useApi.ts`.
- Auth context: `apps/web/src/context/AuthContext.tsx`.
- Không hardcode mock data trong pages production.

---

## 3. Kiến trúc Database Mới (v2)

```
tenants                    ← Core account (email, password, plan)
  ├── tenant_widget_configs (1-1)  ← Bot name, color, greeting...
  ├── tenant_ai_settings   (1-1)  ← system_prompt, is_rag_enabled...
  ├── tenant_keys          (1-N)  ← Multi API keys (public/admin)
  ├── tenant_allowed_origins(1-N) ← CORS domain whitelist
  ├── tenant_databases     (1-N)  ← Encrypted DB configs (Text-to-SQL)
  ├── tenant_documents     (1-N)  ← RAG documents
  ├── chat_sessions        (1-N)  ← Conversation sessions
  │   └── chat_messages    (1-N)  ← Individual messages
  └── chat_analytics       (1-N)  ← Daily aggregated stats
```

---

## 4. API Endpoints Map

### Admin Routes (Bearer token required)
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/v1/admin/register` | Đăng ký tenant mới |
| POST | `/api/v1/admin/login` | Đăng nhập → Bearer token |
| GET | `/api/v1/admin/me` | Thông tin tenant |
| PATCH | `/api/v1/admin/widget` | Cập nhật cấu hình widget |
| PATCH | `/api/v1/admin/ai-settings` | Cập nhật cài đặt AI |
| GET | `/api/v1/admin/keys` | Danh sách API keys |
| POST | `/api/v1/admin/keys` | Tạo key mới |
| DELETE | `/api/v1/admin/keys/{id}` | Xóa/thu hồi key |
| GET | `/api/v1/admin/origins` | Danh sách allowed origins |
| POST | `/api/v1/admin/origins` | Thêm origin |
| DELETE | `/api/v1/admin/origins/{id}` | Xóa origin |
| GET | `/api/v1/admin/database` | Lấy DB config |
| POST | `/api/v1/admin/database` | Lưu DB config |
| POST | `/api/v1/admin/database/test` | Test kết nối |
| GET | `/api/v1/admin/billing/summary` | Billing stats |

### Widget/Public Routes (API Key required)
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/v1/chat/config` | Widget config (public) |
| POST | `/api/v1/chat` | Chat request |
| POST | `/api/v1/chat/stream` | SSE streaming chat |

### Files Routes (Bearer token required)
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/v1/files/upload` | Upload tài liệu RAG |
| GET | `/api/v1/files/list` | Danh sách tài liệu |
| DELETE | `/api/v1/files/{id}` | Xóa tài liệu |

---

## 5. Cấu trúc Models

```
apps/api/models/
  ├── __init__.py          ← Export tất cả models
  ├── base.py              ← Base declarative_base()
  ├── tenant.py            ← Tenant (account core)
  ├── widget_config.py     ← TenantWidgetConfig
  ├── ai_settings.py       ← TenantAiSettings
  ├── tenant_key.py        ← TenantKey (multi-key)
  ├── allowed_origin.py    ← TenantAllowedOrigin
  ├── tenant_db_config.py  ← TenantDatabaseConfig
  ├── document.py          ← TenantDocument
  └── chat.py              ← ChatSession, ChatMessage, ChatAnalytics
```

---

## 6. Lệnh thường dùng

```bash
# Backend
cd apps/api
.venv/Scripts/python -m uvicorn main:app --reload --port 8001

# Alembic
.venv/Scripts/alembic revision --autogenerate -m "description"
.venv/Scripts/alembic upgrade head
.venv/Scripts/alembic downgrade -1

# Tests
.venv/Scripts/python -m pytest tests/ -v

# Frontend
cd apps/web
npm run dev
```

---

## 7. Files quan trọng cần biết

| File | Vai trò |
|------|---------|
| `PROGRESS.md` | Trạng thái tổng thể các Phase migration |
| `tasks/task_phase_*.md` | Chi tiết tasks từng Phase |
| `apps/api/.env` | Biến môi trường (không commit) |
| `apps/api/db/schema.sql` | SQL schema reference |
| `apps/api/db/alembic/versions/` | Lịch sử migration |
| `apps/api/core/config.py` | Settings class |
| `apps/api/core/security.py` | Auth utilities |
| `apps/web/src/hooks/useApi.ts` | API hook cho frontend |
| `apps/web/src/context/AuthContext.tsx` | Auth context |
