# Implementation Plan — Widget Chatbot (tổng hợp)

> **Cập nhật:** 2026-04-03  
> **Mục đích:** Một nguồn kế hoạch chính, khớp với [PROGRESS.md](PROGRESS.md), [docs/TRANG_THAI_DU_AN.md](docs/TRANG_THAI_DU_AN.md), CI và code thực tế.  
> **Quy trình:** Mọi **phase mới** cần chủ sở hữu phản hồi **"Duyệt"** trước khi merge thay đổi lớn (theo [AGENTS.md](AGENTS.md)).

---

## 1) Tổng quan trạng thái (snapshot)

| Lớp | Trạng thái | Ghi chú |
|-----|------------|---------|
| Schema v2 + Alembic | Hoàn thành | `tenants` đã cleanup legacy; head migration theo repo |
| Admin API + Dashboard | Hoàn thành | Settings, Keys, KB, Database page, `useApi` |
| Widget SDK + chat/stream | Hoàn thành | Qdrant RAG, middleware 2-key |
| CI backend | Hoàn thành | [`.github/workflows/ci.yml`](.github/workflows/ci.yml): Ruff, Alembic, pytest, Postgres + Redis + Qdrant |
| Pytest tích hợp DB + schema SQL | Có | [`tests/test_admin_database_integration.py`](apps/api/tests/test_admin_database_integration.py), smoke: [`scripts/run_smoke_integration.py`](apps/api/scripts/run_smoke_integration.py) |
| **AI Orchestrator / RAG query** | **Hoàn thành (Phase 6)** | `settings_loader`, hybrid Qdrant, `system_prompt` từ DB — xem mục 2 |
| Text-to-SQL E2E khách production | Chưa đủ | Introspection schema đã test; cần LLM + DB khách thật |

**Tham chiếu kỹ thuật (không đổi trong .env theo AGENTS.md):** `GEMINI_MODEL`, `EMBEDDING_MODEL`, `EMBEDDING_DIM` — dense vector Qdrant dùng `settings.EMBEDDING_DIM` (vd. 3072), **không** dùng mô tả 768d trong tài liệu cũ.

---

## 2) Phase 6 — AI Engine (**đã triển khai** 2026-04-03)

**Spec gốc:** [`fix_bug/fig_bug_2/`](fix_bug/fig_bug_2/)

| ID | Nội dung | Code |
|----|-----------|------|
| BUG-AI-01 | Node `settings_loader` + `route_by_intent` tôn trọng `is_rag_enabled` / `is_sql_enabled` | [`apps/api/ai/orchestrator.py`](apps/api/ai/orchestrator.py) |
| BUG-AI-02 | Hybrid: `Prefetch` dense + `bm25` + `FusionQuery(RRF)`; fallback `_dense_only_search` (có `RAG_SIMILARITY_THRESHOLD`) | [`apps/api/ai/vector_store.py`](apps/api/ai/vector_store.py) |
| BUG-AI-03 | `system_prompt` từ `tenant_ai_settings` → `general_node` + context RAG | [`orchestrator.py`](apps/api/ai/orchestrator.py), [`rag_agent.py`](apps/api/ai/rag_agent.py) |

**Nghiệm thu khuyến nghị (thủ công):** PATCH `/ai-settings` tắt RAG/SQL rồi chat; đổi system prompt và kiểm tra câu trả lời.

**Lưu ý:** Điểm **RRF** không lọc bằng `RAG_SIMILARITY_THRESHOLD` (chỉ áp cho tìm dense-only).

**Sau Phase 6 (launch — trùng Priority 1 trong TRANG_THAI):**

- Regression Text-to-SQL với **DB khách thật** (schema lớn, LLM sinh SQL, chỉ SELECT).
- Bổ sung E2E frontend (Playwright) nếu cần; hiện CI đã có build web + pytest backend.

**Backlog (không chặn Phase 6):** PayOS (thanh toán), admin multi-tenant panel, RAG history-aware (TASK-06), polish Billing/Analytics.

---

## 3) Đồng bộ tài liệu `fix_bug/fig_bug_2`

- Khi bắt đầu Phase 6: cập nhật [`fix_bug/fig_bug_2/PROGRESS.md`](fix_bug/fig_bug_2/PROGRESS.md) và [`fix_bug/fig_bug_2/AGENTS.md`](fix_bug/fig_bug_2/AGENTS.md) — đường dẫn task → `fix_bug/fig_bug_2/…`; bỏ hoặc làm rõ các dòng `task_phase_6_*` nếu chưa có file tương ứng.
- % tiến độ trong `fig_bug_2/PROGRESS.md` nên tham chiếu [docs/TRANG_THAI_DU_AN.md](docs/TRANG_THAI_DU_AN.md) để tránh lệch (~80% vs ~91%).

---

## 4) Lịch sử — Đã hoàn thành (chỉ tham chiếu)

Các kế hoạch dưới đây **đã triển khai**; giữ lại để audit. Chi tiết verify: [tasks/task_phase_5.md](tasks/task_phase_5.md), [task.md](task.md).

---

### 4.1 Implementation Plan — Dashboard Database (đã xong)

> Ngày: 2026-04-03 | Trạng thái: Đã triển khai

**Mục tiêu:** Nối [`apps/web/src/app/(dashboard)/dashboard/database/page.tsx`](apps/web/src/app/(dashboard)/dashboard/database/page.tsx) với `GET/POST /api/v1/admin/database`, `POST .../test`.

**Đã làm:** Client component, form, load config, test connection, lưu, validate, mask password, preview trạng thái kết nối (không introspection bảng/cột trên UI).

**Nghiệm thu:** Load / test / save + refresh; không mock field DB; TypeScript sạch.

---

### 4.2 Implementation Plan — Migration cleanup cột legacy `tenants` (đã xong)

> Ngày: 2026-04-03 | Trạng thái: Đã triển khai

**Mục tiêu:** Xóa cột/index legacy trên `tenants`; register + seed theo schema v2.

**Kết quả:** Revision [`f2a4d1c7b9e0_cleanup_legacy_tenants_columns.py`](apps/api/db/alembic/versions/f2a4d1c7b9e0_cleanup_legacy_tenants_columns.py); model `Tenant` tinh gọn; [`admin.py`](apps/api/api/v1/admin.py) register không slug/keys trên `tenants`; scripts seed cập nhật.

**Nghiệm thu:** `alembic upgrade head`; `tenants` chỉ cột core; register/login/me OK.

---

## 5) Lệnh kiểm tra nhanh (dev)

```bash
# Backend tests (cần Postgres + Redis; Qdrant nếu chạy test RAG isolation)
cd apps/api
.venv/Scripts/python -m pytest tests/ -q

# Smoke tích hợp DB + schema Text-to-SQL
.venv/Scripts/python scripts/run_smoke_integration.py
```

---

**Bước tiếp theo được đề xuất:** Chờ **"Duyệt"** Phase 6, sau đó triển khai BUG-AI-01 → BUG-AI-02 → BUG-AI-03 theo spec trong `fix_bug/fig_bug_2/`.
