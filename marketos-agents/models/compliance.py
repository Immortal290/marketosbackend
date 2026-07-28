from sqlalchemy import Column, String, Text, Numeric, Boolean, DateTime, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from core.database import Base


class ComplianceAudit(Base):
    __tablename__ = "compliance_audit"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    campaign_id = Column(String(16))
    variant_id = Column(String(16))
    approved = Column(Boolean, nullable=False)
    compliance_score = Column(Numeric(5, 2))
    checks_json = Column(JSONB)
    reason_code = Column(String(64))
    blocked_reason = Column(Text)
    reviewed_at = Column(DateTime(timezone=True), server_default=func.now())
