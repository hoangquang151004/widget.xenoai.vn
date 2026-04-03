import os
import logging
import fitz # PyMuPDF
from docx import Document as DocxDocument
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from ai.vector_store import SaaSVectorStore

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """
    Handles PDF, Docx, TXT, MD parsing, chunking and indexing into Qdrant.
    """

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self.vector_store = SaaSVectorStore(tenant_id)
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ".", " ", ""]
        )

    def parse_pdf(self, file_path: str) -> str:
        """Trích xuất text từ file PDF sử dụng PyMuPDF."""
        text = ""
        try:
            with fitz.open(file_path) as doc:
                for page in doc:
                    text += page.get_text()
        except Exception as e:
            logger.error(f"Error parsing PDF {file_path}: {str(e)}")
            raise e
        return text

    def parse_docx(self, file_path: str) -> str:
        """Trích xuất text từ file DOCX."""
        text = ""
        try:
            doc = DocxDocument(file_path)
            for para in doc.paragraphs:
                text += para.text + "\n"
        except Exception as e:
            logger.error(f"Error parsing DOCX {file_path}: {str(e)}")
            raise e
        return text

    def parse_text(self, file_path: str) -> str:
        """Đọc text từ file TXT hoặc MD."""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            logger.error(f"Error reading text file {file_path}: {str(e)}")
            raise e

    async def process_file(self, file_path: str, filename: str, document_id: str = "") -> int:
        """
        Quy trình xử lý file: Parse -> Chunk -> Vector Store.
        Trả về số lượng chunks đã xử lý.
        """
        ext = os.path.splitext(filename)[1].lower()
        
        if ext == ".pdf":
            content = self.parse_pdf(file_path)
        elif ext == ".docx":
            content = self.parse_docx(file_path)
        elif ext in [".txt", ".md"]:
            content = self.parse_text(file_path)
        else:
            raise ValueError(f"Unsupported file extension: {ext}")

        if not content.strip():
            logger.warning(f"File {filename} is empty.")
            return 0

        # Chunking
        chunks = self.splitter.split_text(content)
        
        # Metadata cho từng chunk
        metadatas = [
            {
                "source": filename,
                "document_id": document_id or None,
                "chunk_index": i,
                "total_chunks": len(chunks)
            }
            for i in range(len(chunks))
        ]

        # Đưa vào Vector Store
        await self.vector_store.upsert_documents(chunks, metadatas)
        
        return len(chunks)

    async def delete_document(self, filename: str, document_id: str = ""):
        """Xóa tài liệu khỏi Vector Store."""
        if document_id:
            await self.vector_store.delete_by_document(document_id)
            return
        await self.vector_store.delete_by_source(filename)
