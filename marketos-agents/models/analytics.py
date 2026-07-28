from sqlalchemy import Column, String, Text, Numeric, Boolean, DateTime, Integer, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from core.database import Base

class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    workspace_id = Column(String(64), nullable=False, default='default')
    rule_id = Column(String(64), unique=True, nullable=False)
    metric = Column(String(128), nullable=False)
    condition = Column(String(16), nullable=False)
    threshold = Column(Numeric(12, 4), nullable=False)
    severity = Column(String(16), nullable=False)
    tier = Column(Integer, default=1)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MonitorIncident(Base):
    __tablename__ = "monitor_incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    incident_id = Column(String(64), unique=True, nullable=False)
    campaign_id = Column(String(16))
    rule_id = Column(String(64))
    severity = Column(String(16))
    metric = Column(String(128))
    observed_value = Column(Numeric(12, 4))
    threshold = Column(Numeric(12, 4))
    status = Column(String(32), default='open')
    remediation = Column(Text)
    fired_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True))


class CampaignSpend(Base):
    __tablename__ = "campaign_spend"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    campaign_id = Column(String(16))
    workspace_id = Column(String(64), nullable=False, default='default')
    channel = Column(String(32))
    amount_inr = Column(Numeric(12, 2))
    conversions = Column(Integer, default=0)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())


class RoiAttribution(Base):
    __tablename__ = "roi_attributions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    campaign_id = Column(String(16), unique=True)
    workspace_id = Column(String(64), nullable=False, default='default')
    total_spend = Column(Numeric(12, 2))
    attributed_revenue = Column(Numeric(12, 2))
    conversions = Column(Integer, default=0)
    roas = Column(Numeric(8, 4))
    cpa = Column(Numeric(12, 2))
    attributed_at = Column(DateTime(timezone=True), server_default=func.now())
