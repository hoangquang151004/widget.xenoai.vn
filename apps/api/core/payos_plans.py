"""Map gói DB ↔ số tiền PayOS (VND) và thứ tự nâng cấp."""

from __future__ import annotations

from typing import Optional

from core.plan_limits import normalize_plan

# Thứ tự tăng dần — chỉ cho phép nâng cấp lên gói có rank cao hơn
_PLAN_RANK: dict[str, int] = {
    "starter": 0,
    "pro": 1,
    "enterprise": 2,
    "enterprise_pro": 3,
}


def plan_rank(plan: str) -> int:
    return _PLAN_RANK.get(normalize_plan(plan), 0)


def can_upgrade_to(current: str, target: str) -> bool:
    return plan_rank(target) > plan_rank(current)


def amount_vnd_for_plan(
    target: str,
    amount_pro: int,
    amount_enterprise: int,
    amount_enterprise_pro: int,
) -> Optional[int]:
    """Trả về None nếu không hỗ trợ thanh toán PayOS cho gói đó."""
    p = normalize_plan(target)
    if p == "pro":
        return amount_pro
    if p == "enterprise":
        return amount_enterprise
    if p == "enterprise_pro":
        return amount_enterprise_pro
    return None
