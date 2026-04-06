import logging

from ai.sql.schema_loader import get_schema, refresh_schema
from ai.sql.generator import generate_sql
from ai.sql.executor import execute_sql
from ai.sql.formatter import format_sql_result

logger = logging.getLogger(__name__)


def _q_preview(question: str, max_len: int = 200) -> str:
    q = (question or "").strip()
    if len(q) <= max_len:
        return q
    return q[:max_len] + "…"


async def run_text_to_sql(
    tenant_id: str,
    question: str,
    user_role: str = "employee",
    user_id: str = "",
    department_id: str = ""
):
    """
    Pipeline đầy đủ: get_schema -> generate -> execute -> format.
    """
    logger.info(
        "Text2SQL pipeline start | tenant=%s | question=%r",
        tenant_id,
        _q_preview(question),
    )

    # 1. Get Schema
    schema = await get_schema(tenant_id)
    if "error" in schema:
        err = schema["error"]
        logger.warning(
            "Text2SQL schema failed | tenant=%s | error=%s",
            tenant_id,
            err,
        )
        return {"status": "ERROR", "message": err}

    dialect = schema.get("dialect", "?")
    n_tables = len(schema.get("tables") or {})
    logger.info(
        "Text2SQL schema ok | tenant=%s | dialect=%s | tables=%s",
        tenant_id,
        dialect,
        n_tables,
    )

    # 2. Generate SQL
    gen_res = await generate_sql(
        question=question,
        schema=schema,
        user_role=user_role,
        user_id=user_id,
        department_id=department_id
    )

    if gen_res["status"] != "SUCCESS":
        logger.info(
            "Text2SQL generate finished | tenant=%s | status=%s | detail=%s",
            tenant_id,
            gen_res.get("status"),
            gen_res.get("message", "")[:300],
        )
        return gen_res

    sql_preview = (gen_res.get("sql") or "")[:800]
    logger.debug("Text2SQL generated sql | tenant=%s | sql=%s", tenant_id, sql_preview)

    # 3. Execute SQL (includes self-correction)
    exec_res = await execute_sql(
        tenant_id=tenant_id,
        question=question,
        sql=gen_res["sql"],
        schema=schema,
        user_role=user_role,
        user_id=user_id,
        department_id=department_id
    )

    if exec_res["status"] != "SUCCESS":
        logger.warning(
            "Text2SQL execute failed | tenant=%s | last_error=%s",
            tenant_id,
            (exec_res.get("last_error") or exec_res.get("message") or "")[:500],
        )
        return exec_res

    row_count = len(exec_res.get("rows") or [])
    logger.info(
        "Text2SQL execute ok | tenant=%s | rows=%s | attempts=%s",
        tenant_id,
        row_count,
        exec_res.get("attempt", 0),
    )

    # 4. Format Result
    final_res = await format_sql_result(
        question=question,
        rows=exec_res["rows"],
        columns=exec_res["columns"],
        sql_executed=exec_res["sql_executed"],
        tenant_id=tenant_id
    )

    logger.info(
        "Text2SQL pipeline success | tenant=%s | row_count=%s",
        tenant_id,
        final_res.get("row_count", row_count),
    )

    return {
        "status": "SUCCESS",
        **final_res
    }

__all__ = [
    "run_text_to_sql",
    "get_schema",
    "refresh_schema",
    "generate_sql",
    "execute_sql",
    "format_sql_result"
]
