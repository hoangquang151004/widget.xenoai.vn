from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from services.sales.intent import classify_intent
from services.sales.prompts import build_system_prompt
from services.sales.tools import SALES_TOOLS, ensure_tool_supported


@dataclass
class AgentResponse:
    text: str
    ui_components: list[dict[str, Any]] = field(default_factory=list)
    slots_summary: dict[str, Any] = field(default_factory=dict)
    intent: str = "general"


class SalesAgent:
    """Adapter layer cho full tool-calling migration.

    Hiện tại dùng deterministic intent classification và giữ tương thích luồng MVP.
    """

    def __init__(self, bot_name: str = "Shop Assistant", action_mode: str = "lead", max_tool_rounds: int = 4):
        self.bot_name = bot_name
        self.action_mode = action_mode
        self.max_tool_rounds = max(1, max_tool_rounds)

    async def process(
        self,
        user_message: str,
        slots_summary: dict[str, Any] | None = None,
        form_fields: list[dict[str, Any]] | None = None,
    ) -> AgentResponse:
        intent = classify_intent(user_message)
        slots = slots_summary or {}
        _ = build_system_prompt(self.bot_name, self.action_mode, slots, form_fields=form_fields)
        suggested_tools = self._select_tools(intent)
        tool_events: list[dict[str, Any]] = []
        ui_components: list[dict[str, Any]] = []
        safe_mode_fallback = False

        for round_idx, tool_name in enumerate(suggested_tools[: self.max_tool_rounds], start=1):
            event = {"round": round_idx, "tool": tool_name, "ok": False}
            try:
                result = self._execute_tool(tool_name, intent, slots)
                event["ok"] = True
                event["result"] = result.get("result")
                if result.get("ui_component"):
                    ui_components.append(result["ui_component"])
            except Exception:
                # Agent không được throw lỗi kỹ thuật ra ngoài flow chat.
                event["result"] = "tool_error"
                safe_mode_fallback = True
                tool_events.append(event)
                break
            tool_events.append(event)

        text = self._default_text(intent)
        if safe_mode_fallback and not text:
            text = "Mình sẽ tiếp tục xử lý theo luồng an toàn để đảm bảo đơn hàng không bị gián đoạn."
        return AgentResponse(
            text=text,
            ui_components=ui_components,
            slots_summary={
                **slots,
                "suggested_tools": suggested_tools,
                "tool_count": len(SALES_TOOLS),
                "tool_events": tool_events,
                "agent_fallback": safe_mode_fallback,
            },
            intent=intent,
        )

    def _select_tools(self, intent: str) -> list[str]:
        mapping = {
            "product_search": ["search_products", "render_product_card"],
            "product_detail": ["search_products", "render_product_card"],
            "add_to_cart": ["render_cart"],
            "checkout": ["render_order_form", "render_payment_selection"],
            "order_status": ["query_order_status"],
            "cancel_order": ["escalate_to_human"],
            "complaint": ["escalate_to_human"],
        }
        return mapping.get(intent, [])

    def _default_text(self, intent: str) -> str:
        if intent in ("cancel_order", "complaint"):
            return "Mình sẽ chuyển yêu cầu của bạn cho nhân viên để hỗ trợ nhanh hơn."
        if intent == "checkout":
            return "Mình sẽ hỗ trợ bạn hoàn tất thông tin để đặt hàng."
        if intent == "product_search":
            return "Mình sẽ tìm sản phẩm phù hợp cho bạn."
        return ""

    def _execute_tool(self, tool_name: str, intent: str, slots: dict[str, Any]) -> dict[str, Any]:
        if not ensure_tool_supported(tool_name):
            raise ValueError("unsupported_tool")

        if tool_name == "render_order_form":
            return {"result": "render_form"}
        if tool_name == "render_payment_selection":
            return {"result": "render_payment"}
        if tool_name == "render_cart":
            return {"result": "render_cart"}
        if tool_name == "escalate_to_human":
            return {"result": "escalated"}
        if tool_name == "query_order_status":
            return {"result": "query_status"}
        if tool_name == "search_products":
            return {"result": f"search:{intent}"}
        if tool_name == "render_product_card":
            # Agent chỉ trả signal; render thật vẫn do chat_handler điều phối theo DB data.
            return {
                "result": "render_product_cards",
                "ui_component": {"type": "product_cards", "data": {"layout": "card", "products": []}},
            }
        if tool_name == "save_lead":
            return {"result": "save_lead"}
        if tool_name == "generate_checkout_link":
            return {"result": "generate_checkout_link"}
        if tool_name == "create_order_direct":
            return {"result": "create_order_direct"}
        if tool_name == "render_order_confirmation":
            return {"result": "render_order_confirmation"}
        return {"result": f"noop:{tool_name}", "slots": slots}
