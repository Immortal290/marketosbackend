from sqlalchemy import Column, String, Text, Numeric, Boolean, DateTime, ForeignKey, Index, text, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    campaign_id = Column(String(16), unique=True, nullable=False)
    workspace_id = Column(String(64), nullable=False, default='default')
    campaign_name = Column(Text, nullable=False)
    goal = Column(Text)
    target_audience = Column(Text)
    channels = Column(ARRAY(Text))
    budget = Column(Numeric(12, 2))
    timeline = Column(Text)
    tone = Column(String(32))
    key_messages = Column(ARRAY(Text))
    status = Column(String(32), default='created')
    result_data = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    variants = relationship("CopyVariant", back_populates="campaign", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_campaigns_workspace", "workspace_id"),
        Index("idx_campaigns_status", "status"),
    )


class CopyVariant(Base):
    __tablename__ = "copy_variants"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    campaign_id = Column(String(16), ForeignKey("campaigns.campaign_id"))
    variant_id = Column(String(16), nullable=False)
    subject_line = Column(Text)
    preview_text = Column(Text)
    body_html = Column(Text)
    body_text = Column(Text)
    cta_text = Column(Text)
    readability_score = Column(Numeric(5, 2))
    tone_alignment_score = Column(Numeric(5, 2))
    spam_risk_score = Column(Numeric(5, 2))
    estimated_open_rate = Column(Numeric(5, 2))
    estimated_ctr = Column(Numeric(5, 2))
    is_winner = Column(Boolean, default=False)
    suppressed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("Campaign", back_populates="variants")

    __table_args__ = (
        Index('idx_copy_variants_campaign_variant', 'campaign_id', 'variant_id', unique=True),
    )
