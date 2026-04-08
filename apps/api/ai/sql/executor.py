import logging
import re
from typing import Any, Dict, List, Set

import sqlparse
from sqlalchemy import text
from sqlparse.tokens import DDL, DML, Keyword

from ai.sql.generator import generate_sql
from db.tenant_db import engine_manager

logger = logging.getLogger(__name__)

FORBIDDEN_KEYWORDS = {
    "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
    "TRUNCATE", "EXEC", "EXECUTE", "MERGE", "REPLACE",
    "CALL", "GRANT", "REVOKE", "LOAD", "COPY",
}
FORBIDDEN_SYSTEM_SCHEMAS = ("information_schema.", "pg_catalog.")
_FROM_JOIN_PATTERN = re.compile(
    r"\b(?:from|join)\s+([a-zA-Z0-9_.\"]+)",
    re.IGNORECASE,
)


def _extract_table_refs(sql: str) -> Set[str]:
    refs: Set[str] = set()
    for match in _FROM_JOIN_PATTERN.findall(sql or ""):
        table = match.strip().strip('"')
        if "." in table:
            table = table.split(".")[-1]
        refs.add(table.lower())
    return refs


def _ensure_known_tables(sql: str, schema: Dict[str, Any]) -> None:
    tables = schema.get("tables") or {}
    if not tables:
        return

    known = {str(name).lower() for name in tables.keys()}
    refs = _extract_table_refs(sql)
    unknown = sorted(ref for ref in refs if ref and ref not in known)
    if unknown:
        raise ValueError(
            "SQL tham chiếu bảng không có trong schema tenant: "
            + ", ".join(unknown[:5])
        )


def _ensure_row_limit(sql: str, default_limit: int = 100) -> str:
    if re.search(r"\blimit\s+\d+\b", sql, re.IGNORECASE):
        return sql.rstrip().rstrip(";")
    return f"{sql.rstrip().rstrip(';')} LIMIT {default_limit}"


def _validate_sql(sql: str, schema: Dict[str, Any] | None = None) -> str:
    """Kiểm tra SQL an toàn và trả về SQL đã chuẩn hóa."""
    raw = (sql or "").strip()
    parsed = sqlparse.parse(raw)
    if not parsed:
        raise ValueError("SQL rỗng hoặc không hợp lệ.")
    if len(parsed) != 1:
        raise ValueError("Không cho phép nhiều câu lệnh trong một request.")

    lowered = raw.lower()
    if any(schema_name in lowered for schema_name in FORBIDDEN_SYSTEM_SCHEMAS):
        raise ValueError("Không cho phép truy vấn system schema.")

    for stmt in parsed:
        for token in stmt.flatten():
            if token.ttype in (DDL, DML, Keyword):
                upper = token.normalized.upper()
                if upper in FORBIDDEN_KEYWORDS:
                    raise ValueError(f"Câu lệnh bị cấm: [{upper}]")

        stmt_type = stmt.get_type()
        if stmt_type and stmt_type.upper() != "SELECT":
            raise ValueError(f"Chỉ cho phép SELECT. Phát hiện: {stmt_type}")

    if ";" in raw.rstrip(";"):
        raise ValueError("Không cho phép nhiều câu lệnh trong một request.")

    _ensure_known_tables(raw, schema or {})
    return _ensure_row_limit(raw)

async def execute_sql(
    tenant_id: str,
    question: str,
    sql: str,
    schema: Dict[str, Any],
    user_role: str = "employee",
    user_id: str = "",
    department_id: str = "",
    max_retries: int = 5
) -> Dict[str, Any]:
    """Thực thi SQL với vòng lặp tự sửa lỗi."""
    current_sql = sql.strip()
    last_error = ""

    for attempt in range(max_retries + 1):
        try:
            # 1. Validate + normalize
            current_sql = _validate_sql(current_sql, schema)

            # 2. Execute
            session = await engine_manager.get_session(tenant_id)
            if not session:
                return {"status": "ERROR", "message": "Không thể kết nối Database tenant."}

            async with session:
                # Set timeout 10s cho statement
                await session.execute(text("SET LOCAL statement_timeout = 10000"))
                result = await session.execute(text(current_sql))

                columns = list(result.keys())
                rows = [dict(zip(columns, row)) for row in result.fetchall()]

                logger.info(f"SQL Success | tenant={tenant_id} | attempt={attempt} | rows={len(rows)}")
                return {
                    "status": "SUCCESS",
                    "rows": rows,
                    "columns": columns,
                    "sql_executed": current_sql,
                    "attempt": attempt
                }

        except Exception as e:
            last_error = str(e)
            logger.warning(f"SQL Failed | tenant={tenant_id} | attempt={attempt} | error={last_error}")

            if attempt >= max_retries:
                break

            # 3. Self-correction: Generate lại SQL với context lỗi
            gen_result = await generate_sql(
                question=question,
                schema=schema,
                user_role=user_role,
                user_id=user_id,
                department_id=department_id,
                previous_sql=current_sql,
                error_message=last_error
            )

            if gen_result.get("status") == "SUCCESS":
                current_sql = gen_result["sql"]
            else:
                # Nếu không generate lại được thì dừng luôn
                return gen_result

    return {
        "status": "ERROR",
        "message": f"Không thể thực thi SQL sau {max_retries} lần thử.",
        "last_error": last_error,
        "sql_attempted": current_sql
    }
