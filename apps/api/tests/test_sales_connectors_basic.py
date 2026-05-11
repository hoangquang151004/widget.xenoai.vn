import pytest

from services.connectors.base import OrderPayload, UnsupportedOperation
from services.connectors.generic import GenericConnector
from services.connectors.shopify import ShopifyConnector
from services.connectors.woocommerce import WooCommerceConnector


@pytest.mark.asyncio
async def test_woocommerce_generate_cart_link_single_item():
    conn = WooCommerceConnector(
        credentials={
            "site_url": "https://shop.test",
            "consumer_key": "ck",
            "consumer_secret": "cs",
        },
        config={},
    )
    res = await conn.generate_cart_link([{"external_id": "123", "quantity": 2}])
    assert "add-to-cart=123" in res.url
    assert "quantity=2" in res.url


@pytest.mark.asyncio
async def test_shopify_generate_cart_link_multi_items():
    conn = ShopifyConnector(
        credentials={"shop_domain": "myshop", "access_token": "tok"},
        config={},
    )
    res = await conn.generate_cart_link(
        [{"external_id": "111", "quantity": 1}, {"external_id": "222", "quantity": 3}]
    )
    assert "/cart/111:1,222:3" in res.url


@pytest.mark.asyncio
async def test_generic_fetch_products_field_mapping(monkeypatch):
    conn = GenericConnector(
        credentials={"base_url": "https://api.shop", "auth_value": "tok"},
        config={
            "products_endpoint": "/products",
            "product_id_field": "pid",
            "product_name_field": "pname",
            "product_price_field": "pprice",
            "product_stock_field": "pstock",
        },
    )

    class _Resp:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return [{"pid": "a1", "pname": "Ao thun", "pprice": 120000, "pstock": 5}]

    async def _fake_request(method, url, **kwargs):  # noqa: ARG001
        return _Resp()

    monkeypatch.setattr(conn, "_request", _fake_request)
    rows = await conn.fetch_products()
    assert len(rows) == 1
    assert rows[0].external_id == "a1"
    assert rows[0].name == "Ao thun"
    assert rows[0].price == 120000


@pytest.mark.asyncio
async def test_generic_create_order_requires_endpoint():
    conn = GenericConnector(
        credentials={"base_url": "https://api.shop", "auth_value": "tok"},
        config={},
    )
    res = await conn.create_order(
        OrderPayload(
            customer_name="A",
            customer_phone="0909",
            customer_address="HN",
            customer_email=None,
            items=[{"external_id": "p1", "quantity": 1}],
            note=None,
            payment_method="cod",
        )
    )
    assert res.success is False
    assert "order_endpoint" in (res.error or "")


@pytest.mark.asyncio
async def test_generic_generate_cart_link_raises_unsupported():
    conn = GenericConnector(
        credentials={"base_url": "https://api.shop", "auth_value": "tok"},
        config={},
    )
    with pytest.raises(UnsupportedOperation):
        await conn.generate_cart_link([{"external_id": "1", "quantity": 1}])


@pytest.mark.asyncio
async def test_wc_test_connection_bad_credentials(monkeypatch):
    conn = WooCommerceConnector(
        credentials={"site_url": "https://shop.test", "consumer_key": "bad", "consumer_secret": "bad"},
        config={},
    )

    class _Resp:
        status_code = 401
        text = "unauthorized"

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return False

        async def get(self, *args, **kwargs):  # noqa: ANN001
            return _Resp()

    monkeypatch.setattr("services.connectors.woocommerce.httpx.AsyncClient", lambda timeout=20.0: _Client())
    ok, err = await conn.test_connection()
    assert ok is False
    assert "Sai consumer_key/consumer_secret" in err


@pytest.mark.asyncio
async def test_wc_fetch_products_passes_pagination_params(monkeypatch):
    conn = WooCommerceConnector(
        credentials={"site_url": "https://shop.test", "consumer_key": "ck", "consumer_secret": "cs"},
        config={},
    )
    seen = {}

    class _Resp:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return []

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return False

        async def get(self, url, params):  # noqa: ANN001
            seen["url"] = url
            seen["params"] = params
            return _Resp()

    monkeypatch.setattr("services.connectors.woocommerce.httpx.AsyncClient", lambda timeout=60.0: _Client())
    rows = await conn.fetch_products(page=3, per_page=50)
    assert rows == []
    assert "products" in seen["url"]
    assert seen["params"]["page"] == 3
    assert seen["params"]["per_page"] == 50


@pytest.mark.asyncio
async def test_shopify_create_order_payload_mapping(monkeypatch):
    conn = ShopifyConnector(
        credentials={"shop_domain": "myshop", "access_token": "tok"},
        config={},
    )
    captured = {}

    class _Resp:
        status_code = 201

        def json(self):
            return {"order": {"id": 999, "order_status_url": "https://myshop/orders/999"}}

        text = "ok"

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return False

        async def post(self, url, headers, json):  # noqa: ANN001
            captured["url"] = url
            captured["headers"] = headers
            captured["json"] = json
            return _Resp()

    monkeypatch.setattr("services.connectors.shopify.httpx.AsyncClient", lambda timeout=45.0: _Client())
    out = await conn.create_order(
        OrderPayload(
            customer_name="Nguyen A",
            customer_phone="0909",
            customer_address="HN",
            customer_email="a@example.com",
            items=[{"external_id": "12345", "quantity": 2}],
            note="ghi chu",
            payment_method="cod",
        )
    )
    assert out.success is True
    assert out.external_order_id == "999"
    line_item = captured["json"]["order"]["line_items"][0]
    assert line_item["variant_id"] == 12345
    assert line_item["quantity"] == 2
