import asyncio
import logging
from db.session import engine
from models import Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db():
    async with engine.begin() as conn:
        logger.info("Creating tables...")
        # create_all will only create tables that don't exist
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Tables created successfully.")

if __name__ == "__main__":
    asyncio.run(init_db())
