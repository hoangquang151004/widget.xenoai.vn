import logging
from datetime import datetime
from urllib.parse import urlparse

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.future import select

from db.session import async_session
from models.tenant import Tenant
from models.tenant_key import TenantKey
from models.allowed_origin import TenantAllowedOrigin
from core.security import security_utils
from typing import Optional

logger = logging.getLogger(__name__)

class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Middleware for SaaS Authentication and Domain Validation.
    Injects 'tenant_id' into request.state.
    """
    
    # Path to skip auth (e.g., Health check, Registration)
    SKIP_PATHS = [
        "/api/health", 
        "/api/v1/admin/register", 
        "/api/v1/admin/login",
        "/api/v1/chat/config",
        "/docs", 
        "/redoc", 
        "/openapi.json"
    ]

    ADMIN_PATH_PREFIXES = ["/api/v1/admin", "/api/v1/files"]

    async def dispatch(self, request: Request, call_next):
        # 0. Allow OPTIONS for CORS preflight
        if request.method == "OPTIONS":
            return await call_next(request)

        # 1. Skip auth for specific paths
        if any(request.url.path.startswith(path) for path in self.SKIP_PATHS):
            return await call_next(request)

        # 2. Admin routes now authenticate via Bearer token
        if self._is_admin_path(request.url.path):
            return await self._authenticate_admin(request, call_next)

        # 3. Non-admin routes authenticate by API key (widget/public chat)
        api_key = request.headers.get("X-Widget-Key") or request.headers.get("X-API-Key")
        if not api_key:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Missing API Key (X-Widget-Key or X-API-Key header)"}
            )

        return await self._authenticate_by_api_key(request, call_next, api_key)

    async def _authenticate_admin(self, request: Request, call_next):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Missing Bearer token"}
            )

        token = auth_header.replace("Bearer ", "", 1).strip()
        payload = security_utils.verify_admin_token(token)
        if not payload:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid or expired token"}
            )

        tenant_id = payload.get("sub")
        async with async_session() as session:
            result = await session.execute(
                select(Tenant).filter(Tenant.id == tenant_id, Tenant.is_active == True)
            )
            tenant = result.scalars().first()
            if not tenant:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Invalid tenant"}
                )

            from core.rate_limit import rate_limiter
            if await rate_limiter.is_rate_limited(str(tenant.id), key_type="admin"):
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Too many admin requests. Please try again later."}
                )

            request.state.tenant_id = str(tenant.id)
            request.state.tenant_name = tenant.name
            request.state.is_admin = True

        return await call_next(request)

    async def _authenticate_by_api_key(self, request: Request, call_next, api_key: str):
        # Database Authenticate Tenant via tenant_keys
        async with async_session() as session:
            result = await session.execute(
                select(TenantKey, Tenant)
                .join(Tenant, TenantKey.tenant_id == Tenant.id)
                .filter(
                    TenantKey.key_value == api_key,
                    TenantKey.is_active == True,
                    Tenant.is_active == True,
                )
            )
            row = result.first()
            if not row:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Invalid or inactive API Key"}
                )
            tenant_key, tenant = row
            is_public = tenant_key.key_type == "public"

            tenant_key.last_used_at = datetime.utcnow()
            await session.commit()

            # 4. Domain Validation (Origin Check) for Public Key
            if is_public:
                origin = request.headers.get("Origin") or request.headers.get("Referer")
                
                # If no origin, check if allowed in tenant config (e.g., during development)
                if not origin:
                    # In strict mode, we could reject requests without Origin
                    pass
                else:
                    try:
                        parsed_origin = urlparse(origin).netloc
                        origin_result = await session.execute(
                            select(TenantAllowedOrigin.origin).filter(
                                TenantAllowedOrigin.tenant_id == tenant.id
                            )
                        )
                        allowed_origins = [
                            item[0].strip().lower()
                            for item in origin_result.fetchall()
                            if item and item[0]
                        ]
                        parsed_origin = parsed_origin.strip().lower()
                        
                        # In dev, we might allow all for test
                        if "*" not in allowed_origins and parsed_origin not in allowed_origins:
                            logger.warning(f"Domain mismatch: {parsed_origin} not in {allowed_origins}")
                            return JSONResponse(
                                status_code=status.HTTP_403_FORBIDDEN,
                                content={"detail": f"Domain {parsed_origin} is not authorized for this widget."}
                            )
                    except Exception:
                        pass

            # 5. Rate Limiting Check
            from core.rate_limit import rate_limiter
            key_type = "public" if is_public else "admin"
            if await rate_limiter.is_rate_limited(str(tenant.id), key_type=key_type):
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": f"Too many {key_type} requests. Please try again later."}
                )

            # 6. Inject Context into Request State
            request.state.tenant_id = str(tenant.id)
            request.state.tenant_name = tenant.name
            request.state.is_admin = not is_public
            
            logger.info(f"Auth Success: Tenant={tenant.name}, ID={tenant.id}, Admin={not is_public}")
            
        # Proceed to next handler
        response = await call_next(request)
        return response

    def _is_admin_path(self, path: str) -> bool:
        return any(path.startswith(prefix) for prefix in self.ADMIN_PATH_PREFIXES)
