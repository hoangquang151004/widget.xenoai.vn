"""v2_schema_stabilization

Revision ID: 1ca289585fb8
Revises: c3f8a7d6e5b4
Create Date: 2026-04-03 09:40:06.720245

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ca289585fb8'
down_revision: Union[str, Sequence[str], None] = 'c3f8a7d6e5b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Schema stabilization for v2 models without destructive reset."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names(schema="public"))

    # Ensure core columns/constraints for tenants table.
    if "tenants" in tables:
        tenant_columns = {c["name"] for c in inspector.get_columns("tenants", schema="public")}

        if "plan" not in tenant_columns:
            op.add_column(
                "tenants",
                sa.Column("plan", sa.String(length=20), nullable=True, server_default="starter"),
            )

        op.execute("UPDATE tenants SET plan = 'starter' WHERE plan IS NULL")

        op.execute(
            sa.text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'ck_tenants_plan'
                    ) THEN
                        ALTER TABLE tenants
                        ADD CONSTRAINT ck_tenants_plan
                        CHECK (plan IN ('starter', 'pro', 'enterprise'));
                    END IF;
                END $$;
                """
            )
        )

    # tenant_widget_configs
    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS tenant_widget_configs (
                tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
                bot_name VARCHAR(255) NOT NULL DEFAULT 'Tro ly AI',
                primary_color VARCHAR(20) NOT NULL DEFAULT '#2563eb',
                logo_url VARCHAR(500),
                greeting VARCHAR(500) NOT NULL DEFAULT 'Xin chao! Toi co the giup gi cho ban?',
                placeholder VARCHAR(255) NOT NULL DEFAULT 'Nhap cau hoi...',
                position VARCHAR(20) NOT NULL DEFAULT 'bottom-right',
                show_sources BOOLEAN NOT NULL DEFAULT TRUE,
                font_size VARCHAR(10) NOT NULL DEFAULT '14px',
                updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'ck_widget_config_position'
                ) THEN
                    ALTER TABLE tenant_widget_configs
                    ADD CONSTRAINT ck_widget_config_position
                    CHECK (position IN ('bottom-right', 'bottom-left'));
                END IF;
            END $$;
            """
        )
    )

    # tenant_ai_settings
    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS tenant_ai_settings (
                tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
                system_prompt VARCHAR(2000) NOT NULL DEFAULT 'Ban la mot tro ly AI chuyen nghiep va than thien.',
                is_rag_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                is_sql_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                temperature DOUBLE PRECISION NOT NULL DEFAULT 0.7,
                max_tokens INTEGER NOT NULL DEFAULT 2048,
                updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
            """
        )
    )

    # tenant_keys
    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS tenant_keys (
                id UUID PRIMARY KEY,
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                key_type VARCHAR(20) NOT NULL,
                key_value VARCHAR(255) NOT NULL,
                label VARCHAR(255) NOT NULL DEFAULT 'Default',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                last_used_at TIMESTAMP WITHOUT TIME ZONE,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    op.execute(sa.text("CREATE UNIQUE INDEX IF NOT EXISTS ix_tenant_keys_key_value ON tenant_keys (key_value)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_tenant_keys_tenant_id ON tenant_keys (tenant_id)"))
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'ck_tenant_keys_key_type'
                ) THEN
                    ALTER TABLE tenant_keys
                    ADD CONSTRAINT ck_tenant_keys_key_type
                    CHECK (key_type IN ('public', 'admin'));
                END IF;
            END $$;
            """
        )
    )

    # tenant_allowed_origins
    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS tenant_allowed_origins (
                id UUID PRIMARY KEY,
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                origin VARCHAR(255) NOT NULL,
                note VARCHAR(500),
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_tenant_allowed_origins_tenant_id ON tenant_allowed_origins (tenant_id)"))
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_tenant_allowed_origins_tenant_origin'
                ) THEN
                    ALTER TABLE tenant_allowed_origins
                    ADD CONSTRAINT uq_tenant_allowed_origins_tenant_origin
                    UNIQUE (tenant_id, origin);
                END IF;
            END $$;
            """
        )
    )

    # chat_sessions
    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id UUID PRIMARY KEY,
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                visitor_id VARCHAR(255) NOT NULL,
                visitor_meta JSONB,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                message_count INTEGER NOT NULL DEFAULT 0,
                started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                last_active_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                ended_at TIMESTAMP WITHOUT TIME ZONE
            )
            """
        )
    )
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_chat_sessions_tenant_id ON chat_sessions (tenant_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_chat_sessions_visitor_id ON chat_sessions (visitor_id)"))

    # chat_messages
    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id UUID PRIMARY KEY,
                session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                tenant_id UUID NOT NULL,
                role VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                intent VARCHAR(100),
                rag_sources JSONB,
                sql_query TEXT,
                latency_ms INTEGER,
                token_count INTEGER,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_chat_messages_session_id ON chat_messages (session_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_chat_messages_tenant_id ON chat_messages (tenant_id)"))
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'ck_chat_messages_role'
                ) THEN
                    ALTER TABLE chat_messages
                    ADD CONSTRAINT ck_chat_messages_role
                    CHECK (role IN ('user', 'assistant', 'system'));
                END IF;
            END $$;
            """
        )
    )

    # chat_analytics
    op.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS chat_analytics (
                id UUID PRIMARY KEY,
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                total_sessions INTEGER NOT NULL DEFAULT 0,
                total_messages INTEGER NOT NULL DEFAULT 0,
                unique_visitors INTEGER NOT NULL DEFAULT 0,
                rag_count INTEGER NOT NULL DEFAULT 0,
                sql_count INTEGER NOT NULL DEFAULT 0,
                avg_latency_ms INTEGER,
                error_count INTEGER NOT NULL DEFAULT 0
            )
            """
        )
    )
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_chat_analytics_tenant_id ON chat_analytics (tenant_id)"))
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_chat_analytics_tenant_date'
                ) THEN
                    ALTER TABLE chat_analytics
                    ADD CONSTRAINT uq_chat_analytics_tenant_date
                    UNIQUE (tenant_id, date);
                END IF;
            END $$;
            """
        )
    )

    # Backfill defaults for newly created tenant_* tables.
    op.execute(
        sa.text(
            """
            INSERT INTO tenant_widget_configs (tenant_id)
            SELECT id FROM tenants
            ON CONFLICT (tenant_id) DO NOTHING
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO tenant_ai_settings (tenant_id)
            SELECT id FROM tenants
            ON CONFLICT (tenant_id) DO NOTHING
            """
        )
    )

    if "tenants" in tables:
        tenant_columns = {c["name"] for c in inspector.get_columns("tenants", schema="public")}

        if "public_key" in tenant_columns or "secret_key" in tenant_columns:
            rows = bind.execute(
                sa.text(
                    """
                    SELECT id, public_key, secret_key
                    FROM tenants
                    """
                )
            ).mappings()
            for row in rows:
                tenant_id = row["id"]
                public_key = row.get("public_key")
                secret_key = row.get("secret_key")

                if public_key:
                    bind.execute(
                        sa.text(
                            """
                            INSERT INTO tenant_keys (
                                id, tenant_id, key_type, key_value, label, is_active, created_at
                            ) VALUES (
                                :id, :tenant_id, 'public', :key_value, 'Migrated Public Key', TRUE, NOW()
                            )
                            ON CONFLICT (key_value) DO NOTHING
                            """
                        ),
                        {
                            "id": uuid.uuid4(),
                            "tenant_id": tenant_id,
                            "key_value": public_key,
                        },
                    )

                if secret_key:
                    bind.execute(
                        sa.text(
                            """
                            INSERT INTO tenant_keys (
                                id, tenant_id, key_type, key_value, label, is_active, created_at
                            ) VALUES (
                                :id, :tenant_id, 'admin', :key_value, 'Migrated Admin Key', TRUE, NOW()
                            )
                            ON CONFLICT (key_value) DO NOTHING
                            """
                        ),
                        {
                            "id": uuid.uuid4(),
                            "tenant_id": tenant_id,
                            "key_value": secret_key,
                        },
                    )

        if "allowed_origins" in tenant_columns:
            rows = bind.execute(
                sa.text(
                    """
                    SELECT id, allowed_origins
                    FROM tenants
                    """
                )
            ).mappings()

            for row in rows:
                tenant_id = row["id"]
                origins = row.get("allowed_origins") or []
                if not isinstance(origins, list):
                    origins = []

                if not origins:
                    origins = ["*"]

                for origin in origins:
                    bind.execute(
                        sa.text(
                            """
                            INSERT INTO tenant_allowed_origins (id, tenant_id, origin, note, created_at)
                            VALUES (:id, :tenant_id, :origin, :note, NOW())
                            ON CONFLICT (tenant_id, origin) DO NOTHING
                            """
                        ),
                        {
                            "id": uuid.uuid4(),
                            "tenant_id": tenant_id,
                            "origin": str(origin),
                            "note": "Migrated from tenants.allowed_origins",
                        },
                    )


def downgrade() -> None:
    """No destructive downgrade for stabilization migration."""
    pass
