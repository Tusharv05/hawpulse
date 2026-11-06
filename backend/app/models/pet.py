import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Date, Numeric, Boolean, DateTime, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class Pet(Base):
    __tablename__ = "pets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    species = Column(String, nullable=False)  # 'dog' or 'cat'
    gender = Column(String, default="male", nullable=True)  # 'male' or 'female'
    breed = Column(String, nullable=False)
    birth_date = Column(Date, nullable=False)
    weight_kg = Column(Numeric(5, 2), nullable=False)
    allergies = Column(ARRAY(String), default=list)
    energy_level = Column(String, nullable=True)  # 'low', 'moderate', 'high', 'hyper'
    play_style = Column(String, nullable=True)
    is_neutered = Column(Boolean, default=False)
    vax_status = Column(String, default="unknown")  # 'full', 'partial', 'none', 'unknown'
    avatar_url = Column(String, nullable=True)
    photos = Column(ARRAY(String), default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
