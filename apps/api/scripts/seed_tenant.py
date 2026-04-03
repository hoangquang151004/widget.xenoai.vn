import asyncio
import uuid
from sqlalchemy.future import select

from core.security import security_utils
from db.session import async_session
from models.ai_settings import TenantAiSettings
from models.allowed_origin import TenantAllowedOrigin
from models.tenant import Tenant
from models.tenant_key import TenantKey
from models.widget_config import TenantWidgetConfig


TEST_EMAIL = "test-tenant@local.dev"

async def seed_test_tenant():
    async with async_session() as session:
        result = await session.execute(select(Tenant).filter(Tenant.email == TEST_EMAIL))
        existing = result.scalars().first()
        if existing:
            print(f"Test tenant already exists: ID={existing.id}")
            return

        public_key = "pk_live_antigravity_demo_key"
        admin_key = "sk_live_antigravity_secret_key"

        test_tenant = Tenant(
            id=uuid.uuid4(),
            name="Antigravity Demo",
            email=TEST_EMAIL,
            password_hash=security_utils.hash_password("TestPassword@123"),
            is_active=True
        )
        session.add(test_tenant)

        await session.flush()

        session.add(TenantWidgetConfig(tenant_id=test_tenant.id))
        session.add(TenantAiSettings(tenant_id=test_tenant.id))
        session.add(
            TenantKey(
                tenant_id=test_tenant.id,
                key_type="public",
                key_value=public_key,
                label="Seed Public Key",
                is_active=True,
            )
        )
        session.add(
            TenantKey(
                tenant_id=test_tenant.id,
                key_type="admin",
                key_value=admin_key,
                label="Seed Admin Key",
                is_active=True,
            )
        )
        session.add(
            TenantAllowedOrigin(
                tenant_id=test_tenant.id,
                origin="*",
                note="Seed default origin",
            )
        )

        await session.commit()
        print(f"Seed success: ID={test_tenant.id}")
        print(f"Public Key: {public_key}")
        print(f"Admin Key: {admin_key}")

if __name__ == "__main__":
    asyncio.run(seed_test_tenant())
