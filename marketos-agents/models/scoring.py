from sqlalchemy import Column, String, Text, Numeric, DateTime, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from core.database import Base

class ContactScore(Base):
    __tablename__ = "contact_scores"

    contact_id = Column(String(64), primary_key=True)
    workspace_id = Column(String(64), primary_key=True, default='default')
    score = Column(Numeric(8, 2), default=0)
    lifecycle_stage = Column(String(32), default='subscriber')
    last_activity_at = Column(DateTime(timezone=True), server_default=func.now())


class OnboardingPlan(Base):
    __tablename__ = "onboarding_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    onboarding_id = Column(String(64), unique=True)
    workspace_id = Column(String(64), nullable=False, default='default')
    workspace_type = Column(String(64))
    user_email = Column(String(128))
    drip_json = Column(JSONB)
    tasks_json = Column(JSONB)
    churn_risk = Column(Text)
    status = Column(String(32), default='active')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
