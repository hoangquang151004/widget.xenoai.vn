import os
import sys
import time
import uuid
import json
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from api.middleware import SecurityMiddleware
from api.v1 import chat, admin, files, payos_billing, platform_admin
from core.config import settings

# ─────────────────────────────────────────────────────────────────────────────
# DEV-006: Structured JSON Logging
# ─────────────────────────────────────────────────────────────────────────────

class JsonFormatter(logging.Formatter):
    """Log formatter that outputs JSON lines."""
    def format(self, record: logging.LogRecord) -> str:
        log: dict = {
            "time":    self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level":   record.levelname,
            "logger":  record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log["exception"] = self.formatException(record.exc_info)
        for key in ("tenant_id", "request_id", "duration_ms", "status_code", "path"):
            if hasattr(record, key):
                log[key] = getattr(record, key)
        return json.dumps(log, ensure_ascii=False)


def configure_logging():
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    # Reduce noise from third-party libs
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


configure_logging()
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Sentry (optional — only if SENTRY_DSN is set)
# ─────────────────────────────────────────────────────────────────────────────
try:
    if settings.SENTRY_DSN:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            traces_sample_rate=0.1,
            environment=settings.ENV,
            integrations=[FastApiIntegration()]
        )
        logger.info("Sentry initialized", extra={"env": settings.ENV})
except Exception as e:
    logger.warning(f"Sentry initialization skipped: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Embeddable AI Chatbot API",
    description="Backend API for multi-tenant AI Chatbot Widget",
    version="0.2.0"
)

@app.on_event("startup")
async def startup_event():
    """Khởi tạo các tài nguyên cần thiết khi khởi động."""
    storage_path = os.path.abspath(settings.STORAGE_PATH)
    os.makedirs(storage_path, exist_ok=True)
    logger.info(f"Storage directory initialized at: {storage_path}")

app.add_middleware(SecurityMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time", "X-Request-ID"],
)

app.include_router(chat.router,  prefix="/api/v1/chat",  tags=["Chat"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(files.router, prefix="/api/v1/files", tags=["Files"])
app.include_router(payos_billing.router, prefix="/api/v1")
app.include_router(
    platform_admin.router,
    prefix="/api/v1/platform-admin",
    tags=["Platform Admin"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Request Logging Middleware
# ─────────────────────────────────────────────────────────────────────────────

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()

    response = await call_next(request)

    duration_ms = round((time.time() - start_time) * 1000, 2)
    tenant_id = getattr(request.state, "tenant_id", None)

    logger.info(
        f"{request.method} {request.url.path} {response.status_code}",
        extra={
            "request_id":  request_id,
            "tenant_id":   str(tenant_id) if tenant_id else None,
            "path":        request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        }
    )

    response.headers["X-Process-Time"] = f"{duration_ms}ms"
    response.headers["X-Request-ID"]   = request_id
    if settings.ENV == "production":
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault(
            "Referrer-Policy", "strict-origin-when-cross-origin"
        )
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()",
        )
    return response


# ─────────────────────────────────────────────────────────────────────────────
# Health endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "timestamp": time.time(), "version": "0.2.0"}


@app.get("/api/health/detailed", tags=["Health"])
async def health_check_detailed():
    """DEV-006: Kiểm tra PostgreSQL, Redis và Qdrant."""
    checks: dict = {}

    # PostgreSQL
    try:
        from db.session import async_session
        from sqlalchemy import text
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        checks["postgresql"] = {"status": "ok"}
    except Exception as e:
        checks["postgresql"] = {"status": "error", "detail": str(e)}

    # Redis
    try:
        from redis import Redis
        r = Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, socket_timeout=2)
        r.ping()
        checks["redis"] = {"status": "ok"}
    except Exception as e:
        checks["redis"] = {"status": "error", "detail": str(e)}

    # Qdrant
    try:
        from qdrant_client import AsyncQdrantClient
        client = AsyncQdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT, timeout=2)
        await client.get_collections()
        checks["qdrant"] = {"status": "ok"}
    except Exception as e:
        checks["qdrant"] = {"status": "error", "detail": str(e)}

    overall = "ok" if all(v["status"] == "ok" for v in checks.values()) else "degraded"
    return {"status": overall, "timestamp": time.time(), "version": "0.2.0", "services": checks}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
