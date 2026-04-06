import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import inspect
from core.redis_pool import get_redis_client
from db.tenant_db import engine_manager

logger = logging.getLogger(__name__)

_CACHE_KEY_PREFIX = "t2s_schema:"
_CACHE_TTL = 3600  # 1 hour

def _get_cache_key(tenant_id: str) -> str:
    return f"{_CACHE_KEY_PREFIX}{tenant_id}"

async def get_schema(tenant_id: str, force_refresh: bool = False) -> Dict[str, Any]:
    """
    Lấy schema từ cache Redis nếu có, ngược lại inspect DB rồi cache lại.
    """
    redis_client = get_redis_client()
    cache_key = _get_cache_key(tenant_id)

    if not force_refresh:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                logger.info(f"Text2SQL schema cache hit | tenant={tenant_id}")
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Redis error when fetching schema cache: {e}")

    logger.info(f"Text2SQL schema cache miss | tenant={tenant_id}")
    schema = await _inspect_tenant_db(tenant_id)
    
    if schema and "tables" in schema:
        try:
            await redis_client.setex(
                cache_key, 
                _CACHE_TTL, 
                json.dumps(schema, ensure_ascii=False)
            )
        except Exception as e:
            logger.warning(f"Failed to cache schema in Redis: {e}")
            
    return schema

async def _inspect_tenant_db(tenant_id: str) -> Dict[str, Any]:
    """Inspect schema thật từ DB và trả về cấu trúc chuẩn cho generator."""
    engine = await engine_manager.get_engine(tenant_id)
    if not engine:
        return {"error": "No database connection configured for this tenant."}

    def get_sync_schema(sync_conn):
        inspector = inspect(sync_conn)
        tables = inspector.get_table_names()
        table_map: Dict[str, Any] = {}

        for table in tables:
            # Columns
            columns_info = inspector.get_columns(table)
            pk_info = inspector.get_pk_constraint(table) or {}
            pk_columns = set(pk_info.get("constrained_columns") or [])
            
            # Foreign Keys
            fks_info = inspector.get_foreign_keys(table)

            columns = []
            for col in columns_info:
                columns.append({
                    "name": col.get("name"),
                    "type": str(col.get("type")),
                    "nullable": bool(col.get("nullable", True)),
                    "primary_key": col.get("name") in pk_columns,
                })

            foreign_keys = []
            for fk in fks_info:
                constrained = fk.get("constrained_columns") or []
                referred = fk.get("referred_columns") or []
                if not constrained:
                    continue
                foreign_keys.append({
                    "column": constrained[0],
                    "ref_table": fk.get("referred_table"),
                    "ref_column": referred[0] if referred else None,
                })

            table_map[table] = {
                "columns": columns,
                "foreign_keys": foreign_keys,
            }

        return table_map

    try:
        async with engine.connect() as conn:
            dialect_name = getattr(conn.engine.dialect, "name", None) or "postgresql"
            tables_data = await conn.run_sync(get_sync_schema)

            return {
                "tenant_id": tenant_id,
                "dialect": dialect_name,
                "loaded_at": datetime.now(timezone.utc).isoformat(),
                "tables": tables_data,
            }
    except Exception as e:
        logger.error(f"Failed to fetch schema for tenant {tenant_id}: {str(e)}")
        return {"error": f"Error fetching schema: {str(e)}"}

async def refresh_schema(tenant_id: str) -> None:
    """Xóa cache schema để lần gọi tiếp theo inspect lại DB."""
    redis_client = get_redis_client()
    try:
        await redis_client.delete(_get_cache_key(tenant_id))
    except Exception as e:
        logger.warning(f"Failed to delete schema cache for tenant {tenant_id}: {e}")
