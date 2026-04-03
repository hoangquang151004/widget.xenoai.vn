"""
Seed script: Tạo tenant demo + Qdrant collection.

Cách chạy:
    cd apps/api
    .venv\Scripts\python.exe scripts/seed.py [--skip-if-exists]
"""
import asyncio
import secrets
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.future import select
from db.session import async_session
from core.security import security_utils
from models.tenant import Tenant
from models.ai_settings import TenantAiSettings
from models.allowed_origin import TenantAllowedOrigin
from models.tenant_key import TenantKey
from models.widget_config import TenantWidgetConfig

DEMO_EMAIL = "demo@xenoai.local"


async def ensure_qdrant_collection():
    """Tạo Qdrant collection nếu chưa có."""
    try:
        from qdrant_client import AsyncQdrantClient
        from qdrant_client.models import Distance, VectorParams
        from core.config import settings

        client = AsyncQdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT, timeout=5)
        collections = await client.get_collections()
        names = [c.name for c in collections.collections]

        if settings.QDRANT_COLLECTION_DOCS not in names:
            await client.create_collection(
                collection_name=settings.QDRANT_COLLECTION_DOCS,
                vectors_config=VectorParams(size=settings.EMBEDDING_DIM, distance=Distance.COSINE),
            )
            print(f"✅  Đã tạo Qdrant collection: '{settings.QDRANT_COLLECTION_DOCS}'")
        else:
            print(f"ℹ️   Qdrant collection '{settings.QDRANT_COLLECTION_DOCS}' đã tồn tại.")

        await client.close()
    except Exception as e:
        print(f"⚠️   Không thể kết nối Qdrant: {e}  (bỏ qua nếu chạy local không có Qdrant)")


async def seed(skip_if_exists: bool = False):
    print("\n=== 🌱 Seed Script — XenoAI Widget ===\n")

    # ── 1. Qdrant collection ─────────────────────────────────────────────────
    await ensure_qdrant_collection()

    # ── 2. Demo tenant ────────────────────────────────────────────────────────
    async with async_session() as session:
        result = await session.execute(select(Tenant).filter(Tenant.email == DEMO_EMAIL))
        existing = result.scalars().first()

        if existing:
            if skip_if_exists:
                print(f"ℹ️   Tenant '{DEMO_EMAIL}' đã tồn tại — bỏ qua (--skip-if-exists).")
                tenant = existing
            else:
                print(f"⚠️   Tenant '{DEMO_EMAIL}' đã tồn tại.")
                tenant = existing
        else:
            public_key = f"pk_live_{secrets.token_urlsafe(32)}"
            admin_key = f"sk_live_{secrets.token_urlsafe(32)}"

            tenant = Tenant(
                name="Demo Company",
                email=DEMO_EMAIL,
                password_hash=security_utils.hash_password("DemoPassword@123"),
                is_active=True,
            )
            session.add(tenant)

            await session.flush()

            session.add(TenantWidgetConfig(tenant_id=tenant.id))
            session.add(TenantAiSettings(tenant_id=tenant.id))
            session.add(
                TenantKey(
                    tenant_id=tenant.id,
                    key_type="public",
                    key_value=public_key,
                    label="Seed Public Key",
                    is_active=True,
                )
            )
            session.add(
                TenantKey(
                    tenant_id=tenant.id,
                    key_type="admin",
                    key_value=admin_key,
                    label="Seed Admin Key",
                    is_active=True,
                )
            )
            session.add(
                TenantAllowedOrigin(
                    tenant_id=tenant.id,
                    origin="*",
                    note="Seed default origin",
                )
            )

            await session.commit()
            print("✅  Tenant demo đã được tạo.")

        public_key_result = await session.execute(
            select(TenantKey)
            .filter(
                TenantKey.tenant_id == tenant.id,
                TenantKey.key_type == "public",
                TenantKey.is_active == True,
            )
            .order_by(TenantKey.created_at.desc())
        )
        admin_key_result = await session.execute(
            select(TenantKey)
            .filter(
                TenantKey.tenant_id == tenant.id,
                TenantKey.key_type == "admin",
                TenantKey.is_active == True,
            )
            .order_by(TenantKey.created_at.desc())
        )
        public_key_row = public_key_result.scalars().first()
        admin_key_row = admin_key_result.scalars().first()

    # ── 3. Print keys ─────────────────────────────────────────────────────────
    print(f"\n{'─' * 58}")
    print(f"  Tenant ID   : {tenant.id}")
    print(f"  Name        : {tenant.name}")
    print(f"  Email       : {tenant.email}")
    print(f"  Public Key  : {public_key_row.key_value if public_key_row else 'N/A'}")
    print(f"  Admin Key   : {admin_key_row.key_value if admin_key_row else 'N/A'}")
    print(f"{'─' * 58}")
    print(f"\n💡 Dùng Public Key để nhúng Widget vào website.")
    print(f"💡 Dùng Admin key để gọi API public routes cần API key.\n")
    print("=== Hướng dẫn test nhanh ===")
    widget_key_example = public_key_row.key_value if public_key_row else "<public_key>"
    print(f'curl -X GET "http://localhost:8001/api/v1/chat/config" \\')
    print(f'     -H "X-Widget-Key: {widget_key_example}"')
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-if-exists", action="store_true",
                        help="Bỏ qua nếu tenant demo đã tồn tại (dùng trong Docker entrypoint)")
    args = parser.parse_args()
    asyncio.run(seed(skip_if_exists=args.skip_if_exists))
