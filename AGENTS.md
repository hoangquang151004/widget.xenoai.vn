# AGENTS.md — Hướng dẫn cho AI Agent

> Định nghĩa bối cảnh dự án, quy tắc làm việc và giao thức giao tiếp. Tóm tắt: [context.md](context.md).

---

## 1. Tổng quan dự án

**Widget Chatbot** là nền tảng SaaS multi-tenant nhúng AI Chatbot vào website. Bot trả lời bằng RAG hoặc Text-to-SQL.

| Thư mục | Vai trò | Stack |
|---------|---------|-------|
| `apps/api/` | Backend REST API | FastAPI, SQLAlchemy, PostgreSQL, Redis, Celery |
| `apps/web/` | Dashboard UI | Next.js 14 (App Router), Tailwind CSS |
| `apps/widget-sdk/` | Script nhúng | Vanilla JS, Vite IIFE |
| `packages/types/` | TypeScript types dùng chung | TypeScript |

---

## 2. Quy tắc TUYỆT ĐỐI

- **Luôn trả lời bằng Tiếng Việt**.
- Python executable: **`apps/api/.venv/Scripts/python.exe`** — KHÔNG dùng system python.
- Alembic: **`apps/api/.venv/Scripts/alembic`**.
- **Sau mỗi lần sửa code:** chạy test và báo kết quả (pass/fail, file lỗi nếu có).
- **Architect First:** xuất KẾ HOẠCH (`implementation_plan.md`) và chờ phản hồi **"Duyệt"** trước khi ghi file. Tạo task list trong `task.md` trước khi code.
- **Bảo mật:** Model 2-key (`public_key`/`admin_key`); kiểm tra `Origin` header; mã hóa credentials AES-256-GCM; SQL agent chỉ cho `SELECT`, luôn inject `tenant_id`.
- **Database:** KHÔNG thay đổi `GEMINI_MODEL`, `EMBEDDING_MODEL`, `EMBEDDING_DIM` trong `.env`. Mọi thay đổi schema phải qua **Alembic migration**.

---

## 3. Lệnh Build / Lint / Test

### Backend (Python/FastAPI)

```powershell
# Server dev
cd apps/api; .\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8001

# Tất cả tests
cd apps/api; .\.venv\Scripts\python.exe -m pytest tests/ -v

# Một file test
cd apps/api; .\.venv\Scripts\python.exe -m pytest tests/test_task03_analytics_reporting.py -v

# Một test function
cd apps/api; .\.venv\Scripts\python.exe -m pytest tests/test_task03_analytics_reporting.py::test_name -v

# Lint (ruff: E9,F63,F7,F82)
pip install ruff && ruff check apps/api/ --select E9,F63,F7,F82

# Alembic migration
cd apps/api; .\.venv\Scripts\alembic revision --autogenerate -m "description"
cd apps/api; .\.venv\Scripts\alembic upgrade head

# Celery worker (cần Redis)
cd apps/api; $env:PYTHONPATH = (Get-Location).Path; celery -A worker.celery_app:celery_app worker --loglevel=info --pool=solo
```

### Frontend (Next.js/TypeScript)

```powershell
cd apps/web; npm run dev       # dev server
cd apps/web; npm run lint      # lint
cd apps/web; npx tsc --noEmit  # typecheck
cd apps/web; npm run build     # build
cd apps/web; npm run test      # vitest
```

### Widget SDK (Vanilla JS/Vite)

```powershell
cd apps/widget-sdk; npm run dev
cd apps/widget-sdk; npm run build
cd apps/widget-sdk; npm run test
```

---

## 4. Code Style Guidelines

### Python Backend

- **Imports:** stdlib → third-party → local. Dùng `isort` tự động sắp xếp.
- **Naming:** Classes `PascalCase` · Functions/variables `snake_case` · Constants `UPPER_SNAKE_CASE` · Private methods prefix `_`.
- **Type hints:** Bắt buộc cho function signatures. Dùng `pydantic` models cho request/response.
- **Error handling:** Dùng HTTPException với status code rõ ràng; không expose raw stack traces.
- **Async:** Ưu tiên `async def` cho endpoint và DB operations.
- **Docstrings:** Google style cho public functions/classes.

```python
async def get_tenant(tenant_id: str) -> Tenant:
    """Lấy tenant theo ID.

    Args:
        tenant_id: UUID của tenant.

    Returns:
        Tenant model.

    Raises:
        HTTPException: 404 nếu không tìm thấy.
    """
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant
```

### TypeScript/React Frontend

- **Imports:** Path alias `@/` cho local. Thứ tự: React → third-party → local → types.
- **Naming:** Components `PascalCase` · Hooks prefix `use` · Functions/variables `camelCase` · Constants `UPPER_SNAKE_CASE` · Files `kebab-case.tsx`.
- **Types:** `interface` cho object shapes; `type` cho unions/intersections. KHÔNG dùng `any`.
- **Component style:** Functional components với hooks. Logic phức tạp trong custom hooks.
- **Styling:** Tailwind CSS. Custom colors trong `tailwind.config.ts`.

```typescript
interface ChatBubbleProps {
  message: string;
  timestamp: Date;
  isBot?: boolean;
}

export const ChatBubble: FC<ChatBubbleProps> = ({ message, timestamp, isBot = false }) => (
  <div className={`flex ${isBot ? "justify-start" : "justify-end"}`}>
    <div className={isBot ? "bg-primary" : "bg-secondary"}>{message}</div>
  </div>
);
```

### Widget SDK (Vanilla JS)

- **Module:** ES modules, IIFE build output.
- **Naming:** camelCase cho functions/variables, PascalCase cho classes.
- **API calls:** Dùng `fetch` với timeout và error handling.
- **DOM:** Dùng `data-*` attributes cho selectors, tránh tight coupling với host page.

---

## 5. Kiến trúc Database

`tenants` (core) → `tenant_widget_configs`, `tenant_ai_settings`, `tenant_keys` (1-N), `tenant_allowed_origins` (1-N), `tenant_databases` (1-N, encrypted), `tenant_documents` (1-N), `chat_sessions` (1-N) → `chat_messages`, `chat_analytics`.

---

## 6. API Endpoints chính

**Admin (Bearer):** `POST /admin/register`, `POST /admin/login`, `GET/PATCH /admin/me`, `PATCH /admin/widget`, `PATCH /admin/ai-settings`, CRUD `/admin/keys|origins|database`, `GET /admin/billing/summary`, `GET /admin/analytics/stats|history`, `/admin/billing/payos/*`.

**Widget (API Key):** `GET /chat/config`, `POST /chat`, `POST /chat/stream`.

**Files (Bearer):** `POST /files/upload`, `GET /files/list`, `DELETE /files/{id}`.

**Platform Admin (Bearer — role=platform_admin):** `/platform-admin/stats|tenants|system/status`.

---

## 7. Files quan trọng

| File | Vai trò |
|------|---------|
| `PROGRESS.md` | Trạng thái các Phase |
| `tasks/task_phase_*.md` | Chi tiết tasks từng Phase |
| `tasks/task_billing_plans.md` | Định nghĩa gói billing |
| `apps/api/.env` | Biến môi trường (không commit) |
| `apps/api/db/alembic/versions/` | Lịch sử migration |
| `apps/web/src/hooks/useApi.ts` | API hook frontend |
| `apps/web/src/context/AuthContext.tsx` | Auth context |

---

## 8. CI/CD

- **Lint:** `ruff check apps/api/ --select E9,F63,F7,F82`
- **Test:** `pytest tests/ -v` (cần PostgreSQL, Redis, Qdrant)
- **Build:** `npm run build` cho web và widget-sdk
- **Deploy:** Push tag `v*` → deploy workflow → VPS qua SSH

Ref: [README.md](README.md), [context.md](context.md)