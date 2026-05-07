"""Giao thức connector nền tảng thương mại (WooCommerce / Shopify / generic)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ProductData:
    external_id: str
    name: str
    description: str
    price: Optional[int]
    compare_price: Optional[int]
    sku: Optional[str]
    stock_quantity: Optional[int]
    in_stock: bool
    images: list[dict] = field(default_factory=list)
    variants: list[dict] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    category: Optional[str] = None
    raw_data: dict = field(default_factory=dict)


@dataclass
class OrderPayload:
    customer_name: str
    customer_phone: str
    customer_address: str
    customer_email: Optional[str]
    items: list[dict]
    note: Optional[str]
    payment_method: str


@dataclass
class OrderResult:
    success: bool
    external_order_id: Optional[str] = None
    external_order_url: Optional[str] = None
    error: Optional[str] = None


@dataclass
class CartLinkResult:
    url: str
    expires_at: Optional[str] = None


class ConnectorProtocol(ABC):
    def __init__(self, credentials: dict, config: dict):
        self.credentials = credentials
        self.config = config

    @abstractmethod
    async def test_connection(self) -> tuple[bool, str]:
        """Returns (ok, error_message)."""

    @abstractmethod
    async def fetch_products(self, page: int = 1, per_page: int = 100) -> list[ProductData]:
        """Fetch one page of products."""

    @abstractmethod
    async def get_product(self, external_id: str) -> Optional[ProductData]:
        """Single product by platform id."""

    @abstractmethod
    async def generate_cart_link(self, items: list[dict]) -> CartLinkResult:
        """Pre-filled cart URL (Mode A)."""

    @abstractmethod
    async def create_order(self, payload: OrderPayload) -> OrderResult:
        """Create remote order (Mode B)."""

    @abstractmethod
    async def get_order_status(self, external_order_id: str) -> Optional[dict]:
        """Remote order status snapshot."""
