# Project Status — Widget Chatbot

_Cập nhật: 2026-05-07_

## Tổng quan

Dự án đang ở giai đoạn hoàn thiện V2 sales. Nền tảng backend, connector, sync, SDK và chiến dịch QA nền đã có; các phần còn lại tập trung vào hardening production cho API/notify và hoàn thiện parity frontend settings.

## Trạng thái theo phase (V2)

- **P1 Database Schema:** ✅ Hoàn thành
- **P2 Platform Connectors:** ✅ Hoàn thành
- **P3 Celery Sync Tasks:** ✅ Hoàn thành nền
- **P4 Sales Agent & Slot Filling:** 🔄 Đang làm (còn full LLM tool-calling)
- **P5 API Endpoints Backend:** 🔄 Đang làm (còn lệch một số contract + coverage)
- **P6 Notify & Webhook Outbound:** 🔄 Đang làm (còn outbound email/webhook end-to-end)
- **P7 Widget SDK nâng cấp:** ✅ Hoàn thành mốc
- **P8 Admin Dashboard Frontend:** 🔄 Đang làm (còn save/dirty state cho sales settings)
- **P9 QA & Integration:** ✅ Hoàn thành campaign nền (A-E + security + baseline)

## Kết quả kiểm tra gần nhất

### Backend
- `apps/api/.venv/Scripts/python.exe -m pytest tests/test_sales_p9_qa.py -v` -> **8 passed**
- `apps/api/.venv/Scripts/python.exe -m pytest tests/ -k sales -v` -> **38 passed**

### Frontend Web
- `npm run test` -> **pass**
- `npm run lint` -> **pass**
- `npm run build` -> **pass**

### Widget SDK
- `npm run test` -> **pass**
- `npm run build` -> **pass**
- Build artifact: `dist/widget.js` **35.92 kB** (gzip **11.64 kB**)

## Các hạng mục còn mở quan trọng

1. Hoàn thiện P6 notify outbound production-ready (email/webhook end-to-end).
2. Chốt contract API còn lệch trong P5 + tăng test coverage.
3. Hoàn thiện P8 phần save/dirty state theo nhóm trong sales settings.
4. Chạy lại toàn bộ checklist P9 trên staging thật để đạt release gate production.

## Tài liệu tham chiếu nhanh

- `tasks/plan_v2/PROGRESS.md`
- `tasks/plan_v2/task.md`
- `tasks/plan_v2/p9_qa_report.md`
