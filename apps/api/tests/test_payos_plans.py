"""Unit tests — core.payos_plans"""

from core.payos_plans import amount_vnd_for_plan, can_upgrade_to, plan_rank


def test_plan_rank_order():
    assert plan_rank("starter") < plan_rank("pro")
    assert plan_rank("pro") < plan_rank("enterprise")
    assert plan_rank("enterprise") < plan_rank("enterprise_pro")


def test_can_upgrade():
    assert can_upgrade_to("starter", "pro") is True
    assert can_upgrade_to("pro", "enterprise") is True
    assert can_upgrade_to("enterprise", "pro") is False
    assert can_upgrade_to("pro", "pro") is False


def test_amount_mapping():
    assert amount_vnd_for_plan("pro", 100, 200, 300) == 100
    assert amount_vnd_for_plan("enterprise", 100, 200, 300) == 200
    assert amount_vnd_for_plan("enterprise_pro", 100, 200, 300) == 300
    assert amount_vnd_for_plan("starter", 100, 200, 300) is None
