import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Time, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base

class DietPlan(Base):
    __tablename__ = "diet_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id = Column(UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    target_calories_kcal = Column(Integer, nullable=False)
    meals_per_day = Column(Integer, nullable=False, default=2)
    diet_type = Column(String, nullable=False)
    custom_instructions = Column(Text, nullable=True)
    full_plan_json = Column(JSONB, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class MealSchedule(Base):
    __tablename__ = "meal_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id = Column(UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    diet_plan_id = Column(UUID(as_uuid=True), ForeignKey("diet_plans.id", ondelete="SET NULL"), nullable=True)
    schedule_type = Column(String, nullable=False, default="ai")  # 'manual' or 'ai'
    meal_time = Column(Time, nullable=False)
    portion_size = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
