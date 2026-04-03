import os
import shutil
import logging
from typing import List
from fastapi import APIRouter, Request, UploadFile, File, HTTPException
from sqlalchemy.future import select
from db.session import async_session
from models.document import TenantDocument
from ai.rag.processor import DocumentProcessor
from worker.tasks.document_tasks import process_document_task
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from uuid import UUID
from core.config import settings

router = APIRouter()

# Sử dụng đường dẫn tuyệt đối cho thư mục lưu trữ
STORAGE_DIR = os.path.abspath(getattr(settings, "STORAGE_PATH", "storage"))

class DocumentInfo(BaseModel):
    id: UUID
    filename: str
    file_type: str
    file_size: int
    status: str
    uploaded_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

@router.post("/upload", response_model=DocumentInfo)
async def upload_document(
    request: Request, 
    file: UploadFile = File(...)
):
    """
    Upload a document for RAG indexing.
    Queues a Celery task for asynchronous processing.
    """
    if not getattr(request.state, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")

    tenant_id = str(request.state.tenant_id)
    
    # 1. Ensure tenant directory exists
    tenant_dir = os.path.join(STORAGE_DIR, f"tenant_{tenant_id}")
    os.makedirs(tenant_dir, exist_ok=True)
    
    # 2. Save file to persistent storage
    # Use timestamp to avoid collisions
    file_id = datetime.now().strftime("%Y%m%d%H%M%S") + "_" + file.filename
    storage_path = os.path.join(tenant_dir, file_id)
    
    with open(storage_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(storage_path)
    
    # 3. Create database record
    async with async_session() as session:
        new_doc = TenantDocument(
            tenant_id=tenant_id,
            filename=file.filename,
            file_type=file.content_type or "application/octet-stream",
            file_size=file_size,
            storage_path=storage_path,
            status="pending"
        )
        session.add(new_doc)
        await session.commit()
        await session.refresh(new_doc)
        
        # 4. Queue processing task via Celery
        # Use .delay() for fire-and-forget
        process_document_task.delay(
            str(new_doc.id), 
            tenant_id, 
            storage_path, 
            file.filename
        )
        
        return new_doc

@router.get("/list", response_model=List[DocumentInfo])
async def list_documents(request: Request):
    """List all documents for the current tenant."""
    if not getattr(request.state, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")

    tenant_id = str(request.state.tenant_id)
    async with async_session() as session:
        result = await session.execute(
            select(TenantDocument)
            .filter(TenantDocument.tenant_id == tenant_id)
            .order_by(TenantDocument.uploaded_at.desc())
        )
        documents = result.scalars().all()
        return documents

@router.delete("/{doc_id}")
async def delete_document(doc_id: UUID, request: Request):
    """Delete a document from DB and Vector Store."""
    if not getattr(request.state, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")

    tenant_id = str(request.state.tenant_id)
    async with async_session() as session:
        result = await session.execute(
            select(TenantDocument).filter(
                TenantDocument.id == doc_id, 
                TenantDocument.tenant_id == tenant_id
            )
        )
        doc = result.scalars().first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        # 1. Delete vectors from Qdrant
        processor = DocumentProcessor(tenant_id)
        await processor.delete_document(doc.filename, str(doc.id))
        
        # 2. Delete from DB
        await session.delete(doc)
        await session.commit()
        
        return {"message": f"Successfully deleted document {doc.filename}"}

@router.get("/status/{doc_id}", response_model=DocumentInfo)
async def get_document_status(doc_id: UUID, request: Request):
    """Check the status of a specific document."""
    if not getattr(request.state, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")

    tenant_id = str(request.state.tenant_id)
    async with async_session() as session:
        result = await session.execute(
            select(TenantDocument).filter(
                TenantDocument.id == doc_id, 
                TenantDocument.tenant_id == tenant_id
            )
        )
        doc = result.scalars().first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        return doc
