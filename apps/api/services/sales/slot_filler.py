from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from typing import Any

from core.redis_pool import get_redis_client


@dataclass
class SlotExtractResult:
    name: str | None = None
    phone: str | None = None
    address: str | None = None
    email: str | None = None
    note: str | None = None


@dataclass
class OrderSlots:
    selected_products: list[dict[str, Any]] = field(default_factory=list)
    name: str | None = None
    phone: str | None = None
    address: str | None = None
    email: str | None = None
    note: str | None = None
    payment_method: str | None = None
    current_step: str = "product"
    confirmed: bool = False


class SlotFiller:
    def __init__(self, tenant_id: str, conversation_id: str):
        self.redis_key = f"slot:{tenant_id}:{conversation_id}"

    async def get_state(self) -> OrderSlots:
        client = get_redis_client()
        raw = await client.get(self.redis_key)
        if not raw:
            return OrderSlots()
        try:
            return OrderSlots(**json.loads(raw))
        except Exception:
            return OrderSlots()

    async def save_state(self, slots: OrderSlots):
        client = get_redis_client()
        await client.setex(self.redis_key, 3600, json.dumps(asdict(slots), ensure_ascii=False))

    async def extract_slots(self, message: str, slots: OrderSlots, form_fields: list[dict[str, Any]]) -> OrderSlots:
        q = (message or "").strip()
        enabled = {str(f.get("key")) for f in form_fields if isinstance(f, dict) and f.get("enabled", True)}
        if "name" in enabled and not slots.name:
            m = re.search(r"(?:tôi là|toi la|mình là|ten la)\s+([^\.,;\n]+)", q, re.I)
            if m:
                slots.name = m.group(1).strip()
        if "phone" in enabled and not slots.phone:
            m = re.search(r"\b(0\d{8,10})\b", q)
            if m:
                slots.phone = m.group(1)
        if "email" in enabled and not slots.email:
            m = re.search(r"([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})", q, re.I)
            if m:
                slots.email = m.group(1)
        if "address" in enabled and not slots.address and ("địa chỉ" in q.lower() or "dia chi" in q.lower()):
            m = re.search(r"(?:địa chỉ|dia chi)\s*[:\-]?\s*([^\n]+)", q, re.I)
            if m:
                slots.address = m.group(1).strip()
        if "note" in enabled and not slots.note and ("ghi chú" in q.lower() or "ghi chu" in q.lower()):
            m = re.search(r"(?:ghi chú|ghi chu)\s*[:\-]?\s*([^\n]+)", q, re.I)
            if m:
                slots.note = m.group(1).strip()
        return slots

    def get_missing_required_fields(self, slots: OrderSlots, form_fields: list[dict[str, Any]]) -> list[str]:
        missing: list[str] = []
        for field in form_fields:
            if not isinstance(field, dict):
                continue
            if not field.get("enabled", True) or not field.get("required", False):
                continue
            key = str(field.get("key") or "")
            if not key:
                continue
            value = getattr(slots, key, None)
            if value in (None, ""):
                missing.append(key)
        return missing


def extract_slots_from_action(data: dict[str, Any]) -> SlotExtractResult:
    return SlotExtractResult(
        name=(data.get("name") or None),
        phone=(data.get("phone") or None),
        address=(data.get("address") or None),
        email=(data.get("email") or None),
        note=(data.get("note") or None),
    )
