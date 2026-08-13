from sqlalchemy import Column, String, DateTime, JSON, Text
from sqlalchemy.sql import func
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    Vector = None  # We'll handle this in rag.py or require it

from core.database import Base

class BrandKnowledgeChunk(Base):
    __tablename__ = "brand_knowledge_chunks"

    id = Column(String, primary_key=True)
    brand_profile_id = Column(String, index=True, nullable=False)
    source_type = Column(String, index=True, nullable=False) # e.g. "brand_voice", "past_campaign", "creative_rejection"
    text = Column(Text, nullable=False)
    metadata_json = Column(JSON, default={})
    
    # We will use text-embedding-004 which outputs 768 dimensions
    embedding = Column(Vector(768))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
