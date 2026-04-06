from typing import List, Dict, Any, Literal, Optional, NotRequired, TypedDict
from uuid import UUID

import json
import logging

from langgraph.graph import StateGraph, END
from sqlalchemy import func, select

from ai.base_agent import AgentResponse
from ai.llm import gemini_manager
from ai.memory import RedisConversationMemory
from ai.rag_agent import RAGAgent
from ai.sql_agent import SQLAgent
from core.plan_limits import normalize_plan, plan_allows_sql
from db.session import async_session
from models.ai_settings import TenantAiSettings
from models.tenant import Tenant
from models.tenant_db_config import TenantDatabaseConfig

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_PROMPT = "Bạn là một trợ lý AI thân thiện và hữu ích."
# Khớp default ORM `TenantAiSettings.system_prompt` để biết tenant có chỉnh hay không
FACTORY_SYSTEM_PROMPT_DB = "Ban la mot tro ly AI chuyen nghiep va than thien."


SqlBlockedReason = Optional[Literal["plan", "feature_disabled", "no_database_config"]]


class AgentState(TypedDict):
    query: str
    tenant_id: str
    session_id: str
    history: List[Dict[str, str]]
    intent: Optional[Literal["RAG", "SQL", "GENERAL"]]
    response: Optional[AgentResponse]
    is_rag_enabled: NotRequired[bool]
    is_sql_enabled: NotRequired[bool]
    sql_blocked_reason: NotRequired[Optional[str]]
    system_prompt: NotRequired[str]
    use_custom_system_prompt: NotRequired[bool]


def resolve_sql_route_state(
    plan_key: str,
    is_sql_feature_enabled: bool,
    has_active_database_row: bool,
) -> tuple[bool, SqlBlockedReason]:
    """(sql_khả_dụng, lý_do_khóa) — dùng cho router và thông báo khi intent SQL nhưng không chạy sql_node."""
    if not plan_allows_sql(plan_key):
        return False, "plan"
    if not is_sql_feature_enabled:
        return False, "feature_disabled"
    if not has_active_database_row:
        return False, "no_database_config"
    return True, None


async def history_loader_node(state: AgentState) -> Dict[str, Any]:
    memory = RedisConversationMemory(state["tenant_id"], state["session_id"])
    history = await memory.get_history()
    return {"history": history}


async def settings_loader_node(state: AgentState) -> Dict[str, Any]:
    """Load TenantAiSettings: flags RAG/SQL và system_prompt từ DB."""
    tenant_id = state["tenant_id"]
    try:
        tenant_uuid = UUID(str(tenant_id))
        async with async_session() as session:
            result = await session.execute(
                select(Tenant, TenantAiSettings)
                .outerjoin(
                    TenantAiSettings,
                    TenantAiSettings.tenant_id == Tenant.id,
                )
                .filter(Tenant.id == tenant_uuid)
            )
            row = result.first()

            if row:
                tenant_row, ai_settings = row
                plan_key = normalize_plan(tenant_row.plan)
                flag_ok = bool(ai_settings and ai_settings.is_sql_enabled)

                cnt_res = await session.execute(
                    select(func.count(TenantDatabaseConfig.id)).where(
                        TenantDatabaseConfig.tenant_id == tenant_uuid,
                        TenantDatabaseConfig.is_active.is_(True),
                    )
                )
                has_db = int(cnt_res.scalar_one() or 0) > 0
                sql_ok, sql_reason = resolve_sql_route_state(
                    plan_key, flag_ok, has_db
                )

                if ai_settings:
                    raw_prompt = (ai_settings.system_prompt or "").strip()
                    effective = raw_prompt or DEFAULT_SYSTEM_PROMPT
                    use_custom = bool(raw_prompt) and (
                        raw_prompt != FACTORY_SYSTEM_PROMPT_DB
                    )
                    return {
                        "is_rag_enabled": bool(ai_settings.is_rag_enabled),
                        "is_sql_enabled": sql_ok,
                        "sql_blocked_reason": sql_reason,
                        "system_prompt": effective,
                        "use_custom_system_prompt": use_custom,
                    }
                return {
                    "is_rag_enabled": True,
                    "is_sql_enabled": sql_ok,
                    "sql_blocked_reason": sql_reason,
                    "system_prompt": DEFAULT_SYSTEM_PROMPT,
                    "use_custom_system_prompt": False,
                }
    except Exception as e:
        logger.warning(
            "settings_loader_node failed for tenant %s: %s", tenant_id, str(e)
        )

    return {
        "is_rag_enabled": True,
        "is_sql_enabled": False,
        "sql_blocked_reason": None,
        "system_prompt": DEFAULT_SYSTEM_PROMPT,
        "use_custom_system_prompt": False,
    }


async def classifier_node(state: AgentState) -> Dict[str, Any]:
    query = state["query"]
    history = state["history"] if "history" in state else []

    history_context = "\n".join(
        [f"{m['role']}: {m['content']}" for m in history[-3:]]
    )

    prompt = f"""
    Bạn là một AI router chuyên nghiệp cho hệ thống đa khách hàng (SaaS).
    Hãy phân loại câu hỏi của người dùng vào một trong 3 nhóm sau:
    1. RAG: Câu hỏi liên quan đến tìm kiếm thông tin trong tài liệu (PDF, Word, Kiến thức nội bộ).
    2. SQL: Câu hỏi liên quan đến truy vấn dữ liệu có cấu trúc, báo cáo, con số (Doanh thu, số lượng nhân viên, danh sách khách hàng).
    3. GENERAL: Câu chào hỏi, tán gẫu, hoặc các câu hỏi không thuộc 2 nhóm trên.

    BỐI CẢNH LỊCH SỬ (3 câu gần nhất):
    {history_context}

    CÂU HỎI HIỆN TẠI: {query}

    Trả về kết quả DUY NHẤT dưới dạng JSON: {{"intent": "RAG" | "SQL" | "GENERAL"}}
    """

    try:
        model = gemini_manager.get_model()
        res = await model.generate_content_async(
            prompt,
            generation_config={"response_mime_type": "application/json"},
        )
        data = json.loads(res.text)
        intent = data.get("intent", "GENERAL")
    except Exception as e:
        logger.error("Classifier error: %s", str(e))
        intent = "GENERAL"

    return {"intent": intent}


async def rag_node(state: AgentState) -> Dict[str, Any]:
    try:
        agent = RAGAgent(state["tenant_id"])
        sys_p = state.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
        response = await agent.arun(
            state["query"],
            context={
                "history": state["history"] if "history" in state else [],
                "system_prompt": sys_p,
                "use_custom_system_prompt": state.get(
                    "use_custom_system_prompt", False
                ),
            },
        )

        if "sản phẩm" in state["query"].lower():
            response.component = {
                "type": "product_grid",
                "data": [
                    {
                        "id": "p1",
                        "name": "Premium Plan",
                        "price": "1.5Mđ",
                        "image_url": "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=200",
                    },
                    {
                        "id": "p2",
                        "name": "Enterprise Suite",
                        "price": "5.0Mđ",
                        "image_url": "https://images.unsplash.com/photo-1558655146-d09347e92766?w=200",
                    },
                ],
            }

        response = response.model_copy(
            update={"metadata": {**response.metadata, "intent": "RAG"}}
        )
        return {"response": response}
    except Exception as e:
        logger.error("RAG Node error: %s", str(e))
        return {
            "response": AgentResponse(
                content=f"Lỗi khi truy vấn tài liệu: {str(e)}",
                metadata={"error": True, "intent": "RAG"},
            )
        }


async def sql_node(state: AgentState) -> Dict[str, Any]:
    try:
        agent = SQLAgent(state["tenant_id"])
        response = await agent.arun(state["query"])

        if "thống kê" in state["query"].lower() or "báo cáo" in state["query"].lower():
            response.component = {
                "type": "bar_chart",
                "data": {
                    "label": "Tương tác khách hàng",
                    "labels": ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
                    "values": [250, 420, 380, 560, 890, 1100, 950],
                },
            }

        response = response.model_copy(
            update={"metadata": {**response.metadata, "intent": "SQL"}}
        )
        return {"response": response}
    except Exception as e:
        logger.error("SQL Node error: %s", str(e))
        return {
            "response": AgentResponse(
                content=f"Lỗi khi truy vấn database: {str(e)}",
                metadata={"error": True, "intent": "SQL"},
            )
        }


_SQL_BLOCKED_MESSAGES: Dict[str, str] = {
    "plan": (
        "Gói đăng ký hiện tại không bao gồm truy vấn dữ liệu (Text-to-SQL). "
        "Vui lòng nâng cấp gói nếu bạn cần tính năng này."
    ),
    "feature_disabled": (
        "Tính năng truy vấn dữ liệu đang tắt trong cài đặt AI. "
        "Bạn có thể bật trong phần Cài đặt trên Dashboard."
    ),
    "no_database_config": (
        "Xin lỗi, tính năng truy vấn dữ liệu chưa được cấu hình. "
        "Vui lòng thêm kết nối cơ sở dữ liệu trong Dashboard (mục Database)."
    ),
}


async def general_node(state: AgentState) -> Dict[str, Any]:
    try:
        if (
            state.get("intent") == "SQL"
            and not state.get("is_sql_enabled", False)
        ):
            reason = state.get("sql_blocked_reason")
            msg = _SQL_BLOCKED_MESSAGES.get(reason or "")
            if msg:
                return {
                    "response": AgentResponse(
                        content=msg,
                        metadata={
                            "intent": "GENERAL",
                            "sql_unavailable": True,
                            "sql_blocked_reason": reason,
                        },
                    )
                }
            return {
                "response": AgentResponse(
                    content=(
                        "Hiện tại tôi không thể truy vấn dữ liệu theo yêu cầu. "
                        "Vui lòng thử lại sau hoặc liên hệ quản trị viên."
                    ),
                    metadata={"intent": "GENERAL", "sql_unavailable": True},
                ),
            }

        history = state["history"] if "history" in state else []
        history_context = "\n".join(
            [f"{m['role']}: {m['content']}" for m in history[-5:]]
        )
        tenant_system = state.get("system_prompt", DEFAULT_SYSTEM_PROMPT)

        full_system_prompt = f"""{tenant_system}

LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY:
{history_context}"""

        model = gemini_manager.get_model(system_instruction=full_system_prompt)
        res = await model.generate_content_async(state["query"])
        return {
            "response": AgentResponse(
                content=res.text,
                metadata={
                    "intent": "GENERAL",
                    "node": "general",
                    "used_custom_prompt": bool(
                        state.get("use_custom_system_prompt", False)
                    ),
                },
            )
        }
    except Exception:
        return {
            "response": AgentResponse(
                content="Xin lỗi, tôi gặp sự cố kỹ thuật.",
                metadata={"error": True, "intent": "GENERAL"},
            )
        }


async def history_saver_node(state: AgentState) -> Dict[str, Any]:
    memory = RedisConversationMemory(state["tenant_id"], state["session_id"])
    await memory.add_message("user", state["query"])
    if state["response"]:
        await memory.add_message("assistant", state["response"].content)
    return {"query": state["query"]}


def route_by_intent(state: AgentState) -> str:
    intent = state.get("intent")
    is_rag_enabled = state.get("is_rag_enabled", True)
    is_sql_enabled = state.get("is_sql_enabled", False)

    if intent == "RAG":
        if is_rag_enabled:
            return "rag_node"
        logger.info(
            "RAG disabled for tenant %s, fallback to general", state.get("tenant_id")
        )
        return "general_node"

    if intent == "SQL":
        if is_sql_enabled:
            return "sql_node"
        logger.info(
            "SQL disabled for tenant %s, fallback to general", state.get("tenant_id")
        )
        return "general_node"

    return "general_node"


workflow = StateGraph(AgentState)

workflow.add_node("loader", history_loader_node)
workflow.add_node("settings_loader", settings_loader_node)
workflow.add_node("classifier", classifier_node)
workflow.add_node("rag_node", rag_node)
workflow.add_node("sql_node", sql_node)
workflow.add_node("general_node", general_node)
workflow.add_node("saver", history_saver_node)

workflow.set_entry_point("loader")
workflow.add_edge("loader", "settings_loader")
workflow.add_edge("settings_loader", "classifier")

workflow.add_conditional_edges(
    "classifier",
    route_by_intent,
    {
        "rag_node": "rag_node",
        "sql_node": "sql_node",
        "general_node": "general_node",
    },
)

workflow.add_edge("rag_node", "saver")
workflow.add_edge("sql_node", "saver")
workflow.add_edge("general_node", "saver")
workflow.add_edge("saver", END)

orchestrator_graph = workflow.compile()
