import logging
import json
from typing import Any, Dict, Optional
from ai.base_agent import BaseAgent, AgentResponse
from ai.sql import run_text_to_sql

logger = logging.getLogger(__name__)

class SQLAgent(BaseAgent):
    """
    Agent for querying tenant's relational database.
    Now using the upgraded production-ready Text-to-SQL pipeline.
    """

    async def arun(self, query: str, context: Optional[Dict[str, Any]] = None) -> AgentResponse:
        """
        Thực hiện truy vấn SQL dựa trên câu hỏi của người dùng.
        """
        try:
            # 1. Thu thập thông tin phân quyền từ context (nếu có)
            user_id = ""
            department_id = ""
            user_role = "employee"
            
            if context:
                user_id = context.get("user_id", "")
                department_id = context.get("department_id", "")
                user_role = context.get("user_role", "employee")

            logger.info(
                "SQLAgent.arun | tenant=%s | q=%r",
                self.tenant_id,
                (query[:200] + "…") if len(query) > 200 else query,
            )

            # 2. Chạy pipeline Text-to-SQL
            result = await run_text_to_sql(
                tenant_id=self.tenant_id,
                question=query,
                user_role=user_role,
                user_id=user_id,
                department_id=department_id
            )

            # 3. Xử lý kết quả trả về
            if result["status"] == "SUCCESS":
                # Trả về câu trả lời tự nhiên kèm bảng markdown trong content
                content = f"{result['answer']}\n\n{result['table']}"
                
                return AgentResponse(
                    content=content,
                    metadata={
                        "sql": result.get("sql"),
                        "row_count": result.get("row_count"),
                        "tenant_id": self.tenant_id,
                        "agent_type": "sql"
                    }
                )
            
            elif result["status"] == "CLARIFY":
                # LLM cần hỏi thêm thông tin
                return AgentResponse(
                    content=result["message"],
                    metadata={"status": "clarify"}
                )
            
            else:
                # Có lỗi xảy ra trong quá trình sinh hoặc thực thi SQL
                error_msg = result.get("message", "Đã có lỗi xảy ra khi truy vấn dữ liệu.")
                last_err = result.get("last_error") or ""
                logger.error(
                    "SQLAgent pipeline error | tenant=%s | msg=%s | last_error=%s",
                    self.tenant_id,
                    error_msg,
                    last_err[:500] if last_err else "",
                )
                return AgentResponse(content=f"⚠️ {error_msg}")

        except Exception as e:
            logger.exception(
                "SQLAgent unexpected error | tenant=%s",
                self.tenant_id,
            )
            return AgentResponse(
                content="❌ Đã có lỗi xảy ra khi truy vấn dữ liệu. Vui lòng thử lại sau."
            )
