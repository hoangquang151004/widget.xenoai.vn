import pytest


@pytest.fixture(autouse=True)
async def dispose_tenant_db_engines():
    yield
    from db.session import engine
    from db.tenant_db import DynamicEngineManager

    for tid in list(DynamicEngineManager._engines.keys()):
        await DynamicEngineManager.refresh_engine(tid)
    # Tránh asyncpg "another operation is in progress" / proactor lỗi trên Windows
    # khi nhiều test ASGI + DB dùng chung pool.
    await engine.dispose()
