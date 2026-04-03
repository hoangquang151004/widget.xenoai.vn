# Trạng thái Dự án - Cập nhật 02/04/2026

## 1. Trạng thái hệ thống hiện tại

- Backend FastAPI đang chạy ổn định tại cổng 8001.
- Celery worker đang chạy ổn định với Redis broker.
- Frontend Next.js đang chạy ở cổng 3000.
- Kiến trúc vector runtime đã rollback thành công về Qdrant.

## 2. Kết quả đã xác nhận

### 2.1 Rollback RAG về Qdrant (Hoàn thành)

- Đã khôi phục luồng ingest/search/delete vectors qua Qdrant.
- Health check detailed trả về đủ: `postgresql=ok`, `redis=ok`, `qdrant=ok`.
- Các script vận hành liên quan vector store đã đồng bộ lại theo Qdrant.

### 2.2 E2E Upload (Hoàn thành)

- Đã chạy luồng end-to-end theo auth Bearer:
  - Register tenant
  - Login lấy token
  - Upload file
  - Polling trạng thái async (`processing -> done`)
  - List documents
  - Delete document
- Kết quả: PASS.

## 3. Công việc đang làm

- Đồng bộ tài liệu tiến độ và task list theo thực trạng PostgreSQL + Qdrant.
- Hoàn thiện checklist verification còn lại trong Phase 5:
  - Chat stream regression
  - Frontend integration verification (settings/keys)

## 4. Rủi ro hiện tại

- Sai lệch dữ liệu vector ở các tenant đã từng đi qua nhánh pgvector.
- Cần re-index tài liệu từ nguồn gốc khi triển khai môi trường mới hoặc cutover.

## 5. Hành động tiếp theo

1. Chạy tiếp regression test cho `/api/v1/chat/stream`.
2. Chạy kiểm tra frontend cho trang Settings và Keys với API thật.
3. Chốt cập nhật tài liệu tiến độ ở toàn bộ thư mục `docs/`.

---

**Người cập nhật**: GitHub Copilot
