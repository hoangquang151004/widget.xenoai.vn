from functools import lru_cache
from typing import Optional, List
import sys
import logging

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # ── General ──────────────────────────────────────────────────────────────
    PROJECT_NAME: str = "AI Chatbot Widget SaaS"
    ENV: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # ── Security (REQUIRED) ───────────────────────────────────────────────────
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    APP_ENCRYPTION_KEY: str = Field(
        default="",
        description="32-byte base64 key for AES-256-GCM encryption of tenant DB credentials"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8

    # ── Database (PostgreSQL) ─────────────────────────────────────────────────
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "widget_chatbot"
    SQLALCHEMY_DATABASE_URI: Optional[str] = None

    @property
    def get_database_url(self) -> str:
        if self.SQLALCHEMY_DATABASE_URI:
            return self.SQLALCHEMY_DATABASE_URI
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ── Redis & Celery ────────────────────────────────────────────────────────
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # ── AI / LLM ─────────────────────────────────────────────────────────────
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.0-flash"
    EMBEDDING_MODEL: str = "models/gemini-embedding-2-preview"
    EMBEDDING_DIM: int = 3072

    # ── Qdrant ───────────────────────────────────────────────────────────────
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION_DOCS: str = "chatbot_documents"

    # ── RAG ──────────────────────────────────────────────────────────────────
    RAG_MAX_RESULTS: int = 5
    RAG_SIMILARITY_THRESHOLD: float = 0.7
    INTENT_MIN_CONFIDENCE: float = 0.55

    # ── CORS ─────────────────────────────────────────────────────────────────
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # ── Sentry (optional) ────────────────────────────────────────────────────
    SENTRY_DSN: Optional[str] = None

    # ── PayOS (thanh toán — tùy chọn) ─────────────────────────────────────────
    PAYOS_CLIENT_ID: str = ""
    PAYOS_API_KEY: str = ""
    PAYOS_CHECKSUM_KEY: str = ""
    # URL đầy đủ sau khi thanh toán / hủy (trang dashboard billing)
    PAYOS_CHECKOUT_RETURN_URL: str = ""
    PAYOS_CHECKOUT_CANCEL_URL: str = ""
    # Giá gói (VND) — điền theo bảng giá thực tế trên PayOS
    PAYOS_AMOUNT_PRO_VND: int = 500_000
    PAYOS_AMOUNT_ENTERPRISE_VND: int = 2_000_000
    PAYOS_AMOUNT_ENTERPRISE_PRO_VND: int = 5_000_000

    # ── Storage ──────────────────────────────────────────────────────────────
    STORAGE_PATH: str = "storage"

    # ── Startup Validation ────────────────────────────────────────────────────
    @model_validator(mode="after")
    def validate_required_secrets(self) -> "Settings":
        errors = []

        if not self.APP_ENCRYPTION_KEY:
            errors.append(
                "APP_ENCRYPTION_KEY is required but not set. "
                "Generate with: python -c \"import secrets, base64; "
                "print(base64.b64encode(secrets.token_bytes(32)).decode())\""
            )

        if self.ENV == "production":
            if not self.GEMINI_API_KEY:
                errors.append("GEMINI_API_KEY is required in production.")
            if self.SECRET_KEY == "CHANGE_ME_IN_PRODUCTION":
                errors.append("SECRET_KEY must be changed in production.")

        if errors:
            msg = "\n".join(f"  ❌ {e}" for e in errors)
            print(f"\n🚨 STARTUP VALIDATION FAILED:\n{msg}\n", file=sys.stderr)
            sys.exit(1)

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
