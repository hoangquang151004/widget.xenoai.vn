import logging
import uuid
from typing import Any, Dict, List, Optional

from fastembed import SparseTextEmbedding
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    Modifier,
    PointStruct,
    SparseVector as QdrantSparseVector,
    SparseVectorParams,
    VectorParams,
)

from ai.llm import gemini_manager
from core.config import settings

logger = logging.getLogger(__name__)


class SaaSVectorStore:
    """
    SaaS-aware Vector Store using Qdrant.
    Ensures all operations are scoped to a specific tenant_id.
    """

    _client: Optional[AsyncQdrantClient] = None
    _sparse_model: Optional[SparseTextEmbedding] = None

    def __init__(self, tenant_id: str, collection_name: Optional[str] = None):
        self.tenant_id = str(tenant_id)
        self.collection_name = collection_name or settings.QDRANT_COLLECTION_DOCS

    @classmethod
    async def get_client(cls) -> AsyncQdrantClient:
        """Singleton pattern for AsyncQdrantClient."""
        if cls._client is None:
            use_https = settings.QDRANT_HOST.startswith("https") or settings.QDRANT_PORT == 443
            cls._client = AsyncQdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
                api_key=settings.QDRANT_API_KEY,
                https=use_https,
                timeout=60.0,
            )
        return cls._client

    @classmethod
    def get_sparse_model(cls) -> SparseTextEmbedding:
        """Singleton pattern for SparseTextEmbedding."""
        if cls._sparse_model is None:
            logger.info("Loading FastEmbed BM25 model...")
            cls._sparse_model = SparseTextEmbedding(model_name="Qdrant/bm25")
        return cls._sparse_model

    async def _ensure_collection(self, client: AsyncQdrantClient):
        """Checks if collection exists, if not, creates it with hybrid config."""
        if await client.collection_exists(self.collection_name):
            return

        logger.info("Creating collection: %s", self.collection_name)
        await client.create_collection(
            collection_name=self.collection_name,
            vectors_config={
                "gemini-dense": VectorParams(
                    size=settings.EMBEDDING_DIM,
                    distance=Distance.COSINE,
                )
            },
            sparse_vectors_config={
                "bm25": SparseVectorParams(modifier=Modifier.IDF)
            },
        )
        await client.create_payload_index(
            collection_name=self.collection_name,
            field_name="tenant_id",
            field_schema="keyword",
        )

    def _get_tenant_filter(self, extra_filter: Optional[Filter] = None) -> Filter:
        """Creates or updates a filter to include mandatory tenant_id match."""
        tenant_condition = FieldCondition(
            key="tenant_id",
            match=MatchValue(value=self.tenant_id),
        )

        if extra_filter:
            extra_filter.must = list(extra_filter.must or [])
            if not any(
                isinstance(c, FieldCondition) and c.key == "tenant_id" for c in extra_filter.must
            ):
                extra_filter.must.append(tenant_condition)
            return extra_filter

        return Filter(must=[tenant_condition])

    async def upsert_documents(self, texts: List[str], metadatas: List[Dict[str, Any]]):
        """Upsert documents with tenant_id isolation into Qdrant."""
        if not texts:
            return

        client = await self.get_client()
        await self._ensure_collection(client)
        sparse_model = self.get_sparse_model()

        dense_vectors = await gemini_manager.aget_embeddings_batch(texts)
        sparse_results = list(sparse_model.embed(texts))

        points: List[PointStruct] = []
        for i, (text_value, dense_vec, sparse_vec) in enumerate(zip(texts, dense_vectors, sparse_results)):
            metadata = metadatas[i] if i < len(metadatas) else {}
            payload = {
                "text": text_value,
                "tenant_id": self.tenant_id,
                **metadata,
            }
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector={
                        "gemini-dense": dense_vec,
                        "bm25": QdrantSparseVector(
                            indices=sparse_vec.indices.tolist(),
                            values=sparse_vec.values.tolist(),
                        ),
                    },
                    payload=payload,
                )
            )

        await client.upsert(
            collection_name=self.collection_name,
            points=points,
        )
        logger.info("Upserted %s points for tenant %s", len(points), self.tenant_id)

    async def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search using dense vectors with strict tenant isolation."""
        client = await self.get_client()
        dense_vec = await gemini_manager.aget_embeddings(query)
        tenant_filter = self._get_tenant_filter()

        try:
            results = await client.search(
                collection_name=self.collection_name,
                query_vector=("gemini-dense", dense_vec),
                query_filter=tenant_filter,
                limit=limit,
            )

            return [
                {
                    "id": hit.id,
                    "score": hit.score,
                    "text": hit.payload.get("text", ""),
                    "metadata": hit.payload,
                }
                for hit in results
                if hit.score >= settings.RAG_SIMILARITY_THRESHOLD
            ]
        except Exception as e:
            logger.error("Search failed: %s", str(e))
            return []

    async def delete_by_source(self, filename: str):
        """Delete all points for a source filename of current tenant."""
        client = await self.get_client()
        tenant_filter = self._get_tenant_filter(
            Filter(
                must=[FieldCondition(key="source", match=MatchValue(value=filename))]
            )
        )

        await client.delete(
            collection_name=self.collection_name,
            points_selector=tenant_filter,
        )
        logger.info("Deleted points for source=%s tenant=%s", filename, self.tenant_id)

    async def delete_by_document(self, document_id: str):
        """Delete all points for a document_id of current tenant."""
        client = await self.get_client()
        tenant_filter = self._get_tenant_filter(
            Filter(
                must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
            )
        )
        await client.delete(
            collection_name=self.collection_name,
            points_selector=tenant_filter,
        )
        logger.info("Deleted points for document_id=%s tenant=%s", document_id, self.tenant_id)
