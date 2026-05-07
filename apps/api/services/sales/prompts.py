from __future__ import annotations

import json


def build_system_prompt(
    bot_name: str,
    action_mode: str,
    slots: dict,
    form_fields: list[dict] | None = None,
) -> str:
    enabled_fields = []
    for field in form_fields or []:
        if not isinstance(field, dict):
            continue
        if field.get("enabled", True):
            enabled_fields.append(
                {
                    "key": field.get("key"),
                    "required": bool(field.get("required")),
                }
            )

    return (
        f"Bạn là trợ lý bán hàng của {bot_name}.\n"
        f"Action mode hiện tại: {action_mode}.\n"
        "Quy tắc bắt buộc:\n"
        "- Chỉ tư vấn theo catalog có sẵn.\n"
        "- Không tự ý giảm giá hoặc hứa hẹn giao hàng khi không có dữ liệu.\n"
        "- Không tự ý sửa/hủy đơn đã xác nhận. Phải dùng tool escalate_to_human.\n"
        "- Khi thiếu thông tin bắt buộc, yêu cầu bổ sung đúng field đang bật.\n"
        "- Tool lỗi hoặc connector không hỗ trợ phải fallback an toàn, không lộ lỗi kỹ thuật.\n"
        f"Form fields đang bật: {json.dumps(enabled_fields, ensure_ascii=False)}\n"
        f"State slots hiện tại: {json.dumps(slots, ensure_ascii=False)}"
    )
