"""Redis slot state cho luồng đặt hàng trên chat."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from typing import Any, Optional

from core.redis_pool import get_redis_client


@dataclass
class SalesSlotState:
    cart_items: list[dict] = field(default_factory=list)
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    note: Optional[str] = None
    payment_method: Optional[str] = None
    step: str = "browse"  # browse | form | done

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v is not None or k == "cart_items"}

    @classmethod
    def from_dict(cls, d: dict) -> "SalesSlotState":
        return cls(
            cart_items=list(d.get("cart_items") or []),
            name=d.get("name"),
            phone=d.get("phone"),
            address=d.get("address"),
            email=d.get("email"),
            note=d.get("note"),
            payment_method=d.get("payment_method"),
            step=d.get("step") or "browse",
        )


def _key(tenant_id: str, session_id: str) -> str:
    return f"slot:{tenant_id}:{session_id}"


async def get_slot(tenant_id: str, session_id: str) -> SalesSlotState:
    client = get_redis_client()
    raw = await client.get(_key(tenant_id, session_id))
    if not raw:
        return SalesSlotState()
    try:
        return SalesSlotState.from_dict(json.loads(raw))
    except Exception:
        return SalesSlotState()


async def save_slot(tenant_id: str, session_id: str, state: SalesSlotState, ttl_sec: int = 3600) -> None:
    client = get_redis_client()
    await client.setex(_key(tenant_id, session_id), ttl_sec, json.dumps(state.to_dict(), ensure_ascii=False))
