from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from uuid import UUID

class HealthChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str

class HealthChatRequest(BaseModel):
    pet_id: Optional[Any] = None
    message: str
    chat_history: Optional[List[HealthChatMessage]] = Field(default_factory=list)

class EmergencyTriageAlert(BaseModel):
    is_emergency: bool = False
    toxin_detected: Optional[str] = None
    severity: str = "normal"  # "normal", "urgent", "critical"
    immediate_action: Optional[str] = None
    hotlines: List[Dict[str, str]] = Field(default_factory=list)
    nearby_er_clinics: List[Dict[str, Any]] = Field(default_factory=list)

class HealthChatResponse(BaseModel):
    answer: str
    triage: EmergencyTriageAlert
    grounded_context_summary: Optional[str] = None
    medical_disclaimer: str = (
        "HawPulse AI provides educational pet wellness advice. "
        "It does not substitute professional clinical veterinary diagnosis or emergency care."
    )
