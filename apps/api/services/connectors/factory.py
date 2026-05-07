"""Factory: PlatformConnector ORM -> implementation."""

from __future__ import annotations

from models.sales import PlatformConnector as PlatformConnectorModel
from services.connectors.base import ConnectorProtocol
from services.connectors.generic import GenericConnector
from services.connectors.shopify import ShopifyConnector
from services.connectors.woocommerce import WooCommerceConnector

CONNECTOR_MAP = {
    "woocommerce": WooCommerceConnector,
    "shopify": ShopifyConnector,
    "generic": GenericConnector,
}


def get_connector(row: PlatformConnectorModel) -> ConnectorProtocol:
    cls = CONNECTOR_MAP.get(row.platform)
    if not cls:
        raise ValueError(f"Unknown platform: {row.platform}")
    creds = row.credentials
    cfg = row.config if isinstance(row.config, dict) else {}
    return cls(credentials=creds, config=cfg)
