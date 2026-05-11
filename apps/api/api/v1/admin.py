import re
import secrets
import logging
import os
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Optional
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, text
from sqlalchemy.engine import URL
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.future import select

from core.analytics_service import fetch_analytics_stats, fetch_message_history_series
from core.config import settings
from core.deps import require_tenant_account
from core.plan_limits import get_ai_message_usage_for_billing, get_limits, normalize_plan
from core.security import security_utils
from db.session import async_session
from models.ai_settings import TenantAiSettings
from models.allowed_origin import TenantAllowedOrigin
from models.chat import ChatMessage, ChatSession
from models.document import TenantDocument
from models.tenant import Tenant
from models.tenant_db_config import TenantDatabaseConfig
from models.tenant_key import TenantKey
from models.widget_config import TenantWidgetConfig

router = APIRouter()
logger = logging.getLogger(__name__)
STORAGE_DIR = os.path.abspath(getattr(settings, "STORAGE_PATH", "storage"))
AVATAR_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
AVATAR_MAX_BYTES = 20 * 1024 * 1024


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class RegisterTenantSchema(BaseModel):
    name: str
    email: EmailStr
    password: str
    allowed_origins: Optional[List[str]] = None


class LoginSchema(BaseModel):
    email: EmailStr
    password: str


class WidgetUpdateSchema(BaseModel):
    bot_name: Optional[str] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None
    greeting: Optional[str] = None
    placeholder: Optional[str] = None
    position: Optional[str] = None
    show_sources: Optional[bool] = None
    font_size: Optional[str] = None


class AiSettingsUpdateSchema(BaseModel):
    system_prompt: Optional[str] = None
    is_rag_enabled: Optional[bool] = None
    is_sql_enabled: Optional[bool] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class TenantMeUpdateSchema(BaseModel):
    name: Optional[str] = None
    sales_enabled: Optional[bool] = None
    # Widget settings
    bot_name: Optional[str] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None
    greeting: Optional[str] = None
    placeholder: Optional[str] = None
    position: Optional[str] = None
    show_sources: Optional[bool] = None
    font_size: Optional[str] = None
    # Widget sales (V2)
    font_family: Optional[str] = None
    product_layout: Optional[str] = None
    show_stock: Optional[bool] = None
    show_rating: Optional[bool] = None
    form_fields: Optional[list] = None
    payment_methods: Optional[dict] = None
    bank_info: Optional[dict] = None
    action_mode: Optional[str] = None
    # AI settings
    system_prompt: Optional[str] = None
    is_rag_enabled: Optional[bool] = None
    is_sql_enabled: Optional[bool] = None


class CreateKeySchema(BaseModel):
    key_type: str
    label: Optional[str] = None


class AddOriginSchema(BaseModel):
    origin: str
    note: Optional[str] = None


class DBConfigSchema(BaseModel):
    db_type: str
    db_host: str
    db_port: int
    db_name: str
    db_username: str
    db_password: str


class ChatMessageSchema(BaseModel):
    id: UUID
    role: str
    content: str
    intent: Optional[str] = None
    rag_sources: Optional[dict] = None
    sql_query: Optional[str] = None
    latency_ms: Optional[int] = None
    token_count: Optional[int] = None
    created_at: datetime


class ChatSessionSchema(BaseModel):
    id: UUID
    visitor_id: str
    message_count: int
    is_active: bool
    started_at: datetime
    last_active_at: datetime
    ended_at: Optional[datetime] = None


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _generate_key(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(32)}"


def _mask_key(key_value: str) -> str:
    if len(key_value) <= 16:
        return key_value
    return f"{key_value[:12]}...{key_value[-4:]}"


def _normalize_origin(origin: str) -> str:
    value = (origin or "").strip().lower()
    if not value:
        raise HTTPException(status_code=400, detail="Origin không hợp lệ")

    if value == "*":
        return "*"

    if "://" in value:
        parsed = urlparse(value)
        if not parsed.netloc:
            raise HTTPException(status_code=400, detail="Origin phải chứa domain hợp lệ")
        if parsed.path not in ("", "/"):
            raise HTTPException(status_code=400, detail="Origin không được chứa path")
        if parsed.params or parsed.query or parsed.fragment:
            raise HTTPException(status_code=400, detail="Origin không được chứa query/fragment")
        return parsed.netloc

    if "/" in value:
        raise HTTPException(status_code=400, detail="Origin không được chứa path")

    if not re.match(r"^[a-z0-9.-]+(?::\d+)?$", value):
        raise HTTPException(status_code=400, detail="Origin không đúng định dạng domain")

    return value


async def _get_tenant_or_404(session, tenant_id: str) -> Tenant:
    result = await session.execute(select(Tenant).filter(Tenant.id == tenant_id))
    tenant = result.scalars().first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant không tồn tại.")
    return tenant


# ─────────────────────────────────────────────────────────────────────────────
# Register / Login / Me
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
async def register_tenant(payload: RegisterTenantSchema):
    """Tạo tenant mới theo schema v2 và cấp key mặc định."""
    async with async_session() as session:
        existing_email = await session.execute(
            select(Tenant).filter(Tenant.email == payload.email)
        )
        if existing_email.scalars().first():
            raise HTTPException(status_code=409, detail="Email đã được sử dụng.")

        if len(payload.password) < 8:
            raise HTTPException(status_code=400, detail="Mật khẩu phải có ít nhất 8 ký tự.")

        origins = payload.allowed_origins if payload.allowed_origins else ["*"]
        normalized = []
        for origin in origins:
            candidate = _normalize_origin(origin)
            if candidate not in normalized:
                normalized.append(candidate)

        public_key = _generate_key("pk_live")
        admin_key = _generate_key("sk_live")

        tenant = Tenant(
            name=payload.name,
            email=payload.email,
            password_hash=security_utils.hash_password(payload.password),
            role="tenant",
            is_active=True,
        )
        session.add(tenant)
        await session.flush()

        widget_config = TenantWidgetConfig(tenant_id=tenant.id)
        ai_settings = TenantAiSettings(tenant_id=tenant.id)
        session.add(widget_config)
        session.add(ai_settings)

        session.add(
            TenantKey(
                tenant_id=tenant.id,
                key_type="public",
                key_value=public_key,
                label="Default Public Key",
                is_active=True,
            )
        )
        session.add(
            TenantKey(
                tenant_id=tenant.id,
                key_type="admin",
                key_value=admin_key,
                label="Default Admin Key",
                is_active=True,
            )
        )

        for origin in normalized:
            session.add(
                TenantAllowedOrigin(
                    tenant_id=tenant.id,
                    origin=origin,
                    note="Default origin from registration",
                )
            )

        await session.commit()
        await session.refresh(tenant)

    return {
        "message": "Tenant đã được tạo thành công.",
        "tenant_id": str(tenant.id),
        "name": tenant.name,
        "email": tenant.email,
        "public_key": public_key,
    }


@router.post("/login")
async def login(payload: LoginSchema):
    """Đăng nhập bằng Email và Password, trả về Bearer token."""
    async with async_session() as session:
        result = await session.execute(
            select(Tenant).filter(Tenant.email == payload.email)
        )
        tenant = result.scalars().first()

        if not tenant or not tenant.password_hash:
            raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không chính xác.")

        if not security_utils.verify_password(payload.password, tenant.password_hash):
            raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không chính xác.")

        if not tenant.is_active:
            raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa.")

        access_token = security_utils.generate_admin_token(
            tenant_id=str(tenant.id),
            email=tenant.email or "",
            role=tenant.role or "tenant",
        )

        return {
            "message": "Đăng nhập thành công.",
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            "role": tenant.role or "tenant",
            "tenant": {
                "id": str(tenant.id),
                "name": tenant.name,
                "email": tenant.email,
                "role": tenant.role or "tenant",
            },
        }


@router.get("/me")
async def get_tenant_info(request: Request):
    """Lấy thông tin tenant hiện tại theo schema v2."""
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_id = request.state.tenant_id
    async with async_session() as session:
        tenant = await _get_tenant_or_404(session, tenant_id)

        widget_result = await session.execute(
            select(TenantWidgetConfig).filter(TenantWidgetConfig.tenant_id == tenant.id)
        )
        widget = widget_result.scalars().first()

        ai_result = await session.execute(
            select(TenantAiSettings).filter(TenantAiSettings.tenant_id == tenant.id)
        )
        ai_settings = ai_result.scalars().first()

        public_key_result = await session.execute(
            select(TenantKey)
            .filter(
                TenantKey.tenant_id == tenant.id,
                TenantKey.key_type == "public",
                TenantKey.is_active == True,
            )
            .order_by(TenantKey.created_at.desc())
        )
        public_key = public_key_result.scalars().first()

        return {
            "id": str(tenant.id),
            "name": tenant.name,
            "email": tenant.email,
            "plan": tenant.plan,
            "role": tenant.role or "tenant",
            "sales_enabled": bool(getattr(tenant, "sales_enabled", False)),
            "public_key": public_key.key_value if public_key else None,
            "widget": {
                "bot_name": widget.bot_name if widget else "Tro ly AI",
                "primary_color": widget.primary_color if widget else "#2563eb",
                "logo_url": widget.logo_url if widget else None,
                "greeting": widget.greeting if widget else "Xin chao! Toi co the giup gi cho ban?",
                "placeholder": widget.placeholder if widget else "Nhap cau hoi...",
                "position": widget.position if widget else "bottom-right",
                "show_sources": widget.show_sources if widget else True,
                "font_size": widget.font_size if widget else "14px",
                "font_family": widget.font_family if widget else "sans",
                "product_layout": widget.product_layout if widget else "card",
                "show_stock": widget.show_stock if widget else True,
                "show_rating": widget.show_rating if widget else False,
                "form_fields": widget.form_fields if widget else [],
                "payment_methods": widget.payment_methods if widget else {},
                "bank_info": widget.bank_info if widget else None,
                "action_mode": widget.action_mode if widget else "lead",
            },
            "ai_settings": {
                "system_prompt": ai_settings.system_prompt if ai_settings else "Ban la mot tro ly AI chuyen nghiep va than thien.",
                "is_rag_enabled": ai_settings.is_rag_enabled if ai_settings else True,
                "is_sql_enabled": ai_settings.is_sql_enabled if ai_settings else False,
                "temperature": ai_settings.temperature if ai_settings else 0.7,
                "max_tokens": ai_settings.max_tokens if ai_settings else 2048,
            },
            "is_active": tenant.is_active,
        }


@router.patch("/me", dependencies=[Depends(require_tenant_account)])
async def update_tenant_me(payload: TenantMeUpdateSchema, request: Request):
    """Cập nhật thông tin tổng hợp của Tenant (Name, Widget, AI)."""
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_id = request.state.tenant_id
    async with async_session() as session:
        tenant = await _get_tenant_or_404(session, tenant_id)

        # 1. Update Tenant Name
        if payload.name is not None:
            tenant.name = payload.name
        if payload.sales_enabled is not None:
            tenant.sales_enabled = payload.sales_enabled

        # 2. Update Widget Config
        widget_result = await session.execute(
            select(TenantWidgetConfig).filter(TenantWidgetConfig.tenant_id == tenant.id)
        )
        widget = widget_result.scalars().first()
        if not widget:
            widget = TenantWidgetConfig(tenant_id=tenant.id)
            session.add(widget)
        
        if payload.bot_name is not None:
            widget.bot_name = payload.bot_name
        if payload.primary_color is not None:
            widget.primary_color = payload.primary_color
        if payload.logo_url is not None:
            widget.logo_url = payload.logo_url
        if payload.greeting is not None:
            widget.greeting = payload.greeting
        if payload.placeholder is not None:
            widget.placeholder = payload.placeholder
        if payload.position is not None:
            if payload.position not in ("bottom-right", "bottom-left"):
                raise HTTPException(status_code=400, detail="position phải là bottom-right hoặc bottom-left")
            widget.position = payload.position
        if payload.show_sources is not None:
            widget.show_sources = payload.show_sources
        if payload.font_size is not None:
            widget.font_size = payload.font_size
        if payload.font_family is not None:
            if payload.font_family not in ("sans", "serif"):
                raise HTTPException(status_code=400, detail="font_family phải là sans hoặc serif")
            widget.font_family = payload.font_family
        if payload.product_layout is not None:
            if payload.product_layout not in ("card", "list"):
                raise HTTPException(status_code=400, detail="product_layout phải là card hoặc list")
            widget.product_layout = payload.product_layout
        if payload.show_stock is not None:
            widget.show_stock = payload.show_stock
        if payload.show_rating is not None:
            widget.show_rating = payload.show_rating
        if payload.form_fields is not None:
            widget.form_fields = payload.form_fields
        if payload.payment_methods is not None:
            widget.payment_methods = payload.payment_methods
        if payload.bank_info is not None:
            widget.bank_info = payload.bank_info
        if payload.action_mode is not None:
            if payload.action_mode not in ("lead", "link", "direct"):
                raise HTTPException(status_code=400, detail="action_mode phải là lead, link hoặc direct")
            widget.action_mode = payload.action_mode

        # 3. Update AI Settings
        ai_result = await session.execute(
            select(TenantAiSettings).filter(TenantAiSettings.tenant_id == tenant.id)
        )
        ai_settings = ai_result.scalars().first()
        if not ai_settings:
            ai_settings = TenantAiSettings(tenant_id=tenant.id)
            session.add(ai_settings)
        
        if payload.system_prompt is not None:
            ai_settings.system_prompt = payload.system_prompt
        if payload.is_rag_enabled is not None:
            ai_settings.is_rag_enabled = payload.is_rag_enabled
        if payload.is_sql_enabled is not None:
            ai_settings.is_sql_enabled = payload.is_sql_enabled

        await session.commit()
    
    return {"message": "Cập nhật thông tin thành công."}


# ─────────────────────────────────────────────────────────────────────────────
# Widget & AI settings
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/widget", dependencies=[Depends(require_tenant_account)])
async def update_widget_settings(payload: WidgetUpdateSchema, request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_id = request.state.tenant_id
    async with async_session() as session:
        await _get_tenant_or_404(session, tenant_id)

        result = await session.execute(
            select(TenantWidgetConfig).filter(TenantWidgetConfig.tenant_id == tenant_id)
        )
        widget = result.scalars().first()
        if not widget:
            widget = TenantWidgetConfig(tenant_id=tenant_id)
            session.add(widget)

        if payload.bot_name is not None:
            widget.bot_name = payload.bot_name
        if payload.primary_color is not None:
            widget.primary_color = payload.primary_color
        if payload.logo_url is not None:
            widget.logo_url = payload.logo_url
        if payload.greeting is not None:
            widget.greeting = payload.greeting
        if payload.placeholder is not None:
            widget.placeholder = payload.placeholder
        if payload.position is not None:
            if payload.position not in ("bottom-right", "bottom-left"):
                raise HTTPException(status_code=400, detail="position phải là bottom-right hoặc bottom-left")
            widget.position = payload.position
        if payload.show_sources is not None:
            widget.show_sources = payload.show_sources
        if payload.font_size is not None:
            widget.font_size = payload.font_size

        widget.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(widget)

    return {
        "message": "Cập nhật widget thành công.",
        "widget": {
            "bot_name": widget.bot_name,
            "primary_color": widget.primary_color,
            "logo_url": widget.logo_url,
            "greeting": widget.greeting,
            "placeholder": widget.placeholder,
            "position": widget.position,
            "show_sources": widget.show_sources,
            "font_size": widget.font_size,
        },
    }


@router.post("/widget/avatar", dependencies=[Depends(require_tenant_account)])
async def upload_widget_avatar(request: Request, file: UploadFile = File(...)):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    if file.content_type not in AVATAR_ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP")

    tenant_id = str(request.state.tenant_id)
    tenant_uuid = UUID(tenant_id)
    tenant_dir = os.path.join(STORAGE_DIR, f"tenant_{tenant_id}", "avatars")
    os.makedirs(tenant_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    filename = f"avatar_{secrets.token_hex(8)}{ext}"
    storage_path = os.path.join(tenant_dir, filename)

    size = 0
    try:
        with open(storage_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > AVATAR_MAX_BYTES:
                    raise HTTPException(status_code=400, detail="Kích thước ảnh tối đa là 20MB")
                out.write(chunk)
    except HTTPException:
        try:
            os.remove(storage_path)
        except OSError:
            pass
        raise
    finally:
        await file.close()

    relative_path = Path(storage_path).resolve().relative_to(Path(STORAGE_DIR).resolve())
    logo_url = f"{str(request.base_url).rstrip('/')}/storage/{relative_path.as_posix()}"

    async with async_session() as session:
        widget_result = await session.execute(
            select(TenantWidgetConfig).filter(TenantWidgetConfig.tenant_id == tenant_uuid)
        )
        widget = widget_result.scalars().first()
        if not widget:
            widget = TenantWidgetConfig(tenant_id=tenant_uuid)
            session.add(widget)
        widget.logo_url = logo_url
        widget.updated_at = datetime.utcnow()
        await session.commit()

    return {"message": "Upload avatar thành công.", "logo_url": logo_url}


@router.patch("/ai-settings", dependencies=[Depends(require_tenant_account)])
async def update_ai_settings(payload: AiSettingsUpdateSchema, request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_id = request.state.tenant_id
    async with async_session() as session:
        await _get_tenant_or_404(session, tenant_id)

        result = await session.execute(
            select(TenantAiSettings).filter(TenantAiSettings.tenant_id == tenant_id)
        )
        ai_settings = result.scalars().first()
        if not ai_settings:
            ai_settings = TenantAiSettings(tenant_id=tenant_id)
            session.add(ai_settings)

        if payload.system_prompt is not None:
            ai_settings.system_prompt = payload.system_prompt
        if payload.is_rag_enabled is not None:
            ai_settings.is_rag_enabled = payload.is_rag_enabled
        if payload.is_sql_enabled is not None:
            ai_settings.is_sql_enabled = payload.is_sql_enabled
        if payload.temperature is not None:
            ai_settings.temperature = payload.temperature
        if payload.max_tokens is not None:
            ai_settings.max_tokens = payload.max_tokens

        ai_settings.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(ai_settings)

    return {
        "message": "Cập nhật AI settings thành công.",
        "ai_settings": {
            "system_prompt": ai_settings.system_prompt,
            "is_rag_enabled": ai_settings.is_rag_enabled,
            "is_sql_enabled": ai_settings.is_sql_enabled,
            "temperature": ai_settings.temperature,
            "max_tokens": ai_settings.max_tokens,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Keys API
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/keys", dependencies=[Depends(require_tenant_account)])
async def get_keys(request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_id = request.state.tenant_id
    async with async_session() as session:
        result = await session.execute(
            select(TenantKey)
            .filter(TenantKey.tenant_id == tenant_id)
            .order_by(TenantKey.created_at.desc())
        )
        keys = result.scalars().all()

    return [
        {
            "id": str(key.id),
            "key_type": key.key_type,
            "key_value": _mask_key(key.key_value),
            "label": key.label,
            "is_active": key.is_active,
            "last_used_at": key.last_used_at,
            "created_at": key.created_at,
        }
        for key in keys
    ]


@router.post("/keys", status_code=201, dependencies=[Depends(require_tenant_account)])
async def create_key(payload: CreateKeySchema, request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    key_type = (payload.key_type or "").strip().lower()
    if key_type not in ("public", "admin"):
        raise HTTPException(status_code=400, detail="key_type phải là public hoặc admin")

    tenant_id = request.state.tenant_id
    prefix = "pk_live" if key_type == "public" else "sk_live"
    new_key_value = _generate_key(prefix)

    async with async_session() as session:
        await _get_tenant_or_404(session, tenant_id)
        new_key = TenantKey(
            tenant_id=tenant_id,
            key_type=key_type,
            key_value=new_key_value,
            label=(payload.label or "Default").strip() or "Default",
            is_active=True,
        )
        session.add(new_key)
        await session.commit()
        await session.refresh(new_key)

    return {
        "message": "Tạo key thành công. Hãy lưu key này ngay vì sẽ không hiển thị lại đầy đủ.",
        "id": str(new_key.id),
        "key_type": new_key.key_type,
        "key_value": new_key_value,
        "label": new_key.label,
        "is_active": new_key.is_active,
        "created_at": new_key.created_at,
    }


@router.delete("/keys/{key_id}", dependencies=[Depends(require_tenant_account)])
async def revoke_key(key_id: UUID, request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_id = request.state.tenant_id
    async with async_session() as session:
        result = await session.execute(
            select(TenantKey).filter(
                TenantKey.id == key_id,
                TenantKey.tenant_id == tenant_id,
            )
        )
        tenant_key = result.scalars().first()
        if not tenant_key:
            raise HTTPException(status_code=404, detail="Key không tồn tại.")

        tenant_key.is_active = False
        await session.commit()

    return {"message": "Thu hồi key thành công."}


# ─────────────────────────────────────────────────────────────────────────────
# Allowed origins API
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/origins", dependencies=[Depends(require_tenant_account)])
async def get_origins(request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_id = request.state.tenant_id
    async with async_session() as session:
        result = await session.execute(
            select(TenantAllowedOrigin)
            .filter(TenantAllowedOrigin.tenant_id == tenant_id)
            .order_by(TenantAllowedOrigin.created_at.desc())
        )
        origins = result.scalars().all()

    return [
        {
            "id": str(origin.id),
            "origin": origin.origin,
            "note": origin.note,
            "created_at": origin.created_at,
        }
        for origin in origins
    ]


@router.post("/origins", status_code=201, dependencies=[Depends(require_tenant_account)])
async def add_origin(payload: AddOriginSchema, request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_id = request.state.tenant_id
    normalized_origin = _normalize_origin(payload.origin)

    async with async_session() as session:
        await _get_tenant_or_404(session, tenant_id)

        existing = await session.execute(
            select(TenantAllowedOrigin).filter(
                TenantAllowedOrigin.tenant_id == tenant_id,
                TenantAllowedOrigin.origin == normalized_origin,
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail="Origin đã tồn tại.")

        origin = TenantAllowedOrigin(
            tenant_id=tenant_id,
            origin=normalized_origin,
            note=payload.note,
        )
        session.add(origin)
        await session.commit()
        await session.refresh(origin)

    return {
        "message": "Thêm origin thành công.",
        "origin": {
            "id": str(origin.id),
            "origin": origin.origin,
            "note": origin.note,
            "created_at": origin.created_at,
        },
    }


@router.delete("/origins/{origin_id}", dependencies=[Depends(require_tenant_account)])
async def delete_origin(origin_id: UUID, request: Request):
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_id = request.state.tenant_id
    async with async_session() as session:
        result = await session.execute(
            select(TenantAllowedOrigin).filter(
                TenantAllowedOrigin.id == origin_id,
                TenantAllowedOrigin.tenant_id == tenant_id,
            )
        )
        origin = result.scalars().first()
        if not origin:
            raise HTTPException(status_code=404, detail="Origin không tồn tại.")

        await session.delete(origin)
        await session.commit()

    return {"message": "Xóa origin thành công."}


# ─────────────────────────────────────────────────────────────────────────────
# Billing summary
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/billing/summary", dependencies=[Depends(require_tenant_account)])
async def get_billing_summary(request: Request):
    """Trả về dữ liệu billing tổng hợp cho dashboard."""
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_id = request.state.tenant_id
    tenant_uuid = UUID(tenant_id)

    async with async_session() as session:
        tenant = await _get_tenant_or_404(session, tenant_id)

        doc_stats_result = await session.execute(
            select(
                func.coalesce(func.sum(TenantDocument.file_size), 0),
                func.count(TenantDocument.id),
            ).filter(TenantDocument.tenant_id == tenant_uuid)
        )
        rag_storage_bytes, rag_document_count = doc_stats_result.one()

        sql_connections_result = await session.execute(
            select(func.count(TenantDatabaseConfig.id)).filter(
                TenantDatabaseConfig.tenant_id == tenant_uuid,
                TenantDatabaseConfig.is_active == True,
            )
        )
        sql_connections = int(sql_connections_result.scalar() or 0)

        plan_key = normalize_plan((tenant.plan or "starter").strip().lower())
        lim = get_limits(plan_key)
        ai_current, ai_limit, ai_window = await get_ai_message_usage_for_billing(
            session, tenant_uuid, plan_key
        )

    return {
        "tenant": {
            "id": str(tenant.id),
            "name": tenant.name,
            "email": tenant.email,
            "plan": plan_key,
        },
        "usage": {
            "ai_messages": {
                "current": ai_current,
                "limit": ai_limit,
                "window": ai_window,
            },
            "rag_storage": {
                "bytes": int(rag_storage_bytes or 0),
                "limit_bytes": lim.rag_storage_bytes,
                "document_count": int(rag_document_count or 0),
                "document_limit": lim.max_documents,
            },
            "sql_connections": {
                "current": sql_connections,
                "limit": lim.max_sql_connections,
            },
        },
        "payment_methods": [],
        "invoices": [],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Analytics (dashboard)
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/analytics/stats", dependencies=[Depends(require_tenant_account)])
async def get_analytics_stats(request: Request):
    """KPI tổng hợp: tin nhắn, tài liệu, token, phân loại RAG/SQL/General."""
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_uuid = UUID(request.state.tenant_id)
    async with async_session() as session:
        data = await fetch_analytics_stats(session, tenant_uuid)
    return data


@router.get("/analytics/history", dependencies=[Depends(require_tenant_account)])
async def get_analytics_history(
    request: Request,
    days: int = Query(30, ge=1, le=366),
):
    """Chuỗi theo ngày (UTC): số tin user — dùng cho biểu đồ xu hướng."""
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_uuid = UUID(request.state.tenant_id)
    async with async_session() as session:
        series = await fetch_message_history_series(session, tenant_uuid, days)
    return {
        "days": days,
        "series": series,
        "kpi_contract": {
            "timezone": "UTC",
            "bucket": "day",
            "metric": "user_messages",
            "source": "chat_messages(role=user)",
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# DB Config endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/database", dependencies=[Depends(require_tenant_account)])
async def save_db_config(config: DBConfigSchema, request: Request):
    """Lưu và mã hoá cấu hình Database khách hàng."""
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_id = request.state.tenant_id
    tenant_uuid = UUID(tenant_id)
    encrypted_user = security_utils.encrypt(config.db_username).encode()
    encrypted_pass = security_utils.encrypt(config.db_password).encode()

    async with async_session() as session:
        tenant_row = await session.get(Tenant, tenant_uuid)
        plan_key = normalize_plan(tenant_row.plan if tenant_row else None)
        lim = get_limits(plan_key)
        if lim.max_sql_connections == 0:
            raise HTTPException(
                status_code=403,
                detail="Gói hiện tại không hỗ trợ Text-to-SQL. Vui lòng nâng cấp gói để kết nối database.",
            )

        active_cfg = await session.execute(
            select(func.count(TenantDatabaseConfig.id)).filter(
                TenantDatabaseConfig.tenant_id == tenant_uuid,
                TenantDatabaseConfig.is_active == True,
            )
        )
        active_count = int(active_cfg.scalar() or 0)

        result = await session.execute(
            select(TenantDatabaseConfig).filter(TenantDatabaseConfig.tenant_id == tenant_uuid)
        )
        db_config = result.scalars().first()

        if db_config:
            db_config.db_type = config.db_type
            db_config.db_host = config.db_host
            db_config.db_port = config.db_port
            db_config.db_name = config.db_name
            db_config.db_user_enc = encrypted_user
            db_config.db_password_enc = encrypted_pass
        else:
            if active_count >= lim.max_sql_connections:
                raise HTTPException(
                    status_code=403,
                    detail=f"Đã đạt số kết nối database tối đa ({lim.max_sql_connections}) cho gói hiện tại.",
                )
            db_config = TenantDatabaseConfig(
                tenant_id=tenant_uuid,
                db_type=config.db_type,
                db_host=config.db_host,
                db_port=config.db_port,
                db_name=config.db_name,
                db_user_enc=encrypted_user,
                db_password_enc=encrypted_pass,
            )
            session.add(db_config)

        await session.commit()

    # Invalidate Text-to-SQL schema cache in Redis (new SQL pipeline).
    try:
        from ai.sql.schema_loader import refresh_schema

        await refresh_schema(tenant_id)
    except Exception as e:
        logger.warning("Failed to refresh SQL schema cache for tenant %s: %s", tenant_id, str(e))

    return {"message": "Cấu hình database đã được lưu thành công."}


@router.get("/database", dependencies=[Depends(require_tenant_account)])
async def get_db_config(request: Request):
    """Lấy cấu hình DB (password sẽ bị ẩn)."""
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_id = request.state.tenant_id
    tenant_uuid = UUID(tenant_id)
    async with async_session() as session:
        result = await session.execute(
            select(TenantDatabaseConfig).filter(
                TenantDatabaseConfig.tenant_id == tenant_uuid
            )
        )
        config = result.scalars().first()
        if not config:
            return {"message": "Chưa có cấu hình database.", "config": None}

        try:
            db_username = security_utils.decrypt(config.db_user_enc.decode())
        except Exception:
            db_username = "Error decrypting"

        return {
            "config": {
                "db_type": config.db_type,
                "db_host": config.db_host,
                "db_port": config.db_port,
                "db_name": config.db_name,
                "db_username": db_username,
                "db_password": "••••••••",
            }
        }


@router.post("/database/test", dependencies=[Depends(require_tenant_account)])
async def test_db_connection(config: DBConfigSchema, request: Request):
    """Kiểm tra kết nối tới database của khách hàng mà không lưu cấu hình."""
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_uuid = UUID(request.state.tenant_id)
    async with async_session() as session:
        tenant_row = await session.get(Tenant, tenant_uuid)
        plan_key = normalize_plan(tenant_row.plan if tenant_row else None)
        if get_limits(plan_key).max_sql_connections == 0:
            raise HTTPException(
                status_code=403,
                detail="Gói hiện tại không hỗ trợ Text-to-SQL.",
            )

    driver = "postgresql+asyncpg" if config.db_type == "postgresql" else "mysql+aiomysql"

    url = URL.create(
        drivername=driver,
        username=config.db_username,
        password=config.db_password,
        host=config.db_host,
        port=config.db_port,
        database=config.db_name,
    )

    try:
        engine = create_async_engine(url, future=True)
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        await engine.dispose()
        return {"message": "Kết nối thành công!", "status": "success"}
    except Exception as e:
        return {
            "message": f"Kết nối thất bại: {str(e)}",
            "status": "error"
        }


# ─────────────────────────────────────────────────────────────────────────────
# Conversation History
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/conversations", response_model=List[ChatSessionSchema], dependencies=[Depends(require_tenant_account)])
async def get_conversations(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Lấy danh sách các phiên chat của tenant (phân trang)."""
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_uuid = UUID(request.state.tenant_id)
    offset = (page - 1) * page_size

    async with async_session() as session:
        result = await session.execute(
            select(ChatSession)
            .filter(ChatSession.tenant_id == tenant_uuid)
            .order_by(ChatSession.last_active_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        sessions = result.scalars().all()

    return [
        ChatSessionSchema(
            id=s.id,
            visitor_id=s.visitor_id,
            message_count=s.message_count,
            is_active=s.is_active,
            started_at=s.started_at,
            last_active_at=s.last_active_at,
            ended_at=s.ended_at,
        )
        for s in sessions
    ]


@router.get("/conversations/{session_id}", response_model=List[ChatMessageSchema], dependencies=[Depends(require_tenant_account)])
async def get_conversation_messages(session_id: UUID, request: Request):
    """Lấy chi tiết các tin nhắn trong một phiên chat."""
    if not request.state.is_admin:
        raise HTTPException(status_code=403, detail="Yêu cầu Bearer token hợp lệ")

    tenant_uuid = UUID(request.state.tenant_id)

    async with async_session() as session:
        # Verify session belongs to tenant
        session_result = await session.execute(
            select(ChatSession).filter(
                ChatSession.id == session_id,
                ChatSession.tenant_id == tenant_uuid
            )
        )
        chat_session = session_result.scalars().first()
        if not chat_session:
            raise HTTPException(status_code=404, detail="Phiên hội thoại không tồn tại.")

        # Get messages
        messages_result = await session.execute(
            select(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
        )
        messages = messages_result.scalars().all()

    return [
        ChatMessageSchema(
            id=m.id,
            role=m.role,
            content=m.content,
            intent=m.intent,
            rag_sources=m.rag_sources,
            sql_query=m.sql_query,
            latency_ms=m.latency_ms,
            token_count=m.token_count,
            created_at=m.created_at,
        )
        for m in messages
    ]


from api.v1 import admin_sales  # noqa: E402

router.include_router(admin_sales.router)