# Runbook vận hành production

Tài liệu tóm tắt cho môi trường sau khi triển khai (reverse proxy, API, Postgres, Redis, Qdrant).

## Trước khi go-live

- Bật `ENV=production` cho API; đặt `SECRET_KEY`, `APP_ENCRYPTION_KEY` (ổn định, backup an toàn), CORS origins thực tế. Bản mẫu biến: [`apps/api/.env.production.example`](../apps/api/.env.production.example); frontend: [`apps/web/.env.production.example`](../apps/web/.env.production.example). Docker: [`.env.docker.production.example`](../.env.docker.production.example).
- TLS: chấm dứt HTTPS tại Nginx (hoặc load balancer), HTTP nội bộ tới `api:8001` / `web:3000`.
- `SENTRY_DSN`: bật cho backend (đã hỗ trợ trong `main.py` khi biến được set) và khuyến nghị bật cho `apps/web`.
- RAG: đảm bảo Qdrant được backup và có kế hoạch **re-index** từ `tenant_documents` / file gốc khi mất collection.

## TLS / HTTPS (Let's Encrypt + Certbot)

1. Trỏ DNS `A`/`AAAA` domain về máy chủ Nginx.
2. Cài Certbot (plugin nginx hoặc standalone). Ví dụ Ubuntu + nginx plugin:
   - `sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com`
3. Gia hạn tự động: cron/systemd timer `certbot renew` (thường đã cài sẵn).
4. Trong repo: merge khối `listen 443 ssl` vào cấu hình Nginx — tham chiếu [`nginx/nginx-https.example.conf`](../nginx/nginx-https.example.conf), include [`nginx/snippets/ssl-https.conf`](../nginx/snippets/ssl-https.conf) (HSTS chỉ trên HTTPS).
5. `docker-compose`: mở cổng `443:443`, gắn volume chứng chỉ (ví dụ `/etc/letsencrypt/live/...`) vào container Nginx; cập nhật đường dẫn `ssl_certificate` trong server block.
6. Kiểm tra: trình duyệt không cảnh báo chứng chỉ; `curl -I https://yourdomain.com` có `Strict-Transport-Security` sau khi bật snippet SSL.

## Nginx (reverse proxy)

- File chính: [`nginx/nginx.conf`](../nginx/nginx.conf) — include [`nginx/snippets/security-headers.conf`](../nginx/snippets/security-headers.conf), **rate limit theo IP** trên `/api/` (bổ sung cho Redis/tenant ở API).
- Widget nhúng HTTPS: cấu hình `tenant_allowed_origins` đúng domain; `NEXT_PUBLIC_API_URL` trỏ API public HTTPS.

## Header bảo mật API

Với `ENV=production`, middleware FastAPI gắn thêm (best-effort):

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (hạn chế camera/mic/geolocation)

Nginx thêm header tương thích (và `X-Frame-Options`/`SAMEORIGIN` cho UI). **HSTS** chỉ bật trên listener HTTPS (`nginx/snippets/ssl-https.conf`). CSP có thể bổ sung sau khi kiểm tra Next.js/widget — tùy CDN và inline script.

## Database khách (Text-to-SQL)

- Khuyến nghị user DB **read-only**, chỉ quyền `SELECT` trên schema cần thiết.
- Credentials lưu mã hóa AES-GCM; **xoay** `APP_ENCRYPTION_KEY` trên production cần kế hoạch re-encrypt cấu hình tenant (không tự động trong repo này).

## Sao lưu & phục hồi

- **PostgreSQL (SaaS)**: snapshot/định kỳ, kiểm tra restore drill.
- **Redis**: có thể mất cache an toàn; Celery broker nếu dùng Redis cần RPO/RTO phù hợp.
- **Qdrant**: backup volume hoặc snapshot theo hướng dẫn Qdrant; khi mất vector có thể re-ingest tài liệu.

## CI / smoke

- GitHub Actions: job backend chạy Alembic + pytest (Postgres, Redis, Qdrant).
- Smoke cục bộ: `apps/api/scripts/run_smoke_integration.py` (cần DB đã migrate và Redis).

## GitHub Actions release/deploy

### Trạng thái hiện tại

- CI: `.github/workflows/ci.yml` chạy tự động khi push/PR (`main`, `develop`).
- Build image: `.github/workflows/deploy.yml` chạy khi push tag `v*` hoặc chạy tay.
- Deploy VPS: `.github/workflows/deploy-vps.yml` đang chạy **thủ công** (`workflow_dispatch`).
  - Từ TASK-05: workflow có thêm gate kiểm tra CI pass cho `git_ref` trước khi SSH deploy.
  - Sau deploy có health check bắt buộc: `/api/health`, `/api/health/detailed`, `widget.js`; nếu set `PROD_API_URL` sẽ smoke thêm endpoint public HTTPS.

### Luồng release production khuyến nghị

1. Merge vào `main`, chờ CI xanh.
2. Tạo tag release `vX.Y.Z` và push tag.
3. Chờ workflow build/push image thành công.
4. Chạy workflow deploy VPS với:
   - `git_ref = vX.Y.Z`
   - `run_migrations = true` (nếu release có migration)
5. Kiểm tra health endpoint và trạng thái PM2.

## Alerting & Observability (TASK-05)

### Mức độ cảnh báo

- `critical`: API down, DB connection fail, webhook lỗi xác thực hàng loạt.
- `high`: lỗi AI pipeline tăng đột biến, worker queue backlog vượt ngưỡng.
- `medium`: lỗi rải rác theo endpoint, retry tăng bất thường.

### Kênh cảnh báo

- Sentry Issues + Alerts (backend bắt buộc, web khuyến nghị).
- Kênh nhận alert: email on-call hoặc Slack/Teams webhook của đội vận hành.

### Rule gợi ý

- `critical`: >5 lỗi/5 phút cùng fingerprint `api.v1.payos_billing` hoặc `db.session`.
- `high`: tỷ lệ lỗi endpoint `/api/v1/chat` > 3% trong 10 phút.
- `medium`: tăng warning liên tục 30 phút cho cùng service.

### Kiểm tra sau deploy

1. `GET /api/health` trả `200`.
2. `GET /api/health/detailed` không degraded kéo dài.
3. Tạo 1 request webhook test (staging/sandbox) và kiểm tra không phát sinh error mới trên Sentry.

## Rollback Drill Checklist (TASK-05)

### Mục tiêu

- Thực hành rollback có kiểm soát để giảm MTTR khi release lỗi.

### Checklist diễn tập

1. Chạy deploy tới release mới bằng tag `vX.Y.Z`.
2. Xác nhận lỗi giả lập (hoặc scenario định trước) đủ điều kiện rollback.
3. Chạy lại workflow deploy VPS với `git_ref` là tag stable trước đó.
4. `run_migrations=false` nếu rollback chỉ ở tầng app code.
5. Xác nhận health checks + PM2 `online`.
6. Ghi biên bản: thời điểm detect lỗi, thời điểm bắt đầu rollback, thời điểm recovery.

### Biên bản tối thiểu

- `incident_id`
- `trigger`
- `owner`
- `mttd_seconds`
- `mttr_seconds`
- `root_cause_summary`
- `follow_up_actions`

### Luồng rollback nhanh

1. Chạy lại workflow deploy VPS.
2. Chọn `git_ref` là tag stable trước đó.
3. Đặt `run_migrations = false` nếu chỉ rollback app code.

### Secrets bắt buộc trên GitHub

- `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_PATH`
- `PROD_API_URL` (cho build web image)
- Khuyến nghị cấu hình qua GitHub Environment `production`.

## Khắc sự cố nhanh

| Triệu chứng             | Hướng xử lý                                                        |
| ----------------------- | ------------------------------------------------------------------ |
| 401/403 widget          | Kiểm tra `X-Widget-Key`, origin trong `tenant_allowed_origins`.    |
| RAG không trả kết quả   | `/api/health/detailed`, log Qdrant; thử upload lại / re-index.     |
| Text-to-SQL lỗi kết nối | Dashboard → Database: test connection; kiểm tra firewall DB khách. |
| Rate limit 429 admin    | Tạm điều chỉnh hoặc chờ window; xem `core/rate_limit.py`.          |
