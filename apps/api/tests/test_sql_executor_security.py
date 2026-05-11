import pytest

from ai.sql.executor import _validate_sql, execute_sql


SCHEMA = {
    "tables": {
        "orders": {"columns": [{"name": "id"}, {"name": "total"}]},
        "customers": {"columns": [{"name": "id"}, {"name": "name"}]},
    }
}


def test_validate_sql_blocks_write_statement():
    with pytest.raises(ValueError, match="cấm|SELECT"):
        _validate_sql("DELETE FROM orders WHERE id = 1", SCHEMA)


def test_validate_sql_blocks_multiple_statements():
    with pytest.raises(ValueError, match="nhiều câu lệnh"):
        _validate_sql("SELECT 1; SELECT 2", SCHEMA)


def test_validate_sql_blocks_unknown_table():
    with pytest.raises(ValueError, match="không có trong schema"):
        _validate_sql("SELECT * FROM salaries", SCHEMA)


def test_validate_sql_blocks_system_schema():
    with pytest.raises(ValueError, match="system schema"):
        _validate_sql("SELECT table_name FROM information_schema.tables", SCHEMA)


def test_validate_sql_appends_default_limit_when_missing():
    validated = _validate_sql("SELECT id, total FROM orders", SCHEMA)
    assert validated.upper().endswith("LIMIT 100")


def test_validate_sql_keeps_existing_limit():
    validated = _validate_sql("SELECT id FROM orders LIMIT 5", SCHEMA)
    assert validated.upper().endswith("LIMIT 5")


class _FakeResult:
    def __init__(self, columns, rows):
        self._columns = columns
        self._rows = rows

    def keys(self):
        return self._columns

    def fetchall(self):
        return self._rows


class _FakeSession:
    def __init__(self, dialect_name):
        self.bind = type("Bind", (), {"dialect": type("Dialect", (), {"name": dialect_name})()})()
        self.executed = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def execute(self, statement):
        sql_text = str(statement)
        self.executed.append(sql_text)
        if sql_text.startswith("SET LOCAL statement_timeout"):
            return None
        return _FakeResult(["id"], [(1,)])


@pytest.mark.asyncio
async def test_execute_sql_mysql_skips_postgres_statement_timeout(monkeypatch):
    fake_session = _FakeSession("mysql")

    async def _fake_get_session(_tenant_id):
        return fake_session

    monkeypatch.setattr("ai.sql.executor.engine_manager.get_session", _fake_get_session)

    result = await execute_sql(
        tenant_id="tenant-1",
        question="Danh sach don hang",
        sql="SELECT id FROM orders",
        schema=SCHEMA,
        max_retries=0,
    )

    assert result["status"] == "SUCCESS"
    assert len(fake_session.executed) == 1
    assert "SET LOCAL statement_timeout" not in fake_session.executed[0]


@pytest.mark.asyncio
async def test_execute_sql_postgres_applies_statement_timeout(monkeypatch):
    fake_session = _FakeSession("postgresql")

    async def _fake_get_session(_tenant_id):
        return fake_session

    monkeypatch.setattr("ai.sql.executor.engine_manager.get_session", _fake_get_session)

    result = await execute_sql(
        tenant_id="tenant-1",
        question="Danh sach don hang",
        sql="SELECT id FROM orders",
        schema=SCHEMA,
        max_retries=0,
    )

    assert result["status"] == "SUCCESS"
    assert len(fake_session.executed) == 2
    assert fake_session.executed[0].startswith("SET LOCAL statement_timeout")
