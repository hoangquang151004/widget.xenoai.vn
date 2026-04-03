import logging
import asyncio
import os
from datetime import datetime
from uuid import UUID
from sqlalchemy.future import select
from db.session import async_session
from models.document import TenantDocument
from ai.rag.processor import DocumentProcessor
from worker.celery_app import celery_app

logger = logging.getLogger(__name__)

def run_async_task(coro):
    """Helper to run async code in sync celery worker."""
    loop = asyncio.get_event_loop()
    if loop.is_running():
        # This shouldn't happen in a standard celery worker, but good for safety
        new_loop = asyncio.new_event_loop()
        return new_loop.run_until_complete(coro)
    return loop.run_until_complete(coro)

@celery_app.task(name="process_document_task", bind=True, max_retries=3)
def process_document_task(self, doc_id: str, tenant_id: str, file_path: str, filename: str):
    """
    Celery task to process the document: Parse, Chunk, and Index.
    """
    logger.info(f"Starting Celery task for document {filename} (ID: {doc_id})")
    
    # We need to run the async logic in a sync wrapper for Celery
    return run_async_task(_process_document(doc_id, tenant_id, file_path, filename))

async def _process_document(doc_id_str: str, tenant_id: str, file_path: str, filename: str):
    doc_id = UUID(doc_id_str)
    processor = DocumentProcessor(tenant_id)
    
    async with async_session() as session:
        try:
            # 1. Update status to processing
            result = await session.execute(select(TenantDocument).filter(TenantDocument.id == doc_id))
            doc = result.scalars().first()
            if not doc:
                logger.error(f"Document {doc_id} not found in database")
                return

            doc.status = "processing"
            await session.commit()

            # 2. Process file (Parse -> Chunk -> Index)
            # Ensure the file exists before processing
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found at {file_path}")

            chunk_count = await processor.process_file(file_path, filename, document_id=str(doc_id))

            # 3. Update status to done
            # Re-fetch doc to avoid session issues
            result = await session.execute(select(TenantDocument).filter(TenantDocument.id == doc_id))
            doc = result.scalars().first()
            
            doc.status = "done"
            doc.chunk_count = chunk_count
            doc.processed_at = datetime.utcnow()
            await session.commit()
            
            logger.info(f"Successfully processed document {filename} for tenant {tenant_id}. Chunks: {chunk_count}")

        except Exception as e:
            logger.error(f"Error processing document {filename}: {str(e)}")
            # Re-fetch doc to update error status
            result = await session.execute(select(TenantDocument).filter(TenantDocument.id == doc_id))
            doc = result.scalars().first()
            if doc:
                doc.status = "error"
                doc.error_message = str(e)
                await session.commit()
            raise e # Re-raise for Celery retries if needed
        finally:
            # Clean up temp file (optional, depends on if we want to keep it in storage)
            # If we want a persistent storage/ folder, we shouldn't remove it here.
            # For now, let's keep it if processing succeeded or failed for debugging.
            pass
