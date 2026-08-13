import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from core.database import Base
from models.brand_knowledge import BrandKnowledgeChunk

def main():
    db_url = os.getenv("DATABASE_URL", "postgresql://marketos:marketos_dev@localhost:5433/marketos")
    engine = create_engine(db_url)
    
    with engine.connect() as conn:
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS "vector";'))
        conn.commit()
        
    print("Creating tables...")
    Base.metadata.create_all(engine)
    
    # Check if we also need to create compliance_audit or if it is already handled somewhere
    with engine.connect() as conn:
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS compliance_audit (
            id UUID DEFAULT uuid_generate_v4() NOT NULL,
            campaign_id VARCHAR(16),
            variant_id VARCHAR(16),
            approved BOOLEAN NOT NULL,
            compliance_score NUMERIC(5, 2),
            checks_json JSONB,
            reason_code VARCHAR(64),
            blocked_reason TEXT,
            reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            PRIMARY KEY (id)
        )
        """))
        conn.commit()
    print("Tables created.")

if __name__ == "__main__":
    main()
