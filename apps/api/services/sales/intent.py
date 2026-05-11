from __future__ import annotations

import re


INTENTS = {
    "product_search": "Người dùng muốn tìm/hỏi/xem sản phẩm",
    "product_detail": "Hỏi chi tiết một sản phẩm cụ thể",
    "compare": "So sánh nhiều sản phẩm",
    "add_to_cart": "Muốn đặt mua hoặc thêm vào giỏ",
    "checkout": "Muốn thanh toán hoặc xác nhận đơn",
    "order_status": "Hỏi trạng thái đơn",
    "complaint": "Khiếu nại về đơn/sản phẩm",
    "cancel_order": "Muốn hủy đơn",
    "general_info": "Hỏi thông tin chung/chính sách",
    "off_topic": "Ngoài phạm vi bán hàng",
}

_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("cancel_order", ("hủy đơn", "huy don", "hủy order", "cancel order")),
    ("order_status", ("trạng thái đơn", "tra cứu đơn", "kiem tra don", "order status")),
    ("checkout", ("thanh toán", "checkout", "xác nhận đơn", "confirm order")),
    ("add_to_cart", ("thêm vào giỏ", "them vao gio", "add to cart", "đặt mua", "dat mua")),
    ("compare", ("so sánh", "so sanh", "khác gì", "khac gi")),
    ("product_detail", ("chi tiết", "thông số", "thong so", "mô tả", "mo ta")),
    ("product_search", ("sản phẩm", "san pham", "catalog", "/shop", "shop:", "giá", "gia")),
    ("complaint", ("khiếu nại", "khieu nai", "phàn nàn", "lỗi đơn", "loi don")),
    ("general_info", ("chính sách", "doi tra", "đổi trả", "giao hàng", "bảo hành", "bao hanh")),
]


def classify_intent(message: str) -> str:
    q = (message or "").strip().lower()
    if not q:
        return "general_info"
    for intent, keywords in _RULES:
        if any(k in q for k in keywords):
            return intent
    # Nếu nội dung có vẻ là câu hỏi chung ngoài mua bán.
    if re.search(r"\b(thời tiết|chứng khoán|bóng đá|crypto|code|python)\b", q):
        return "off_topic"
    return "general_info"
