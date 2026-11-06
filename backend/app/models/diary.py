import uuid
from datetime import datetime, timezone, date
from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base

class DiaryEvent(Base):
    __tablename__ = "diary_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id = Column(UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String, nullable=False)  # 'feed', 'walk', 'medication', 'poop', 'water', 'grooming', 'note'
    logged_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    details = Column(JSONB, default=dict)
    notes = Column(Text, nullable=True)
    logged_by_sitter = Column(Boolean, default=False)

class DailyRoutineItem(Base):
    __tablename__ = "daily_routines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id = Column(UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    time_str = Column(String, nullable=True)
    subtitle = Column(Text, nullable=True)
    category = Column(String, nullable=False, default="general")
    order_index = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class RoutineCompletion(Base):
    __tablename__ = "routine_completions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    routine_id = Column(UUID(as_uuid=True), ForeignKey("daily_routines.id", ondelete="CASCADE"), nullable=False, index=True)
    pet_id = Column(UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    completed_date = Column(Date, nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_by = Column(String, default="You")
