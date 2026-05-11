import pytest

from services.sales.agent import SalesAgent
from services.sales.intent import classify_intent
from services.sales.slot_filler import OrderSlots, SlotFiller


def test_classify_intent_product_search():
    assert classify_intent("cho mình xem sản phẩm áo thun") == "product_search"


def test_classify_intent_cancel_order():
    assert classify_intent("mình muốn hủy đơn #123") == "cancel_order"


@pytest.mark.asyncio
async def test_sales_agent_process_returns_intent():
    agent = SalesAgent()
    out = await agent.process("tôi muốn thanh toán")
    assert out.intent == "checkout"
    assert "suggested_tools" in out.slots_summary
    assert out.slots_summary.get("tool_count") == 11
    assert isinstance(out.slots_summary.get("tool_events"), list)


@pytest.mark.asyncio
async def test_sales_agent_process_checkout_suggests_form_tools():
    agent = SalesAgent(bot_name="Bot A", action_mode="lead")
    out = await agent.process("cho mình checkout luôn", {"step": "cart"})
    assert out.intent == "checkout"
    assert "render_order_form" in out.slots_summary.get("suggested_tools", [])


@pytest.mark.asyncio
async def test_sales_agent_fallback_when_tool_plan_invalid(monkeypatch):
    agent = SalesAgent()
    monkeypatch.setattr(agent, "_select_tools", lambda _intent: ["tool_unknown"])
    out = await agent.process("xin tư vấn sản phẩm")
    assert out.slots_summary.get("agent_fallback") is True


@pytest.mark.asyncio
async def test_slot_filler_extract_and_missing_fields(monkeypatch):
    memory: dict[str, str] = {}

    class _RedisFake:
        async def get(self, key):  # noqa: ANN001
            return memory.get(key)

        async def setex(self, key, ttl, value):  # noqa: ANN001
            memory[key] = value

    monkeypatch.setattr("services.sales.slot_filler.get_redis_client", lambda: _RedisFake())
    filler = SlotFiller("t1", "s1")
    state = await filler.get_state()
    assert isinstance(state, OrderSlots)
    fields = [
        {"key": "name", "required": True, "enabled": True},
        {"key": "phone", "required": True, "enabled": True},
        {"key": "address", "required": True, "enabled": True},
        {"key": "email", "required": False, "enabled": True},
    ]
    state = await filler.extract_slots("Tôi là Nam, sdt 0909123456, địa chỉ: Hà Nội", state, fields)
    missing = filler.get_missing_required_fields(state, fields)
    assert state.phone == "0909123456"
    assert "address" not in missing
    await filler.save_state(state)
    restored = await filler.get_state()
    assert restored.phone == "0909123456"
