"""v2_sales_schema: sales_enabled, widget sales columns, connectors, products, orders

Revision ID: f3a4b5c6d7e8
Revises: d1e2f3a4b5c6
Create Date: 2026-05-06

"""
from __future__ import annotations

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, Sequence[str], None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Default form_fields (JSON) — đồng bộ spec plan V2
_DEFAULT_FORM_FIELDS = [
    {"key": "name", "label": "Họ và tên", "type": "text", "required": True, "enabled": True, "order": 1},
    {"key": "phone", "label": "Số điện thoại", "type": "tel", "required": True, "enabled": True, "order": 2},
    {"key": "address", "label": "Địa chỉ giao hàng", "type": "text", "required": True, "enabled": True, "order": 3},
    {"key": "email", "label": "Email", "type": "email", "required": False, "enabled": False, "order": 4},
    {"key": "note", "label": "Ghi chú", "type": "textarea", "required": False, "enabled": True, "order": 5},
]

_DEFAULT_PAYMENT_METHODS = {"cod": True, "bank_transfer": False, "momo": False, "vnpay": False}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names(schema="public"))

    if "tenants" in tables:
        tc = {c["name"] for c in inspector.get_columns("tenants", schema="public")}
        if "sales_enabled" not in tc:
            op.add_column(
                "tenants",
                sa.Column(
                    "sales_enabled",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.text("false"),
                ),
            )
            op.alter_column("tenants", "sales_enabled", server_default=None)

    if "tenant_widget_configs" in tables:
        wc = {c["name"] for c in inspector.get_columns("tenant_widget_configs", schema="public")}
        if "font_family" not in wc:
            op.add_column(
                "tenant_widget_configs",
                sa.Column("font_family", sa.String(length=20), nullable=False, server_default="sans"),
            )
            op.alter_column("tenant_widget_configs", "font_family", server_default=None)
        if "product_layout" not in wc:
            op.add_column(
                "tenant_widget_configs",
                sa.Column("product_layout", sa.String(length=10), nullable=False, server_default="card"),
            )
            op.alter_column("tenant_widget_configs", "product_layout", server_default=None)
        if "show_stock" not in wc:
            op.add_column(
                "tenant_widget_configs",
                sa.Column("show_stock", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            )
            op.alter_column("tenant_widget_configs", "show_stock", server_default=None)
        if "show_rating" not in wc:
            op.add_column(
                "tenant_widget_configs",
                sa.Column("show_rating", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            )
            op.alter_column("tenant_widget_configs", "show_rating", server_default=None)

        form_json = json.dumps(_DEFAULT_FORM_FIELDS, ensure_ascii=False)
        form_sql_literal = form_json.replace("'", "''")
        if "form_fields" not in wc:
            op.add_column(
                "tenant_widget_configs",
                sa.Column(
                    "form_fields",
                    postgresql.JSONB(astext_type=sa.Text()),
                    nullable=False,
                    server_default=sa.text(f"'{form_sql_literal}'::jsonb"),
                ),
            )
            op.alter_column("tenant_widget_configs", "form_fields", server_default=None)

        pay_json = json.dumps(_DEFAULT_PAYMENT_METHODS, ensure_ascii=False).replace("'", "''")
        if "payment_methods" not in wc:
            op.add_column(
                "tenant_widget_configs",
                sa.Column(
                    "payment_methods",
                    postgresql.JSONB(astext_type=sa.Text()),
                    nullable=False,
                    server_default=sa.text(f"'{pay_json}'::jsonb"),
                ),
            )
            op.alter_column("tenant_widget_configs", "payment_methods", server_default=None)

        if "bank_info" not in wc:
            op.add_column(
                "tenant_widget_configs",
                sa.Column("bank_info", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            )
        if "action_mode" not in wc:
            op.add_column(
                "tenant_widget_configs",
                sa.Column("action_mode", sa.String(length=10), nullable=False, server_default="lead"),
            )
            op.alter_column("tenant_widget_configs", "action_mode", server_default=None)

        op.execute(
            sa.text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'ck_widget_sales_font_family'
                    ) THEN
                        ALTER TABLE tenant_widget_configs
                        ADD CONSTRAINT ck_widget_sales_font_family
                        CHECK (font_family IN ('sans', 'serif'));
                    END IF;
                END $$;
                """
            )
        )
        op.execute(
            sa.text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'ck_widget_sales_product_layout'
                    ) THEN
                        ALTER TABLE tenant_widget_configs
                        ADD CONSTRAINT ck_widget_sales_product_layout
                        CHECK (product_layout IN ('card', 'list'));
                    END IF;
                END $$;
                """
            )
        )
        op.execute(
            sa.text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'ck_widget_sales_action_mode'
                    ) THEN
                        ALTER TABLE tenant_widget_configs
                        ADD CONSTRAINT ck_widget_sales_action_mode
                        CHECK (action_mode IN ('lead', 'link', 'direct'));
                    END IF;
                END $$;
                """
            )
        )

    if "platform_connectors" not in tables:
        op.create_table(
            "platform_connectors",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
            sa.Column("platform", sa.String(length=20), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("credentials_enc", sa.Text(), nullable=False),
            sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("last_synced_at", sa.DateTime(), nullable=True),
            sa.Column("sync_status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("sync_error", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.UniqueConstraint("tenant_id", "platform", name="uq_platform_connectors_tenant_platform"),
        )
        op.execute(
            sa.text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'ck_platform_connectors_platform'
                    ) THEN
                        ALTER TABLE platform_connectors
                        ADD CONSTRAINT ck_platform_connectors_platform
                        CHECK (platform IN ('woocommerce', 'shopify', 'generic'));
                    END IF;
                END $$;
                """
            )
        )
        op.create_index("ix_platform_connectors_tenant_id", "platform_connectors", ["tenant_id"])

    if "products" not in tables:
        op.create_table(
            "products",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
            sa.Column("external_id", sa.String(length=255), nullable=False),
            sa.Column("platform", sa.String(length=20), nullable=False),
            sa.Column("name", sa.String(length=500), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("price", sa.Numeric(12, 0), nullable=True),
            sa.Column("compare_price", sa.Numeric(12, 0), nullable=True),
            sa.Column("sku", sa.String(length=255), nullable=True),
            sa.Column("stock_quantity", sa.Integer(), nullable=True),
            sa.Column("in_stock", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("images", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("variants", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("tags", postgresql.ARRAY(sa.Text()), nullable=True),
            sa.Column("category", sa.String(length=255), nullable=True),
            sa.Column("raw_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("vector_synced", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.UniqueConstraint("tenant_id", "platform", "external_id", name="uq_products_tenant_platform_external"),
        )
        op.create_index("idx_products_tenant", "products", ["tenant_id"])
        op.create_index("idx_products_stock", "products", ["tenant_id", "in_stock"])

    if "orders" not in tables:
        op.create_table(
            "orders",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "chat_session_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("chat_sessions.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("source_mode", sa.String(length=10), nullable=False),
            sa.Column("customer_name", sa.String(length=255), nullable=True),
            sa.Column("customer_phone", sa.String(length=20), nullable=True),
            sa.Column("customer_email", sa.String(length=255), nullable=True),
            sa.Column("customer_address", sa.Text(), nullable=True),
            sa.Column("items", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("subtotal", sa.Numeric(12, 0), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
            sa.Column("external_order_id", sa.String(length=255), nullable=True),
            sa.Column("external_order_url", sa.Text(), nullable=True),
            sa.Column("payment_method", sa.String(length=20), nullable=True),
            sa.Column("payment_status", sa.String(length=20), nullable=False, server_default="unpaid"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        op.execute(
            sa.text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'ck_orders_source_mode'
                    ) THEN
                        ALTER TABLE orders
                        ADD CONSTRAINT ck_orders_source_mode
                        CHECK (source_mode IN ('lead', 'link', 'direct'));
                    END IF;
                END $$;
                """
            )
        )
        op.create_index("idx_orders_tenant", "orders", ["tenant_id"])
        op.create_index("idx_orders_status", "orders", ["tenant_id", "status"])
        op.create_index("idx_orders_chat_session", "orders", ["chat_session_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names(schema="public"))

    if "orders" in tables:
        op.drop_index("idx_orders_chat_session", table_name="orders")
        op.drop_index("idx_orders_status", table_name="orders")
        op.drop_index("idx_orders_tenant", table_name="orders")
        op.drop_table("orders")

    if "products" in tables:
        op.drop_index("idx_products_stock", table_name="products")
        op.drop_index("idx_products_tenant", table_name="products")
        op.drop_table("products")

    if "platform_connectors" in tables:
        op.drop_index("ix_platform_connectors_tenant_id", table_name="platform_connectors")
        op.drop_table("platform_connectors")

    if "tenant_widget_configs" in tables:
        wc = {c["name"] for c in inspector.get_columns("tenant_widget_configs", schema="public")}
        for con in (
            "ck_widget_sales_action_mode",
            "ck_widget_sales_product_layout",
            "ck_widget_sales_font_family",
        ):
            op.execute(
                sa.text(
                    f"""
                    DO $$
                    BEGIN
                        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{con}') THEN
                            ALTER TABLE tenant_widget_configs DROP CONSTRAINT {con};
                        END IF;
                    END $$;
                    """
                )
            )
        for col in ("action_mode", "bank_info", "payment_methods", "form_fields", "show_rating", "show_stock", "product_layout", "font_family"):
            if col in wc:
                op.drop_column("tenant_widget_configs", col)

    if "tenants" in tables:
        tc = {c["name"] for c in inspector.get_columns("tenants", schema="public")}
        if "sales_enabled" in tc:
            op.drop_column("tenants", "sales_enabled")
