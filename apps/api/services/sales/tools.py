from __future__ import annotations


SALES_TOOLS = [
    {
        "name": "search_products",
        "description": "Tìm kiếm sản phẩm theo từ khóa, giá, danh mục",
    },
    {"name": "render_product_card", "description": "Render UI product_cards"},
    {"name": "render_cart", "description": "Render UI cart hiện tại"},
    {"name": "render_order_form", "description": "Render form thu thập thông tin giao hàng"},
    {"name": "render_payment_selection", "description": "Render UI chọn phương thức thanh toán"},
    {"name": "render_order_confirmation", "description": "Render UI xác nhận đơn"},
    {"name": "save_lead", "description": "Mode C: lưu lead và notify"},
    {"name": "generate_checkout_link", "description": "Mode A: tạo checkout link"},
    {"name": "create_order_direct", "description": "Mode B: tạo đơn trực tiếp"},
    {"name": "query_order_status", "description": "Tra cứu trạng thái đơn hàng"},
    {"name": "escalate_to_human", "description": "Escalate cho nhân viên khi vượt khả năng bot"},
]


SALES_TOOL_NAMES = {tool["name"] for tool in SALES_TOOLS}


def ensure_tool_supported(tool_name: str) -> bool:
    return tool_name in SALES_TOOL_NAMES
