# Embeddable AI Chatbot Widget (SaaS Model)

Hệ thống chatbot AI đa năng dạng widget, có thể nhúng vào bất kỳ website nào thông qua một đoạn script ngắn. Hệ thống hỗ trợ mô hình **SaaS đa tenant**, cho phép mỗi khách hàng có dữ liệu tài liệu (RAG) và cơ sở dữ liệu (Text-to-SQL) hoàn toàn cô lập.

---

## 🚀 Tính năng chính

- **Widget Nhúng (SDK):** Một dòng script duy nhất, tự động tạo iframe và launcher UI mà không gây xung đột CSS/JS với trang web của khách hàng.
- **AI RAG (Retrieval-Augmented Generation):** Truy vấn thông tin từ tài liệu PDF, Word, TXT được tải lên bởi khách hàng (mỗi tenant một collection riêng trên Qdrant).
- **Text-to-SQL Thông Minh:** Kết nối trực tiếp với Database riêng của khách hàng để trả lời các câu hỏi về sản phẩm, đơn hàng, tồn kho... (Hỗ trợ PostgreSQL, MySQL).
- **Hệ thống Rich Components:** Hiển thị kết quả dưới dạng thẻ sản phẩm (Product Grid), biểu đồ (Charts), lịch sử đơn hàng (Order History) ngay trong cửa sổ chat.
- **Bảo mật 2 Lớp (Public Key + Admin Token):** Sử dụng `public_key` để gọi chat API từ widget; phần quản trị đăng nhập bằng email/mật khẩu để nhận Bearer token, kết hợp kiểm tra `Origin` header để chống giả mạo.

---

## 🏗️ Kiến trúc & Công nghệ

### Tech Stack

- **Backend:** FastAPI (Python 3.11+), SQLAlchemy (PostgreSQL 15), Redis 7, Celery.
- **Frontend (Dashboard & Chat UI):** Next.js 14 (App Router), Tailwind CSS, Recharts.
- **Widget SDK:** Vanilla JS (Vite IIFE bundle).
- **AI/ML:** LangChain, Qdrant (Vector DB), OpenAI (GPT-4o).
- **DevOps:** Docker Compose, Nginx (Reverse Proxy).

### Cấu trúc Monorepo

- `apps/api/`: FastAPI Backend xử lý logic AI, Auth và Data.
- `apps/web/`: Next.js App cho cả Dashboard admin và giao diện Chat chạy trong iframe.
- `apps/widget-sdk/`: Mã nguồn script nhúng cực nhẹ (< 50KB).
- `packages/types/`: Các TypeScript interfaces dùng chung cho toàn bộ dự án.
- `docs/`: Tài liệu thiết kế chi tiết (DB, API, Functional specs).

---

## 🔒 Mô hình Bảo mật

Hệ thống áp dụng cơ chế xác thực tương tự Stripe:

1. **Public Key (`pk_live_...`):** Đặt công khai trong script nhúng. Chỉ có quyền gửi tin nhắn chat.
2. **Admin Bearer Token:** Dashboard đăng nhập bằng email/mật khẩu để lấy token phiên. Dùng token này cho các API quản trị (cấu hình DB, upload tài liệu, xem thống kê).
3. **Origin Check:** Mọi request từ Widget đều được kiểm tra `Origin` header. Chỉ các domain được tenant đăng ký mới được phép gọi API.

---

## 🛠️ Hướng dẫn Cài đặt Nhanh (Development)

### 1. Backend (FastAPI)

```bash
cd apps/api
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
# Copy .env.example sang .env và cấu hình các keys
python -m uvicorn main:app --reload --port 8001
```

### 1.1 Chạy Redis + Celery Worker (bắt buộc để xử lý embedding tài liệu)

```bash
# Từ thư mục gốc dự án (mở terminal mới)
docker compose up -d redis

# Từ apps/api (mở terminal mới khác)
.\.venv\Scripts\activate
$env:PYTHONPATH = (Get-Location).Path
celery -A worker.celery_app:celery_app worker --loglevel=info --pool=solo
```

Nếu không bật Celery Worker, API upload tài liệu vẫn nhận file nhưng tác vụ parse/chunk/index sẽ không chạy.

Nếu gặp lỗi `ModuleNotFoundError: No module named 'db'`, hãy chắc chắn bạn đang đứng trong `apps/api` và đã set `PYTHONPATH` như dòng trên trước khi chạy Celery.

### 2. Frontend (Dashboard & Chat)

```bash
cd apps/web
npm install
# Cấu hình .env.local
npm run dev
```

### 3. Widget SDK

```bash
cd apps/widget-sdk
npm install
npm run dev
```

---

## 📈 Trạng thái Dự án (MVP Phase 1)

- [x] Khởi tạo cấu trúc Monorepo & Boilerplate.
- [x] Thiết kế Database & Auth logic (2-key model).
- [x] Xây dựng Chat UI & SSE Streaming.
- [ ] Hoàn thiện RAG Pipeline (Document Ingestion).
- [ ] Triển khai Text-to-SQL Agent (SQL Scoping).
- [ ] Hệ thống Rich Components (v1).
- [ ] Dashboard quản lý dành cho khách hàng.

---

_Dự án đang trong quá trình phát triển tích cực._
