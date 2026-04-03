# 🚀 XenoAI: Bản thiết kế Tổng thể & Kế hoạch Tái cấu trúc (Refactor Blueprint)

## 1. Tầm nhìn dự án
XenoAI là nền tảng **SaaS AI Chatbot đa nền tảng** (Multi-tenant). 
- **Với Khách hàng (Tenants):** Cung cấp Widget chat thông minh biết đọc tài liệu (RAG) và truy vấn dữ liệu kinh doanh (SQL) chỉ bằng cách dán 1 đoạn script.
- **Với Chủ nền tảng (Super Admin):** Quản lý tập trung toàn bộ hệ thống, tài nguyên AI, chi phí và sức khỏe hạ tầng.

---

## 2. Phân tầng Người dùng (User Roles)

### A. Super Admin (Platform Owner)
- **Quản lý Tenant:** Duyệt đăng ký, khóa/mở tài khoản, cấu hình hạn mức (Quota).
- **Giám sát AI:** Theo dõi Token OpenAI/Gemini tiêu thụ toàn hệ thống để kiểm soát chi phí.
- **Hạ tầng:** Theo dõi trạng thái DB, Redis, Vector DB, Worker.
- **Global Config:** Whitelabel (thương hiệu), API Keys gốc, System Prompts mặc định.

### B. Tenant Admin (Business Owner)
- **Widget Config:** Tùy chỉnh màu sắc, tên bot, lời chào, vị trí hiển thị.
- **Data Integration:** Kết nối Database khách (SQL) và upload tài liệu (RAG).
- **API Keys:** Quản lý Public Key (nhúng web) và Secret Key (quản trị).
- **Analytics:** Xem lịch sử chat, thống kê sử dụng của riêng mình.

---

## 3. Kiến trúc Hệ thống (Target Architecture)

```text
[ Website Khách ] <─── (Widget SDK) ───> [ Chat UI (Iframe) ]
                                               │ (SSE Streaming)
                                               ▼
[ Super Admin Portal ] ───┐             [ API Backend (FastAPI) ]
                          ├──────────>         │
[ Tenant Dashboard ]   ───┘             [ Logic Orchestrator ]
                                        /      |       \
                          ┌────────────┘       │        └────────────┐
                          ▼                    ▼                     ▼
                  [ RAG Engine ]        [ SQL Engine ]        [ Analytics ]
                  (Qdrant DB)           (Customer DB)         (Postgres)
```

---

## 4. Chiến lược Tái cấu trúc Database (New DB Schema Strategy)

Database mới sẽ được thiết kế để giải quyết bài toán: **"Làm sao để Super Admin quản lý được hàng ngàn Tenant mà dữ liệu vẫn tuyệt đối an toàn/cách ly?"**

### Các bảng cốt lõi (Core Tables):
1.  **`system_admins`**: Lưu thông tin đăng nhập của Super Admin.
2.  **`tenants`**: Thông tin định danh doanh nghiệp, Email, Password, Slug, Plan (Free/Pro).
3.  **`tenant_configs`**: Cấu hình widget (màu, logo, greeting...) và AI Settings (System Prompt, Enable SQL/RAG).
4.  **`tenant_keys`**: Lưu cặp Public/Secret Key.
5.  **`tenant_databases`**: Credentials kết nối DB khách (Mã hóa AES-256-GCM).
6.  **`tenant_documents`**: Quản lý file RAG và trạng thái Ingestion.
7.  **`usage_logs`**: Lưu nhật ký tiêu thụ Token AI (Input/Output) theo từng Tenant và từng Model.
8.  **`chat_sessions` & `chat_messages`**: Lưu trữ hội thoại và các Metadata (Intent, SQL Query, RAG Sources).

---

## 5. Quy trình Luồng dữ liệu Chat (E2E Chat Flow)

1.  **Identity:** Widget gửi `public_key` + `Origin`. Backend xác thực và nạp `TenantContext`.
2.  **Orchestrator:** AI phân tích câu hỏi:
    - Nếu hỏi về chính sách/kiến thức -> Chạy **RAG Agent**.
    - Nếu hỏi về số liệu/đơn hàng -> Chạy **SQL Agent**.
    - Nếu hỏi bình thường -> Chạy **General Agent**.
3.  **Security:** 
    - SQL Agent chỉ được thực thi `SELECT` trên các bảng đã Whitelist.
    - Token được tính toán ngay sau mỗi câu trả lời và lưu vào `usage_logs`.
4.  **Streaming:** Kết quả được đẩy về Widget qua **SSE (Server-Sent Events)** kèm theo các UI Components (Bảng, Biểu đồ).

---

## 6. Stack Công nghệ ưu tiên

- **Backend:** FastAPI (Async) + SQLAlchemy 2.0 (Alembic).
- **Frontend:** Next.js 14 App Router + Tailwind CSS + Lucide Icons.
- **Vector DB:** Qdrant (Hỗ trợ multi-tenant qua Point Payload Filter).
- **Caching:** Redis (Rate limiting & Session storage).
- **Worker:** Celery + Redis (Xử lý file nặng bất đồng bộ).

---

## 7. Lộ trình thực hiện (Next Steps)

1.  **Bước 1:** Khởi tạo Database PostgreSQL với Schema mới hoàn toàn.
2.  **Bước 2:** Viết lại toàn bộ Model SQLAlchemy và chạy Migration ban đầu.
3.  **Bước 3:** Chuyển đổi logic Đăng ký/Đăng nhập sang hệ thống mới.
4.  **Bước 4:** Ánh xạ lại các API Dashboard hiện tại vào cấu trúc DB mới.
5.  **Bước 5:** Tối ưu hóa lại Orchestrator AI để tận dụng các cài đặt mới (System Prompt, Model Switch).

---
*© 2026 XenoAI Platform | Tài liệu định hướng Refactor*
