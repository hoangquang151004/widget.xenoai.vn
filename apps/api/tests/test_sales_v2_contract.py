"""Hợp đồng V2 — đảm bảo schema Pydantic parse được payload mẫu."""

from schemas.sales_v2_contract import (
    UIComponentProductCards,
    WidgetActionMessage,
)


def test_ui_component_product_cards_roundtrip():
    raw = {
        "type": "product_cards",
        "data": {
            "layout": "card",
            "products": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "external_id": "123",
                    "name": "Test",
                    "price": 100000,
                    "in_stock": True,
                    "images": [{"url": "https://x.test/a.jpg", "alt": "a"}],
                    "variants": [{"key": "size", "values": ["M"]}],
                }
            ],
        },
    }
    m = UIComponentProductCards.model_validate(raw)
    assert m.type == "product_cards"
    assert m.data.products[0].name == "Test"


def test_widget_action_message():
    m = WidgetActionMessage.model_validate(
        {
            "type": "action",
            "action": "add_to_cart",
            "data": {"product_id": "x", "quantity": 1},
        }
    )
    assert m.action == "add_to_cart"
