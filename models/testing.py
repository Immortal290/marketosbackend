from sqlalchemy import Column, String, Text, Numeric, DateTime, Integer, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from core.database import Base

class AbVariantStat(Base):
    __tablename__ = "ab_variant_stats"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    campaign_id = Column(String(16), nullable=False)
    workspace_id = Column(String(64), nullable=False, default='default')
    variant_id = Column(String(16), nullable=False)
    sends = Column(Integer, default=0)
    opens = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    conversions = Column(Integer, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("campaign_id", "variant_id", name="ab_variant_stats_campaign_id_variant_id_key"),
    )


class AbTestResult(Base):
    __tablename__ = "ab_test_results"

    test_id = Column(String(32), primary_key=True)
    campaign_id = Column(String(16), nullable=False)
    workspace_id = Column(String(64), nullable=False, default='default')
    winner_id = Column(String(16))
    decision = Column(String(32))
    confidence = Column(Numeric(5, 4))
    key_learning = Column(Text)
    copy_insight = Column(Text)
    concluded_at = Column(DateTime(timezone=True), server_default=func.now())
