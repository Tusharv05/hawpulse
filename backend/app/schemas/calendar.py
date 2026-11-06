import uuid
from typing import List, Optional
from pydantic import BaseModel, Field

class CalendarStatusResponse(BaseModel):
    configured: bool = Field(..., description="True if Google OAuth Client ID & Secret are set")
    connected: bool = Field(..., description="True if active calendar tokens are loaded and valid")
    connected_email: Optional[str] = Field(None, description="Email of currently connected Google account")
    auth_url: Optional[str] = Field(None, description="Google OAuth authorization URL")

class ScheduledEventDetail(BaseModel):
    meal_label: str
    time: str
    summary: str
    html_link: str
    web_fallback_link: Optional[str] = None
    mode: str
    event_id: Optional[str] = None
    duration_days: Optional[int] = Field(30, description="Duration in days for daily recurrence")

class ScheduleFeedingRequest(BaseModel):
    pet_id: Optional[uuid.UUID] = None
    pet_name: str = "Cooper"
    current_food: Optional[str] = "Balanced Pet Formula"
    amount_per_day: Optional[str] = None
    morning_meal: Optional[str] = None
    evening_meal: Optional[str] = None
    morning_time: Optional[str] = "08:30"
    evening_time: Optional[str] = "19:30"
    notes: Optional[str] = None
    user_timezone: Optional[str] = None
    duration_days: int = Field(30, ge=1, le=365, description="Number of days to repeat daily feeding reminders (default: 30 days)")

class ScheduleFeedingResponse(BaseModel):
    success: bool
    mode: str
    message: str
    timezone: str
    duration_days: int = Field(30, description="Number of days scheduled for daily feeding recurrence")
    events: List[ScheduledEventDetail]

class ScheduleVaccineRequest(BaseModel):
    pet_id: Optional[uuid.UUID] = None
    pet_name: str = "Cooper"
    vaccine_name: str
    due_date: str
    batch_number: Optional[str] = "N/A"
    clinic_name: Optional[str] = "Veterinary Hospital"

class ScheduleVaccineResponse(BaseModel):
    success: bool
    mode: str
    event_id: Optional[str] = None
    html_link: str
    summary: str
    message: str
