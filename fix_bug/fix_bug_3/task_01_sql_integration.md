# TASK-01: SQL Agent Integration & Guarding

## 1. Vấn đề
Hiện tại SQL Agent đã có pipeline cơ bản nhưng việc tích hợp vào Orchestrator cần được củng cố:
- Nếu khách bật `is_sql_enabled` nhưng chưa điền DB credentials, hệ thống có thể bị crash hoặc trả lỗi không thân thiện.
- Pipeline Text-to-SQL cần được tối ưu để hiểu đúng schema đặc thù của từng tenant.

## 2. Mục tiêu
- **Guarding:** Orchestrator phải tự động bỏ qua SQL Node nếu thiếu cấu hình DB, bất kể flag `is_sql_enabled` có bật hay không.
- **Reliability:** Đảm bảo SQL Agent hoạt động ổn định với các database PostgreSQL/MySQL từ xa của khách hàng.

## 3. Các bước thực hiện
1. [x] `orchestrator.py`: Kiểm tra bản ghi `tenant_databases` **active** + `resolve_sql_route_state`; `general_node` thông báo khi intent SQL nhưng không dùng được SQL — `tests/test_orchestrator_sql_guard.py`.
2. [x] `ai/sql/generator.py`: Prompt theo **dialect** (`schema.dialect` từ inspect engine), mục [SCHEMA PHỨC TẠP] (JOIN/FK, aggregate, ngày giờ theo dialect).
3. [x] `ai/sql/__init__.py` (`run_text_to_sql`): Log INFO/WARNING/DEBUG theo từng bước (schema, generate, execute, success); SQL sinh ra ở mức DEBUG.
4. [x] `sql_agent.py`: Log đầu pipeline; lỗi không bắt được → thông báo chung + `logger.exception`.
5. [x] Test tích hợp (mock): schema lỗi không gọi generate; happy path; `SQLAgent.arun` — `tests/test_task01_sql_pipeline.py`. Gợi ý dialect: `tests/test_sql_generator_dialect.py`.

## 4. Định nghĩa hoàn thành (DoD)
- [x] Không vào `sql_node` khi thiếu cấu hình DB (hoặc gói/tắt SQL).
- [x] Intent SQL nhưng chưa cấu hình DB: thông báo hướng dẫn trên Dashboard (qua `general_node`).
- [x] Unit test `resolve_sql_route_state`.
- [x] Pipeline có log debug được; prompt SQL hỗ trợ schema phức tạp + PostgreSQL/MySQL.
- [x] Test mock pipeline (lỗi vs thành công).
