import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Date, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base

class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id = Column(UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    document_url = Column(String, nullable=False)
    clinic_name = Column(String, nullable=True)
    vet_name = Column(String, nullable=True)
    parsed_diagnosis = Column(Text, nullable=True)
    simplified_explanation = Column(Text, nullable=True)
    medications_extracted = Column(JSONB, nullable=False, default=list)
    raw_ocr_output = Column(Text, nullable=True)
    is_reviewed_by_user = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Vaccination(Base):
    __tablename__ = "vaccinations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id = Column(UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    vaccine_name = Column(String, nullable=False)
    date_administered = Column(Date, nullable=False)
    next_due_date = Column(Date, nullable=False)
    batch_number = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    source_document_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
