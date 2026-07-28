from sqlalchemy import Column, String, Text, DateTime, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
from sqlalchemy.sql import func, text
from core.database import Base

class EpisodicMemory(Base):
    __tablename__ = "agent_episodic_memory"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    workspace_id = Column(String(64), nullable=False, default='default')
    agent_name = Column(String(64), nullable=False)
    event_type = Column(String(64))
    summary = Column(Text, nullable=False)
    embedding = Column(Vector(768))
    metadata_ = Column("metadata", JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('idx_episodic_workspace', 'workspace_id', 'agent_name'),
        Index('idx_episodic_embedding', 'embedding', postgresql_using='hnsw', postgresql_with={'m': 16, 'ef_construction': 64}, postgresql_ops={'embedding': 'vector_cosine_ops'}),
    )


class SemanticMemory(Base):
    __tablename__ = "agent_semantic_memory"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    workspace_id = Column(String(64), nullable=False, default='default')
    category = Column(String(64))
    key = Column(String(256))
    content = Column(Text, nullable=False)
    embedding = Column(Vector(768))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('idx_semantic_workspace', 'workspace_id', 'category'),
        Index('idx_semantic_embedding', 'embedding', postgresql_using='hnsw', postgresql_with={'m': 16, 'ef_construction': 64}, postgresql_ops={'embedding': 'vector_cosine_ops'}),
        UniqueConstraint("workspace_id", "category", "key", name="uq_semantic_workspace_category_key"),
    )
