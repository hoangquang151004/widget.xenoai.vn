import asyncio
from qdrant_client import AsyncQdrantClient

from core.config import settings

async def main():
    print(f"Connecting to Qdrant at {settings.QDRANT_HOST}:{settings.QDRANT_PORT}")
    client = AsyncQdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
    try:
        await client.delete_collection(settings.QDRANT_COLLECTION_DOCS)
        print(f"Successfully deleted collection: {settings.QDRANT_COLLECTION_DOCS}")
    except Exception as e:
        print(f"Error (maybe collection doesn't exist): {e}")

if __name__ == "__main__":
    asyncio.run(main())
