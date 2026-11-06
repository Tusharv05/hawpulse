from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import date, datetime

class ExtractedMedication(BaseModel):
    name: str
    form: Optional[str] = None       # tablet, liquid, drops, ointment
    dosage: Optional[str] = None     # e.g., "250mg"
    frequency: str                   # e.g., "Every 12 hours (BID)"
    duration: Optional[str] = None   # e.g., "7 Days (Day 4 of 7)"
    instructions: Optional[str] = None # e.g., "Give with food"
    side_effects: Optional[str] = None # e.g., "Watch for mild drowsiness"

class PrescriptionExtractionResponse(BaseModel):
    id: UUID
    pet_id: UUID
    document_url: str
    clinic_name: Optional[str] = None
    vet_name: Optional[str] = None
    parsed_diagnosis: str
    simplified_explanation: str
    medications_extracted: List[ExtractedMedication]
    is_reviewed_by_user: bool
    created_at: datetime
    vaccines_detected: Optional[List[Dict[str, Any]]] = None

    class Config:
        from_attributes = True

class VaccinationResponse(BaseModel):
    id: UUID
    pet_id: UUID
    vaccine_name: str
    date_administered: date
    next_due_date: date
    batch_number: Optional[str] = None
    is_verified: bool
    source_document_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class VaccineRoadmapMilestone(BaseModel):
    vaccine_name: str
    recommended_age_weeks: int
    due_date: Optional[date] = None
    date_administered: Optional[date] = None
    batch_number: Optional[str] = None
    clinic_name: Optional[str] = None
    status: str  # 'completed', 'due_soon', 'overdue', 'upcoming'
    is_core: bool

class VaccineRoadmapResponse(BaseModel):
    pet_id: UUID
    species: str
    age_weeks: int
    is_fully_vaccinated: bool
    safe_walk_progress_percentage: int
    can_visit_public_parks: bool
    milestones: List[VaccineRoadmapMilestone]
    active_vaccinations: List[VaccinationResponse]

class ToggleMilestoneRequest(BaseModel):
    milestone_name: str
    target_status: Optional[str] = None  # 'completed' | 'upcoming' | None to toggle

