# AGENTS.md — Đội ngũ Agent cho Giai đoạn Hoàn thiện (fix_bug_3)

Giai đoạn này tập trung vào việc đưa hệ thống từ trạng thái "chạy được" sang "sẵn sàng kinh doanh" (Production-ready).

## 1. Core Orchestrator (The Architect)
- **Vai trò:** Điều phối luồng xử lý chính giữa RAG, SQL và General.
- **Nhiệm vụ trong fix_bug_3:**
    - Cải thiện logic chuyển đổi giữa các Agent (Intent Classification).
    - Thêm cơ chế fallback khi một agent gặp lỗi hoặc thiếu cấu hình (ví dụ: SQL Agent khi khách chưa nhập DB credentials).

## 2. SQL Expert Agent
- **Vai trò:** Chuyên gia truy vấn dữ liệu quan hệ.
- **Nhiệm vụ trong fix_bug_3:**
    - Pipeline Text-to-SQL: self-correction trong `executor`, few-shot chọn từ `few_shot_examples.json`, prompt có **dialect** (PostgreSQL/MySQL) và schema thật từ inspect; log từng bước trong `run_text_to_sql` — xem [task_01_sql_integration.md](task_01_sql_integration.md).
    - Chỉ SELECT (validate trong `executor`).

## 3. DevOps & Security Agent
- **Vai trò:** Đảm bảo tính ổn định và bảo mật của hệ thống trên môi trường Production.
- **Nhiệm vụ trong fix_bug_3:**
    - Triển khai SSL (Certbot/Nginx).
    - Rate Limiting Redis theo tenant/key đã có trong API; có thể bổ sung SSL/Nginx và bucket theo IP.
    - Bảo mật Header và tối ưu hóa Docker Compose.

## 4. Product & Integration Agent
- **Vai trò:** Hoàn thiện trải nghiệm người dùng và tính năng kinh doanh.
- **Nhiệm vụ trong fix_bug_3:**
    - PayOS (link thanh toán + webhook, cập nhật `tenants.plan`); enforcement upload/chat đã có — xem [task_03_billing_enforcement.md](task_03_billing_enforcement.md).
    - Xây dựng hệ thống Analytics (Charts, Usage tracking).
    - Hoàn thiện Platform Admin Panel (`tenants.role = platform_admin`).
    - E-commerce / đặt hàng: epic tùy chọn — [task_06_ecommerce_ordering.md](task_06_ecommerce_ordering.md); không mở INSERT tự do trong Text-to-SQL.
