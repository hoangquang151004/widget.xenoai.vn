import asyncio
from sqlalchemy.future import select

from db.session import async_session
from models.tenant import Tenant
from models.tenant_key import TenantKey

async def list_tenants():
    async with async_session() as session:
        result = await session.execute(select(Tenant))
        tenants = result.scalars().all()
        print(f"Total tenants: {len(tenants)}")
        for t in tenants:
            public_key_result = await session.execute(
                select(TenantKey.key_value)
                .filter(
                    TenantKey.tenant_id == t.id,
                    TenantKey.key_type == "public",
                    TenantKey.is_active == True,
                )
                .order_by(TenantKey.created_at.desc())
            )
            admin_key_result = await session.execute(
                select(TenantKey.key_value)
                .filter(
                    TenantKey.tenant_id == t.id,
                    TenantKey.key_type == "admin",
                    TenantKey.is_active == True,
                )
                .order_by(TenantKey.created_at.desc())
            )
            public_key = public_key_result.scalars().first()
            admin_key = admin_key_result.scalars().first()

            print(f"ID: {t.id}")
            print(f"Name: {t.name}")
            print(f"Email: {t.email}")
            print(f"Plan: {t.plan}")
            print(f"Public Key: {public_key}")
            print(f"Admin Key: {admin_key}")
            print(f"Is Active: {t.is_active}")
            print("-" * 20)

if __name__ == "__main__":
    asyncio.run(list_tenants())
