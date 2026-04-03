import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from models.base import Base


class TenantDocument(Base):
    __tablename__ = "tenant_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    storage_path = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending, processing, done, error
    error_message = Column(Text, nullable=True)
    chunk_count = Column(Integer, nullable=True)
    uploaded_by = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)

    tenant = relationship("Tenant", back_populates="documents")

    def __repr__(self):
        return f"<TenantDocument(filename='{self.filename}', tenant_id='{self.tenant_id}', status='{self.status}')>"
