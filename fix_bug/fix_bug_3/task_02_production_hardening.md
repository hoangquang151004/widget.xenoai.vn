# TASK-02: Production Hardening & SSL

## 1. Vấn đề
Dự án hiện đang chạy trên Docker Compose với cấu hình mặc định, chưa phù hợp để expose ra internet:
- Chưa có SSL (HTTPS) cho cả API và Dashboard — **cần domain + Certbot trên server thật** (đã có hướng dẫn và file mẫu trong repo).
- **Rate limiting:** Đã có giới hạn theo **tenant + loại key** (Redis) + **bổ sung limit theo IP tại Nginx** cho `/api/`.
- Nginx đã tối ưu: header bảo mật, `server_tokens off`, gzip, zone rate limit.

## 2. Mục tiêu
- Production-ready: TLS tại Nginx, header, tách env dev/prod (file mẫu).
- Widget qua HTTPS: cấu hình DNS + chứng chỉ + `NEXT_PUBLIC_API_URL` / origins.

## 3. Các bước thực hiện
1. **SSL:** Xem [docs/PRODUCTION_RUNBOOK.md](../../docs/PRODUCTION_RUNBOOK.md) (Certbot, renew, volume cert); [nginx/nginx-https.example.conf](../../nginx/nginx-https.example.conf), [nginx/snippets/ssl-https.conf](../../nginx/snippets/ssl-https.conf).
2. **Nginx:** [nginx/nginx.conf](../../nginx/nginx.conf) + [nginx/snippets/security-headers.conf](../../nginx/snippets/security-headers.conf); `docker-compose` mount `snippets/`.
3. **Rate limiting:** Redis + tenant (API) + Nginx `limit_req` trên `/api/`.
4. **Environment:** `apps/api/.env.development.example`, `.env.production.example`; `apps/web/.env.development.example`, `.env.production.example`; `.env.docker.production.example` (gốc repo).

## 4. Định nghĩa hoàn thành (DoD)
- [ ] HTTPS không lỗi chứng chỉ — **xác nhận trên server sau khi gắn domain** (quy trình trong runbook).
- [x] API 429 khi vượt rate limit (tenant/key **và** có thể ở Nginx theo IP cho `/api/`).
- [x] Nginx: header bảo mật, `server_tokens off`, giới hạn tần suất IP; HSTS trong snippet **khi** bật HTTPS.
- [ ] Điểm A trên ssl labs / observatory — **kiểm tra thủ công** sau TLS + CSP tùy chỉnh.
