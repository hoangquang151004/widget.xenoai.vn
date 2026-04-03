from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean, Integer, ARRAY, JSON
from sqlalchemy.dialects.postgresql import UUID, BYTEA
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from models.base import Base

class TenantDatabaseConfig(Base):
    __tablename__ = "tenant_databases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    
    db_type = Column(String(20), default="postgresql") # postgresql, mysql
    db_host = Column(String(255), nullable=False)
    db_port = Column(Integer, default=5432)
    db_name = Column(String(255), nullable=False)
    
    # Store encrypted username and password as BYTEA (for AES-256-GCM)
    db_user_enc = Column(BYTEA, nullable=False)
    db_password_enc = Column(BYTEA, nullable=False)
    
    db_ssl = Column(Boolean, default=True)
    allowed_tables = Column(ARRAY(String), default=[])
    schema_cache = Column(JSON, nullable=True)
    schema_synced_at = Column(DateTime, nullable=True)
    
    is_active = Column(Boolean, default=True)
    last_tested_at = Column(DateTime, nullable=True)
    last_test_ok = Column(Boolean, nullable=True)
    last_test_error = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    tenant = relationship("Tenant", back_populates="databases")

    def __repr__(self):
        return f"<TenantDatabaseConfig(tenant_id={self.tenant_id}, db_name='{self.db_name}')>"
