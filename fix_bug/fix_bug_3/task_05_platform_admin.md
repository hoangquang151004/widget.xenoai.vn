# TASK-05: Platform Admin Dashboard

## 1. Vấn đề
Hiện tại chúng ta chỉ có dashboard cho từng Tenant (khách hàng). Người chủ nền tảng (Platform Owner) cần một nơi để quản lý toàn bộ hệ thống:
- Xem danh sách tất cả các Tenant.
- Kích hoạt/Khóa tài khoản Tenant.
- Xem tổng doanh thu và thông số hệ thống.

## 2. Mục tiêu
- Tạo một phân vùng quản trị riêng biệt dành cho Admin của toàn bộ hệ thống.

## 3. Các bước thực hiện
1. **Security (schema hiện tại):** Dùng cột **`tenants.role`** với giá trị `'platform_admin'` (check constraint trong DB). **Không** thêm flag `is_platform_admin` trùng ý nghĩa — tránh hai nguồn sự thật. Script gán quyền: `apps/api/scripts/create_platform_admin.py`.
2. **Router:** Tạo bộ router `api/v1/platform_admin.py` (hoặc tương đương) bảo vệ bởi dependency kiểm tra `role == platform_admin` trên JWT/session.
3. **Frontend:** Thư mục ví dụ `/dashboard/platform-admin/` với các trang:
    - `tenants/`: Quản lý danh sách khách hàng.
    - `billing/`: Giao dịch / doanh thu (khi có tích hợp PayOS hoặc bảng sự kiện thanh toán).
    - `system/`: Trạng thái các service (Redis, Celery, Qdrant).
4. **Logic:** Impersonate (đăng nhập hộ tenant) — chỉ platform admin, audit log bắt buộc nếu triển khai.

## 4. Định nghĩa hoàn thành (DoD)
- [ ] Platform Admin có thể đăng nhập và xem danh sách Tenant.
- [ ] Các endpoint Platform Admin từ chối tenant có `role = tenant` (403).
