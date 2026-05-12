# 🚀 Hướng dẫn Triển khai (Deployment Guide) — XenoAI

Tài liệu này hướng dẫn chi tiết quy trình CI/CD và cách thức triển khai hệ thống XenoAI lên môi trường Production sử dụng GitHub Actions, PM2 và VPS.

---

## 1. Kiến trúc Triển khai (Deployment Architecture)

Hệ thống được triển khai theo mô hình Hybrid:
- **CI (Continuous Integration):** Chạy trên GitHub Actions Runner (Ubuntu).
- **CD (Continuous Deployment):** Triển khai trực tiếp lên VPS của khách hàng thông qua kết nối SSH.
- **Process Manager:** Sử dụng **PM2** để quản lý và duy trì các dịch vụ (API, Worker, Web, SDK).

---

## 2. Quy trình CI (Continuous Integration)

**File cấu hình:** `.github/workflows/ci.yml`

### Các bước thực hiện:
1.  **Lint Backend:** Sử dụng `ruff` để kiểm tra lỗi cú pháp và chuẩn code Python nhanh chóng.
2.  **Build Shared UI:** Build package `@widget-chatbot/ui` trước vì các ứng dụng khác phụ thuộc vào nó.
3.  **Build Web Dashboard:** Chạy `next build` cho `apps/web`.
4.  **Build Widget SDK:** Build bundle `widget.js` cho `apps/widget-sdk`.

### Lưu ý quan trọng:
- **Bỏ qua Backend Tests:** Để tối ưu tốc độ (giảm ~20 phút), quy trình hiện tại đã bỏ qua các bài test `pytest` nặng nề.
- **npm install vs npm ci:** Sử dụng `npm install --no-audit --no-fund` thay vì `npm ci` để đảm bảo tương thích file `package-lock.json` giữa môi trường Windows (dev) và Linux (CI).

---

## 3. Quy trình CD (Continuous Deployment)

**File cấu hình:** `.github/workflows/deploy-vps.yml`

### Trình kích hoạt (Triggers):
- Chạy thủ công qua tab **Actions** -> **CD — Deploy To VPS (PM2)** -> **Run workflow**.
- Người dùng có thể chọn `branch` hoặc `tag` cần deploy.

### Các bước triển khai trên VPS:
1.  **Verify CI:** Kiểm tra xem commit hiện tại đã pass CI (Lint & Build) chưa. Nếu chưa, sẽ không cho phép deploy.
2.  **SSH Bootstrap:** Kết nối SSH và cập nhật mã nguồn bằng `git fetch` & `reset --hard`.
3.  **API Deploy:**
    - Cài đặt thư viện Python (`pip install`).
    - Chạy migration database (`alembic upgrade head`).
    - Restart process `widget-api`.
4.  **Worker Deploy:** Restart process `widget-worker` (Celery).
5.  **Frontend Deploy (Web & SDK):**
    - Cài đặt npm dependencies.
    - **Build Web:** Nhúng `PROD_API_URL` vào bundle Next.js.
    - Restart process `widget-web` và `widget-sdk`.
6.  **Health Check:** Gọi các endpoint `/api/health` để xác nhận dịch vụ đã online.

---

## 4. Cấu hình Secrets (GitHub)

Để CD hoạt động, bạn cần cấu hình các Secrets sau trong Repository Settings:

| Secret Name | Mô tả | Ví dụ |
|---|---|---|
| `VPS_HOST` | Địa chỉ IP hoặc Domain của VPS | `1.2.3.4` |
| `VPS_USER` | Tài khoản SSH | `root` hoặc `ubuntu` |
| `VPS_PORT` | Cổng SSH | `22` |
| `VPS_SSH_KEY` | Private Key SSH (RSA/OpenSSH) | `-----BEGIN RSA PRIVATE KEY-----...` |
| `VPS_APP_PATH` | Thư mục chứa code trên VPS | `/var/www/widget.xenoai.vn` |
| `PROD_API_URL` | URL API công khai (HTTPS) | `https://api.widget.xenoai.vn` |

---

## 5. Quản lý Dịch vụ với PM2

Danh sách các process cần quản lý trên VPS:

```bash
# Xem trạng thái các dịch vụ
pm2 status

# Xem log thời gian thực
pm2 logs widget-api
pm2 logs widget-web

# Restart thủ công nếu cần
pm2 restart all
```

---

## 6. Xử lý sự cố (Troubleshooting)

### Lỗi "PROD_API_URL length: 0"
- **Triệu chứng:** Build Web Dashboard thất bại hoặc Web không gọi được API.
- **Xử lý:** Kiểm tra đã thêm Secret `PROD_API_URL` vào GitHub chưa.

### Lỗi "github-script@v8 not found"
- **Xử lý:** Đảm bảo sử dụng `actions/github-script@v7`. (Đã được fix trong bản cập nhật mới nhất).

### Lỗi tài nguyên VPS (RAM/Disk)
- Script deploy mới đã bổ sung lệnh `free -m` và `df -h` trong log khi có lỗi xảy ra. Hãy kiểm tra phần **System Resources** trong log của GitHub Actions để xem VPS có bị tràn RAM hoặc đầy ổ cứng không.

---
*© 2026 XenoAI Platform | Tài liệu triển khai hệ thống*
