import os
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import text
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from utils.logger import agent_log

from core.database import SessionLocal, engine

# Assuming text-embedding-004
_embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

def _ensure_pgvector():
    """Ensure pgvector is enabled on the database."""
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

# Initialize table structure if not exists
try:
    _ensure_pgvector()
    from models.brand_knowledge import Base
    Base.metadata.create_all(bind=engine)
    agent_log("RAG", "pgvector initialized and table verified")
except Exception as e:
    agent_log("RAG", f"pgvector initialization failed (may need admin rights): {e}")


def embed_text(text_content: str) -> List[float]:
    """Generate embedding for the given text."""
    try:
        return _embeddings.embed_query(text_content)
    except Exception as e:
        agent_log("RAG", f"Embedding failed: {e}")
        # Fallback to zero vector if offline/failing (not ideal but prevents crashes)
        return [0.0] * 768

def upsert_brand_chunk(brand_profile_id: str, source_type: str, text_content: str, metadata: Optional[Dict[str, Any]] = None):
    """Insert or update a knowledge chunk."""
    if not text_content or not text_content.strip():
        return

    from models.brand_knowledge import BrandKnowledgeChunk
    
    vector = embed_text(text_content)
    chunk_id = f"chunk_{uuid.uuid4().hex[:12]}"
    
    with SessionLocal() as db:
        chunk = BrandKnowledgeChunk(
            id=chunk_id,
            brand_profile_id=brand_profile_id,
            source_type=source_type,
            text=text_content.strip(),
            metadata_json=metadata or {},
            embedding=vector
        )
        db.add(chunk)
        db.commit()
        agent_log("RAG", f"Upserted chunk {chunk_id} for brand {brand_profile_id} ({source_type})")


def retrieve_brand_context(brand_profile_id: str, query: str, k: int = 5, source_type: Optional[str] = None) -> List[str]:
    """Retrieve top-k chunks for a given brand profile using cosine distance."""
    from models.brand_knowledge import BrandKnowledgeChunk
    
    query_vector = embed_text(query)
    
    with SessionLocal() as db:
        # Construct the query
        q = db.query(BrandKnowledgeChunk).filter(BrandKnowledgeChunk.brand_profile_id == brand_profile_id)
        
        if source_type:
            q = q.filter(BrandKnowledgeChunk.source_type == source_type)
            
        # Order by cosine distance (<=>)
        results = q.order_by(BrandKnowledgeChunk.embedding.cosine_distance(query_vector)).limit(k).all()
        
        return [r.text for r in results]
