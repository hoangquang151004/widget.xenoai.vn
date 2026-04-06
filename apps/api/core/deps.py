"""FastAPI dependencies for admin routes."""

from fastapi import HTTPException, Request

TENANT_ROLE = "tenant"
PLATFORM_ADMIN_ROLE = "platform_admin"


def require_platform_admin(request: Request) -> None:
    """Chỉ JWT của tài khoản `tenants.role = platform_admin` (đã qua middleware)."""
    if not getattr(request.state, "is_admin", False):
        raise HTTPException(status_code=401, detail="Yêu cầu Bearer token hợp lệ")
    role = getattr(request.state, "user_role", None)
    if role != PLATFORM_ADMIN_ROLE:
        raise HTTPException(
            status_code=403,
            detail="Chỉ Platform Admin mới được truy cập tài nguyên này.",
        )


def require_tenant_account(request: Request) -> None:
    """Chỉ tài khoản khách hàng (tenant) được dùng endpoint quản trị theo tenant."""
    role = getattr(request.state, "user_role", None)
    if role != TENANT_ROLE:
        raise HTTPException(
            status_code=403,
            detail="Tài khoản quản trị nền tảng không dùng được tính năng này.",
        )
