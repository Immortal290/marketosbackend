from sqlalchemy import Column, String, Text, Numeric, Boolean, DateTime, Integer, ARRAY, text, ForeignKey, UniqueConstraint, CHAR
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from core.database import Base

class SendResult(Base):
    __tablename__ = "send_results"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    campaign_id = Column(String(16), ForeignKey("campaigns.campaign_id"))
    message_id = Column(String(64))
    status = Column(String(32))
    provider = Column(String(64))
    recipient_count = Column(Integer)
    real_email_sent = Column(Boolean, default=False)
    real_email_status = Column(Text)
    optimal_send_time = Column(Text)
    drip_sequence_json = Column(JSONB)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())


class SmsSuppression(Base):
    __tablename__ = "sms_suppressions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    phone_normalized = Column(String(20), nullable=False)
    workspace_id = Column(String(64), nullable=False, default='default')
    reason = Column(String(64), default='opt_out')
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("phone_normalized", "workspace_id", name="sms_suppressions_phone_normalized_workspace_id_key"),
    )


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    contact_id = Column(String(64), unique=True)
    workspace_id = Column(String(64), nullable=False, default='default')
    email = Column(String(256))
    phone = Column(String(20))
    first_name = Column(String(128))
    last_name = Column(String(128))
    city = Column(Text)
    country = Column(CHAR(2))
    language = Column(String(8), default='en')
    segment = Column(String(64))
    last_purchase_days_ago = Column(Integer)
    total_orders = Column(Integer, default=0)
    avg_order_value = Column(Numeric(10, 2))
    email_opens_30d = Column(Integer, default=0)
    email_clicks_30d = Column(Integer, default=0)
    preferred_time = Column(String(16))
    tags = Column(ARRAY(Text))
    consent_type = Column(String(32), default='implied')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
