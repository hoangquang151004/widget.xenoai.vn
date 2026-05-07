"""
Hợp đồng JSON V2 — ui_components + action từ widget.
Đồng bộ với packages/types/src/sales-v2.ts và tasks/task_version_2/plan_v2.md.
Dùng làm nguồn chữ ký khi triển khai router sales; import tùy chọn để tránh vòng phụ thuộc.
"""

from __future__ import annotations

from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, Field


class ProductImage(BaseModel):
    url: str
    alt: Optional[str] = None


class ProductVariantDef(BaseModel):
    key: str
    values: list[str]


class ProductCardItem(BaseModel):
    id: str
    external_id: str
    name: str
    price: int
    compare_price: Optional[int] = None
    in_stock: bool
    stock_quantity: Optional[int] = None
    images: list[ProductImage] = Field(default_factory=list)
    variants: list[ProductVariantDef] = Field(default_factory=list)
    show_stock: bool = True
    show_rating: bool = False


class ProductCardsData(BaseModel):
    layout: Literal["card", "list"] = "card"
    products: list[ProductCardItem] = Field(default_factory=list)


class CartLineItem(BaseModel):
    product_id: str
    name: str
    price: int
    quantity: int
    variant_key: Optional[str] = None
    variant_value: Optional[str] = None
    line_total: int


class CartData(BaseModel):
    items: list[CartLineItem] = Field(default_factory=list)
    subtotal: int = 0
    primary_color: str = "#185FA5"


class OrderFormField(BaseModel):
    key: str
    label: str
    type: Literal["text", "tel", "email", "textarea"] = "text"
    required: bool = False
    prefilled: str = ""


class OrderFormData(BaseModel):
    fields: list[OrderFormField] = Field(default_factory=list)
    primary_color: str = "#185FA5"


class PaymentMethodOption(BaseModel):
    key: str
    label: str
    icon: str
    bank_info: Optional[dict[str, Any]] = None


class PaymentSelectionData(BaseModel):
    methods: list[PaymentMethodOption] = Field(default_factory=list)
    primary_color: str = "#185FA5"


class OrderConfirmationData(BaseModel):
    order_id: str
    external_order_id: Optional[str] = None
    items: list[CartLineItem] = Field(default_factory=list)
    subtotal: int = 0
    payment_method: str = ""
    estimated_delivery: Optional[str] = None
    primary_color: str = "#185FA5"


class CheckoutLinkData(BaseModel):
    url: str
    expires_minutes: int = 30
    subtotal: int = 0
    primary_color: str = "#185FA5"


class UIComponentProductCards(BaseModel):
    type: Literal["product_cards"] = "product_cards"
    data: ProductCardsData


class UIComponentCart(BaseModel):
    type: Literal["cart"] = "cart"
    data: CartData


class UIComponentOrderForm(BaseModel):
    type: Literal["order_form"] = "order_form"
    data: OrderFormData


class UIComponentPaymentSelection(BaseModel):
    type: Literal["payment_selection"] = "payment_selection"
    data: PaymentSelectionData


class UIComponentOrderConfirmation(BaseModel):
    type: Literal["order_confirmation"] = "order_confirmation"
    data: OrderConfirmationData


class UIComponentCheckoutLink(BaseModel):
    type: Literal["checkout_link"] = "checkout_link"
    data: CheckoutLinkData


SalesUIComponent = Union[
    UIComponentProductCards,
    UIComponentCart,
    UIComponentOrderForm,
    UIComponentPaymentSelection,
    UIComponentOrderConfirmation,
    UIComponentCheckoutLink,
]


class WidgetActionMessage(BaseModel):
    type: Literal["action"] = "action"
    action: Literal["add_to_cart", "submit_form", "confirm_order"]
    data: dict[str, Any] = Field(default_factory=dict)
