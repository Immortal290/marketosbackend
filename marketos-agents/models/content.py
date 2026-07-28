from sqlalchemy import Column, String, Text, DateTime, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from core.database import Base

class ContentCalendar(Base):
    __tablename__ = "content_calendar"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    slot_id = Column(String(16), unique=True)
    workspace_id = Column(String(64), nullable=False, default='default')
    campaign_id = Column(String(16))
    platform = Column(String(32))
    content_text = Column(Text)
    scheduled_at = Column(DateTime(timezone=True))
    status = Column(String(32), default='scheduled')
    published_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
