"""Unit tests — core.analytics_service helpers."""

from core.analytics_service import estimate_tokens_for_turn


def test_estimate_tokens_minimum_one():
    assert estimate_tokens_for_turn("", "") == 1


def test_estimate_tokens_sums_user_and_assistant_chars():
    # 8 chars user + 8 chars assistant => 2+2 = 4 tokens
    assert estimate_tokens_for_turn("12345678", "12345678") == 4
