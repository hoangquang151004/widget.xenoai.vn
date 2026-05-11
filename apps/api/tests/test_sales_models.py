"""Sanity check ORM sales models (không cần DB)."""

from models.sales import PlatformConnector, Product, SalesOrder


def test_sales_order_tablename():
    assert SalesOrder.__tablename__ == "orders"


def test_platform_connector_mapper():
    assert PlatformConnector.__table__.c.credentials_enc.name == "credentials_enc"


def test_product_unique_constraint_name():
    names = {c.name for c in Product.__table__.constraints if c.name}
    assert "uq_products_tenant_platform_external" in names
