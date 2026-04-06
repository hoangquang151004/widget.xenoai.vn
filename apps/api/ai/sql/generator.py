import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from ai.llm import gemini_manager

logger = logging.getLogger(__name__)

_EXAMPLES_PATH = Path(__file__).resolve().parent / "few_shot_examples.json"
_TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9_]+", re.IGNORECASE)

def _normalize_tokens(text: str) -> Set[str]:
    return {token.lower() for token in _TOKEN_PATTERN.findall(text or "")}

def _schema_to_text(schema: Dict[str, Any]) -> str:
    """Chuyển schema dict thành chuỗi ngắn gọn để inject vào prompt."""
    tables = schema.get("tables", {})
    if not tables:
        return "Không có thông tin schema."

    lines: List[str] = []
    for table_name, table_info in list(tables.items())[:40]:
        columns = table_info.get("columns", [])
        foreign_keys = table_info.get("foreign_keys", [])

        col_parts: List[str] = []
        for col in columns[:15]:
            col_name = col.get("name")
            col_type = col.get("type")
            mark = " PK" if col.get("primary_key") else ""
            col_parts.append(f"{col_name} ({col_type}){mark}")

        fk_parts: List[str] = []
        for fk in foreign_keys[:5]:
            col = fk.get("column")
            ref_table = fk.get("ref_table")
            ref_col = fk.get("ref_column")
            fk_parts.append(f"{col} FK->{ref_table}.{ref_col}")

        detail = ", ".join(col_parts)
        if fk_parts:
            detail += " | FK: " + ", ".join(fk_parts)
        lines.append(f"Bảng {table_name}: {detail}")

    return "\n".join(lines)

def _select_few_shots(question: str, examples: List[Dict[str, Any]], top_k: int = 3) -> List[Dict[str, Any]]:
    """Chọn few-shot gần nhất theo độ giao nhau token."""
    if not examples:
        return []

    q_tokens = _normalize_tokens(question)

    def score(example: Dict[str, Any]) -> int:
        ex_tokens = _normalize_tokens(example.get("question", ""))
        return len(q_tokens & ex_tokens)

    ranked = sorted(examples, key=score, reverse=True)
    return [ex for ex in ranked if score(ex) > 0][:top_k]

def _extract_sql(raw: str) -> str:
    """Trích xuất SQL từ block markdown hoặc text thuần."""
    text = raw.strip()
    # Remove markdown code blocks
    text = re.sub(r"```(?:sql)?\n?|\n?```", "", text, flags=re.IGNORECASE).strip()
    
    # Find first SELECT
    match = re.search(r"(?is)(SELECT\b.+)", text)
    if not match:
        return ""
    
    sql = match.group(1).strip()
    return sql.rstrip(";").strip()

def _dialect_hint(dialect: str) -> str:
    d = (dialect or "postgresql").lower()
    if d == "mysql":
        return (
            "Hệ quản trị: **MySQL**. Dùng hàm/cú pháp tương thích MySQL "
            "(ví dụ DATE_FORMAT, LIKE, LIMIT). "
            "Không dùng ILIKE, ::cast kiểu PostgreSQL, DATE_TRUNC nếu không có tương đương."
        )
    return (
        "Hệ quản trị: **PostgreSQL**. Có thể dùng ILIKE, DATE_TRUNC, cast ::type khi phù hợp."
    )


def _role_hint(user_role: str, user_id: str, department_id: str) -> str:
    role = (user_role or "employee").lower()
    if role == "employee":
        return f"CHỈ truy vấn dữ liệu thuộc phòng ban của mình (department_id = '{department_id}')."
    if role == "leader":
        return f"CHỈ truy vấn dữ liệu thuộc phạm vi quản lý của user_id = '{user_id}'."
    return "Được phép truy vấn toàn bộ dữ liệu."

def _load_examples() -> List[Dict[str, Any]]:
    if not _EXAMPLES_PATH.exists():
        return []
    try:
        return json.loads(_EXAMPLES_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"Failed to load few-shot examples: {e}")
        return []

async def generate_sql(
    question: str,
    schema: Dict[str, Any],
    user_role: str = "employee",
    user_id: str = "",
    department_id: str = "",
    previous_sql: str = "",
    error_message: str = ""
) -> Dict[str, Any]:
    """Sinh SQL từ câu hỏi tiếng Việt."""
    
    # 1. Pre-clarify (Simple heuristic)
    q = question.lower()
    if "doanh thu" in q and not any(k in q for k in ["hôm nay", "tuần", "tháng", "năm", "từ", "đến"]):
        return {
            "status": "CLARIFY",
            "message": "Bạn muốn xem doanh thu trong khoảng thời gian nào (ví dụ: tháng này, năm nay)?"
        }

    # 2. Prepare Prompt
    db_name = schema.get("db_name", "tenant_db")
    dialect = schema.get("dialect") or "postgresql"
    schema_text = _schema_to_text(schema)
    examples = _select_few_shots(question, _load_examples())
    role_info = _role_hint(user_role, user_id, department_id)
    dialect_info = _dialect_hint(str(dialect))

    system_prompt = f"""
Bạn là chuyên gia SQL (đa dialect) cho hệ thống quản trị SaaS.
Nhiệm vụ: Chuyển câu hỏi tiếng Việt thành **một** câu SQL SELECT duy nhất, khớp schema thật bên dưới.

[DIALECT]
{dialect_info}

[SCHEMA — chỉ được tham chiếu bảng/cột có trong danh sách]
Database: {db_name}
{schema_text}

[PHÂN QUYỀN]
{role_info}

[SCHEMA PHỨC TẠP]
- Ưu tiên nối bảng theo khóa ngoại (FK) đã liệt kê; nếu thiếu FK, JOIN an toàn theo cột tên hợp lý.
- Với báo cáo/tổng hợp: dùng GROUP BY, HAVING, aggregate (SUM/COUNT/AVG) đúng cột có trong schema.
- Tránh SELECT * trong bảng lớn: liệt kê cột cần thiết.
- Cột ngày giờ: dùng hàm phù hợp dialect (PostgreSQL: DATE_TRUNC/::date; MySQL: DATE/DATE_FORMAT).

[QUY TẮC BẮT BUỘC]
1. CHỈ dùng SELECT. Tuyệt đối không INSERT/UPDATE/DELETE/DROP/DDL.
2. Dùng alias rõ ràng cho bảng trong JOIN.
3. Luôn thêm LIMIT 100 nếu không có yêu cầu số lượng cụ thể.
4. Nếu câu hỏi mơ hồ hoặc không có bảng/cột phù hợp trong schema, trả về "CLARIFY: <nội dung hỏi lại>".
5. CHỈ trả về SQL hoặc CLARIFY, không giải thích gì thêm.
"""

    few_shot_text = ""
    for ex in examples:
        few_shot_text += f"Q: {ex['question']}\nSQL: {ex['sql']}\n\n"

    user_prompt = f"{few_shot_text}Q: {question}\nSQL:"
    
    if previous_sql and error_message:
        user_prompt = f"""
[RETRY CONTEXT]
Câu SQL trước bị lỗi: {previous_sql}
Thông báo lỗi từ DB: {error_message}
Hãy sửa lại SQL để khắc phục lỗi trên.

{user_prompt}
"""

    try:
        model = gemini_manager.get_model(system_instruction=system_prompt)
        res = await model.generate_content_async(user_prompt)
        raw_output = res.text.strip()

        if raw_output.startswith("CLARIFY:"):
            return {
                "status": "CLARIFY",
                "message": raw_output.replace("CLARIFY:", "").strip()
            }

        sql = _extract_sql(raw_output)
        if sql:
            return {"status": "SUCCESS", "sql": sql}
        
        return {"status": "ERROR", "message": "LLM không sinh được SQL hợp lệ."}

    except Exception as e:
        logger.error(f"Error in generate_sql: {e}")
        return {"status": "ERROR", "message": str(e)}
