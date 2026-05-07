# Implementation Plan — Tách task theo phase cho upgrade Mode C

## Mục tiêu
- Tách checklist trong `tasks/task_v2_upgrade/PROGRESS.md` thành các task con thực thi được.
- Lưu theo từng phase để đội triển khai và QA bám theo checklist rõ ràng.

## Phạm vi file sẽ tạo
- `tasks/task_v2_upgrade/task.md` (index tổng hợp)
- `tasks/task_v2_upgrade/P0/task.md`
- `tasks/task_v2_upgrade/P1/task.md`
- `tasks/task_v2_upgrade/P4/task.md`
- `tasks/task_v2_upgrade/P2/task.md`
- `tasks/task_v2_upgrade/release_gate/task.md`

## Nguyên tắc chia task
- Mỗi task có mục tiêu đơn, acceptance rõ, và nhóm test cần chạy.
- Bám sát `PROGRESS.md` + `tasks/task_v2_upgrade/AGENTS.md`.
- Không mở rộng scope ngoài lộ trình P0/P1/P4/P2/Release gate.

## Kết quả mong đợi
- Có bộ task.md theo phase đủ để triển khai tuần tự và kiểm soát tiến độ upgrade Mode C production-ready.
