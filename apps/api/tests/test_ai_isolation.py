import pytest
import asyncio
import uuid
from ai.vector_store import SaaSVectorStore
from ai.rag_agent import RAGAgent

@pytest.mark.asyncio
async def test_tenant_data_isolation():
    tenant_a = str(uuid.uuid4())
    tenant_b = str(uuid.uuid4())
    
    store_a = SaaSVectorStore(tenant_a, collection_name="test_rag_docs")
    store_b = SaaSVectorStore(tenant_b, collection_name="test_rag_docs")
    
    # 1. Tenant A inserts a secret document
    await store_a.upsert_documents(
        texts=["Mật mã dự án X của công ty Alpha là 9999."],
        metadatas=[{"source": "secret_alpha.txt"}]
    )
    
    # 2. Wait a bit for indexing
    await asyncio.sleep(1)
    
    # 3. Tenant B searches for that secret
    results_b = await store_b.search("Mật mã dự án X là gì?")
    
    # 4. ASSERT: Tenant B should NOT find anything
    assert len(results_b) == 0, "Tenant B leaked data from Tenant A!"
    
    # 5. Tenant A searches for their own secret
    results_a = await store_a.search("Mật mã dự án X là gì?")
    
    # 6. ASSERT: Tenant A should find their data
    assert len(results_a) > 0
    assert "9999" in results_a[0]["text"]
    
    print(f"✅ Isolation Test Passed: Tenant B could not access Tenant A's secret.")

if __name__ == "__main__":
    asyncio.run(test_tenant_data_isolation())
