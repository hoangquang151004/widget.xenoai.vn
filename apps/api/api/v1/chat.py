import asyncio
import json
import logging
from datetime import datetime
from typing import AsyncGenerator, Optional
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.future import select

from ai.llm import gemini_manager
from ai.memory import RedisConversationMemory
from ai.orchestrator import orchestrator_graph
from db.session import async_session
from models.allowed_origin import TenantAllowedOrigin
from models.chat import ChatMessage, ChatSession
from models.tenant import Tenant
from models.tenant_key import TenantKey
from models.widget_config import TenantWidgetConfig

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatRequest(BaseModel):
    query: str
    session_id: Optional[str] = "default"


async def _stream_gemini(
    tenant_id: str,
    session_id: str,
    query: str,
) -> AsyncGenerator[str, None]:
    """Yields SSE-formatted chunks from Gemini streaming API."""
    try:
        memory = RedisConversationMemory(tenant_id, session_id)
        history = await memory.get_history()
        history_context = "\n".join(
            [f"{m['role']}: {m['content']}" for m in history[-5:]]
        )

        system_prompt = (
            "Bạn là trợ lý AI hỗ trợ khách hàng.\n"
            f"LỊCH SỬ TRÒ CHUYỆN:\n{history_context}"
        )

        model = gemini_manager.get_model(system_instruction=system_prompt)
        full_text = ""

        async for chunk in await model.generate_content_async(
            query,
            stream=True,
        ):
            if chunk.text:
                full_text += chunk.text
                payload = json.dumps({"chunk": chunk.text, "done": False}, ensure_ascii=False)
                yield f"data: {payload}\n\n"

        yield f"data: {json.dumps({'chunk': '', 'done': True}, ensure_ascii=False)}\n\n"

        await memory.add_message("user", query)
        await memory.add_message("assistant", full_text)

    except Exception as e:
        logger.error("Stream error for tenant %s: %s", tenant_id, str(e))
        error_payload = json.dumps({"error": str(e), "done": True}, ensure_ascii=False)
        yield f"data: {error_payload}\n\n"


async def _persist_stream_messages_best_effort(
    tenant_id: str,
    session_id: str,
    query: str,
    response_text: str,
    response_metadata: Optional[dict] = None,
):
    """Persist stream messages without interrupting user response flow on failure."""
    try:
        tenant_uuid = UUID(str(tenant_id))
    except Exception:
        logger.warning("Skip stream persistence due to invalid tenant UUID: %s", tenant_id)
        return

    try:
        async with async_session() as session:
            session_result = await session.execute(
                select(ChatSession)
                .filter(
                    ChatSession.tenant_id == tenant_uuid,
                    ChatSession.visitor_id == session_id,
                    ChatSession.is_active == True,
                )
                .order_by(ChatSession.last_active_at.desc())
            )
            chat_session = session_result.scalars().first()

            if not chat_session:
                chat_session = ChatSession(
                    tenant_id=tenant_uuid,
                    visitor_id=session_id,
                    is_active=True,
                    started_at=datetime.utcnow(),
                    last_active_at=datetime.utcnow(),
                    message_count=0,
                )
                session.add(chat_session)
                await session.flush()
            else:
                chat_session.last_active_at = datetime.utcnow()

            metadata = response_metadata or {}

            user_message = ChatMessage(
                session_id=chat_session.id,
                tenant_id=tenant_uuid,
                role="user",
                content=query,
                intent=metadata.get("intent") if isinstance(metadata, dict) else None,
            )
            assistant_message = ChatMessage(
                session_id=chat_session.id,
                tenant_id=tenant_uuid,
                role="assistant",
                content=response_text,
                intent=metadata.get("intent") if isinstance(metadata, dict) else None,
                sql_query=metadata.get("sql_query") if isinstance(metadata, dict) else None,
            )

            session.add(user_message)
            session.add(assistant_message)
            chat_session.message_count = (chat_session.message_count or 0) + 2

            await session.commit()
    except Exception as e:
        logger.warning("Best-effort stream persistence failed: %s", str(e))


@router.get("/config")
async def get_widget_config(request: Request):
    """Lấy cấu hình widget theo public key từ tenant_keys + tenant_widget_configs."""
    api_key = request.headers.get("X-Widget-Key") or request.headers.get("X-API-Key")
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API Key")

    async with async_session() as session:
        key_result = await session.execute(
            select(TenantKey, Tenant)
            .join(Tenant, TenantKey.tenant_id == Tenant.id)
            .filter(
                TenantKey.key_value == api_key,
                TenantKey.key_type == "public",
                TenantKey.is_active == True,
                Tenant.is_active == True,
            )
        )
        row = key_result.first()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid API Key")

        _, tenant = row

        origin = request.headers.get("Origin") or request.headers.get("Referer")
        if origin:
            parsed_origin = urlparse(origin).netloc.strip().lower()
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

            if "*" not in allowed_origins and parsed_origin not in allowed_origins:
                logger.warning(
                    "Domain mismatch for config: %s not in %s",
                    parsed_origin,
                    allowed_origins,
                )
                raise HTTPException(status_code=403, detail="Domain not authorized")

        widget_result = await session.execute(
            select(TenantWidgetConfig).filter(TenantWidgetConfig.tenant_id == tenant.id)
        )
        widget = widget_result.scalars().first()

        if not widget:
            return {
                "bot_name": "Tro ly AI",
                "primary_color": "#2563eb",
                "greeting": "Xin chao! Toi co the giup gi cho ban?",
                "placeholder": "Nhap cau hoi...",
                "position": "bottom-right",
                "show_sources": True,
                "name": tenant.name,
                "widget_color": "#2563eb",
                "widget_placeholder": "Nhap cau hoi...",
                "widget_position": "bottom-right",
                "widget_welcome_message": "Xin chao! Toi co the giup gi cho ban?",
            }

        return {
            "bot_name": widget.bot_name,
            "primary_color": widget.primary_color,
            "greeting": widget.greeting,
            "placeholder": widget.placeholder,
            "position": widget.position,
            "show_sources": widget.show_sources,
            "name": widget.bot_name,
            "widget_color": widget.primary_color,
            "widget_placeholder": widget.placeholder,
            "widget_position": widget.position,
            "widget_welcome_message": widget.greeting,
            "widget_avatar_url": widget.logo_url,
            "widget_font_size": widget.font_size,
            "widget_show_logo": bool(widget.logo_url),
        }


@router.get("/test")
async def chat_test_endpoint(request: Request):
    """Endpoint dùng để test auth và middleware."""
    return {
        "message": "Xác thực thành công",
        "tenant_id": request.state.tenant_id,
        "tenant_name": request.state.tenant_name,
        "is_admin": request.state.is_admin
    }


@router.post("")
async def chat_endpoint(request: Request, body: ChatRequest):
    """Main chat endpoint — LangGraph Orchestrator."""
    tenant_id = request.state.tenant_id
    query = body.query
    session_id = body.session_id

    logger.info("Chat request: tenant=%s, session=%s", tenant_id, session_id)

    try:
        inputs = {
            "query": query,
            "tenant_id": tenant_id,
            "session_id": session_id,
            "history": [],
            "intent": None,
            "response": None,
        }
        final_state = await orchestrator_graph.ainvoke(inputs)
        agent_response = final_state.get("response")

        if not agent_response:
            raise HTTPException(status_code=500, detail="AI Agent không tạo được phản hồi.")

        return {
            "content": agent_response.content,
            "metadata": agent_response.metadata,
            "citations": getattr(agent_response, "citations", []),
            "component": getattr(agent_response, "component", None),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Chat error for tenant %s: %s", tenant_id, str(e))
        raise HTTPException(status_code=500, detail=f"Lỗi AI nội bộ: {str(e)}")


@router.get("/stream")
async def chat_stream_endpoint(
    request: Request,
    query: str,
    session_id: str = "default",
):
    """Streaming endpoint qua SSE (GET)."""
    tenant_id = request.state.tenant_id

    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query không được để trống.")

    logger.info("Stream request: tenant=%s, session=%s", tenant_id, session_id)

    return StreamingResponse(
        _stream_gemini(tenant_id, session_id, query.strip()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/stream")
async def chat_stream_post_endpoint(request: Request, body: ChatRequest):
    """Streaming endpoint qua SSE (POST) với best-effort persistence chat session/messages."""
    tenant_id = request.state.tenant_id
    query = body.query
    session_id = body.session_id or "default"

    async def event_stream():
        yield f"data: {json.dumps({'chunk': '', 'done': False}, ensure_ascii=False)}\n\n"

        inputs = {
            "query": query,
            "tenant_id": tenant_id,
            "session_id": session_id,
            "history": [],
            "intent": None,
            "response": None,
        }

        try:
            final_state = await orchestrator_graph.ainvoke(inputs)
            agent_response = final_state.get("response")

            if not agent_response:
                yield f"data: {json.dumps({'error': 'AI Agent không tạo được phản hồi.', 'done': True}, ensure_ascii=False)}\n\n"
                return

            content = agent_response.content or ""
            words = content.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                payload = json.dumps({"chunk": chunk, "done": False}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
                await asyncio.sleep(0.02)

            final_payload = {
                "chunk": "",
                "done": True,
                "metadata": agent_response.metadata,
                "citations": getattr(agent_response, "citations", []),
                "component": getattr(agent_response, "component", None),
            }
            yield f"data: {json.dumps(final_payload, ensure_ascii=False)}\n\n"

            await _persist_stream_messages_best_effort(
                tenant_id=tenant_id,
                session_id=session_id,
                query=query,
                response_text=content,
                response_metadata=agent_response.metadata if isinstance(agent_response.metadata, dict) else {},
            )
        except Exception as e:
            logger.error("Stream error for tenant %s: %s", tenant_id, str(e))
            yield f"data: {json.dumps({'error': str(e), 'done': True}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )