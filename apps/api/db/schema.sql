-- Widget Chatbot - Database Schema v2
-- Runtime target: PostgreSQL + Qdrant
-- Note: This file is documentation/reference, not migration source.

-- 0) Optional extension
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Core tenant table
CREATE TABLE tenants (
    id            UUID PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    plan          VARCHAR(20) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_tenants_email ON tenants (email);

-- 2) Widget config (1-1)
CREATE TABLE tenant_widget_configs (
    tenant_id      UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    bot_name       VARCHAR(255) NOT NULL DEFAULT 'Tro ly AI',
    primary_color  VARCHAR(20) NOT NULL DEFAULT '#2563eb',
    logo_url       VARCHAR(500),
    greeting       VARCHAR(500) NOT NULL DEFAULT 'Xin chao! Toi co the giup gi cho ban?',
    placeholder    VARCHAR(255) NOT NULL DEFAULT 'Nhap cau hoi...',
    position       VARCHAR(20) NOT NULL DEFAULT 'bottom-right' CHECK (position IN ('bottom-right', 'bottom-left')),
    show_sources   BOOLEAN NOT NULL DEFAULT TRUE,
    font_size      VARCHAR(10) NOT NULL DEFAULT '14px',
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3) AI settings (1-1)
CREATE TABLE tenant_ai_settings (
    tenant_id       UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    system_prompt   VARCHAR(2000) NOT NULL DEFAULT 'Ban la mot tro ly AI chuyen nghiep va than thien.',
    is_rag_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    is_sql_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    temperature     DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    max_tokens      INTEGER NOT NULL DEFAULT 2048,
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4) API keys (1-N)
CREATE TABLE tenant_keys (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key_type      VARCHAR(20) NOT NULL CHECK (key_type IN ('public', 'admin')),
    key_value     VARCHAR(255) NOT NULL UNIQUE,
    label         VARCHAR(255) NOT NULL DEFAULT 'Default',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at  TIMESTAMP,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_tenant_keys_tenant_id ON tenant_keys (tenant_id);
CREATE UNIQUE INDEX ix_tenant_keys_key_value ON tenant_keys (key_value);

-- 5) Allowed origins (1-N)
CREATE TABLE tenant_allowed_origins (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    origin        VARCHAR(255) NOT NULL,
    note          VARCHAR(500),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_allowed_origins_tenant_origin UNIQUE (tenant_id, origin)
);
CREATE INDEX ix_tenant_allowed_origins_tenant_id ON tenant_allowed_origins (tenant_id);

-- 6) Tenant database configs (1-N)
CREATE TABLE tenant_databases (
    id               UUID PRIMARY KEY,
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    db_type          VARCHAR(20) NOT NULL DEFAULT 'postgresql',
    db_host          VARCHAR(255) NOT NULL,
    db_port          INTEGER NOT NULL DEFAULT 5432,
    db_name          VARCHAR(255) NOT NULL,
    db_user_enc      BYTEA NOT NULL,
    db_password_enc  BYTEA NOT NULL,
    db_ssl           BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_tables   VARCHAR[] DEFAULT '{}',
    schema_cache     JSON,
    schema_synced_at TIMESTAMP,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    last_tested_at   TIMESTAMP,
    last_test_ok     BOOLEAN,
    last_test_error  VARCHAR,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX ix_tenant_databases_tenant_id ON tenant_databases (tenant_id);

-- 7) Tenant documents (RAG source files)
CREATE TABLE tenant_documents (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    filename      VARCHAR NOT NULL,
    file_type     VARCHAR NOT NULL,
    file_size     INTEGER NOT NULL,
    storage_path  VARCHAR NOT NULL,
    status        VARCHAR NOT NULL DEFAULT 'pending',
    error_message TEXT,
    chunk_count   INTEGER,
    uploaded_by   VARCHAR,
    uploaded_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at  TIMESTAMP
);
CREATE INDEX ix_tenant_documents_tenant_id ON tenant_documents (tenant_id);

-- 8) Chat sessions
CREATE TABLE chat_sessions (
    id             UUID PRIMARY KEY,
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    visitor_id     VARCHAR(255) NOT NULL,
    visitor_meta   JSONB,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    message_count  INTEGER NOT NULL DEFAULT 0,
    started_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at       TIMESTAMP
);
CREATE INDEX ix_chat_sessions_tenant_id ON chat_sessions (tenant_id);
CREATE INDEX ix_chat_sessions_visitor_id ON chat_sessions (visitor_id);

-- 9) Chat messages
CREATE TABLE chat_messages (
    id          UUID PRIMARY KEY,
    session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content     TEXT NOT NULL,
    intent      VARCHAR(100),
    rag_sources JSONB,
    sql_query   TEXT,
    latency_ms  INTEGER,
    token_count INTEGER,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_chat_messages_session_id ON chat_messages (session_id);
CREATE INDEX ix_chat_messages_tenant_id ON chat_messages (tenant_id);

-- 10) Chat analytics (daily aggregated)
CREATE TABLE chat_analytics (
    id               UUID PRIMARY KEY,
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date             DATE NOT NULL,
    total_sessions   INTEGER NOT NULL DEFAULT 0,
    total_messages   INTEGER NOT NULL DEFAULT 0,
    unique_visitors  INTEGER NOT NULL DEFAULT 0,
    rag_count        INTEGER NOT NULL DEFAULT 0,
    sql_count        INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms   INTEGER,
    error_count      INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_chat_analytics_tenant_date UNIQUE (tenant_id, date)
);
CREATE INDEX ix_chat_analytics_tenant_id ON chat_analytics (tenant_id);
