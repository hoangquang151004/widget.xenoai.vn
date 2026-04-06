"""
TASK-01: Kiểm thử pipeline Text-to-SQL (mock) — tenant lỗi schema vs thành công.
"""

import pytest
from unittest.mock import AsyncMock, patch

from ai.sql import run_text_to_sql


@pytest.mark.asyncio
async def test_run_text_to_sql_stops_when_schema_error():
    """Tenant không có / lỗi kết nối schema → ERROR, không gọi generate."""
    with patch("ai.sql.get_schema", new_callable=AsyncMock) as m_schema:
        m_schema.return_value = {"error": "No database connection configured for this tenant."}
        with patch("ai.sql.generate_sql", new_callable=AsyncMock) as m_gen:
            r = await run_text_to_sql("tenant-bad", "Doanh thu tháng này?")
            assert r["status"] == "ERROR"
            assert "connection" in r["message"].lower() or "database" in r["message"].lower()
            m_gen.assert_not_called()


@pytest.mark.asyncio
async def test_run_text_to_sql_happy_path_mocked():
    """Tenant đủ schema → generate → execute → format."""
    schema_ok = {
        "tenant_id": "tenant-good",
        "dialect": "postgresql",
        "tables": {
            "orders": {
                "columns": [
                    {"name": "id", "type": "INTEGER", "primary_key": True},
                    {"name": "total", "type": "NUMERIC", "primary_key": False},
                ],
                "foreign_keys": [],
            }
        },
    }
    with patch("ai.sql.get_schema", new_callable=AsyncMock) as m_schema:
        m_schema.return_value = schema_ok
        with patch("ai.sql.generate_sql", new_callable=AsyncMock) as m_gen:
            m_gen.return_value = {"status": "SUCCESS", "sql": "SELECT 1 AS x"}
            with patch("ai.sql.execute_sql", new_callable=AsyncMock) as m_ex:
                m_ex.return_value = {
                    "status": "SUCCESS",
                    "rows": [{"x": 1}],
                    "columns": ["x"],
                    "sql_executed": "SELECT 1 AS x",
                    "attempt": 0,
                }
                with patch("ai.sql.format_sql_result", new_callable=AsyncMock) as m_fmt:
                    m_fmt.return_value = {
                        "answer": "Có dữ liệu.",
                        "table": "| x |\n| 1 |",
                        "sql": "SELECT 1 AS x",
                        "row_count": 1,
                    }
                    r = await run_text_to_sql("tenant-good", "Test?")
                    assert r["status"] == "SUCCESS"
                    assert r.get("answer")
                    m_gen.assert_called_once()
                    m_ex.assert_called_once()


@pytest.mark.asyncio
async def test_sql_agent_arun_uses_pipeline(monkeypatch):
    """SQLAgent gọi run_text_to_sql; mock trả SUCCESS."""
    from ai.sql_agent import SQLAgent

    async def fake_pipeline(tenant_id, question, **kw):
        return {
            "status": "SUCCESS",
            "answer": "OK",
            "table": "|a|\n|1|",
            "sql": "SELECT 1",
            "row_count": 1,
        }

    monkeypatch.setattr("ai.sql_agent.run_text_to_sql", fake_pipeline)
    agent = SQLAgent("00000000-0000-0000-0000-000000000001")
    resp = await agent.arun("Đếm bản ghi")
    assert "OK" in resp.content
    assert resp.metadata.get("agent_type") == "sql"
