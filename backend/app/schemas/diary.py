from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, model_validator
from uuid import UUID
from datetime import datetime

class DiaryLogCreate(BaseModel):
    pet_id: UUID
    event_type: str = Field(..., pattern="^(feed|walk|medication|meds|poop|potty|water|grooming|groom|note)$")
    details: Optional[Dict[str, Any]] = Field(default_factory=dict)
    notes: Optional[str] = None
    logged_by_sitter: bool = False

    @model_validator(mode="after")
    def normalize_event_type(self):
        norm_map = {
            "potty": "poop",
            "meds": "medication",
            "groom": "grooming"
        }
        if self.event_type in norm_map:
            self.event_type = norm_map[self.event_type]
        return self

class DiaryEventResponse(BaseModel):
    id: UUID
    pet_id: UUID
    event_type: str
    logged_at: datetime
    timestamp: Optional[datetime] = None
    details: Dict[str, Any]
    notes: Optional[str] = None
    logged_by_sitter: bool

    @model_validator(mode="after")
    def populate_timestamp(self):
        if self.timestamp is None:
            self.timestamp = self.logged_at
        return self

    class Config:
        from_attributes = True

class DailyDiarySummaryResponse(BaseModel):
    pet_id: UUID
    date: str
    total_events: int
    feed_count: int
    walk_count: int
    medication_count: int
    streak_days: int
    timeline: List[DiaryEventResponse]
    events: Optional[List[DiaryEventResponse]] = None

    @model_validator(mode="after")
    def populate_events_alias(self):
        if self.events is None:
            self.events = self.timeline
        return self

class SitterShareResponse(BaseModel):
    share_token: str
    share_url: str
    expires_in_hours: int = 72

class RoutineItemResponse(BaseModel):
    id: UUID
    pet_id: UUID
    title: str
    subtitle: Optional[str] = None
    time_str: Optional[str] = None
    category: str
    order_index: int = 0
    done: bool = False
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None

    class Config:
        from_attributes = True

class RoutineToggleResponse(BaseModel):
    routine_id: UUID
    done: bool
    message: str

class UpNextResponse(BaseModel):
    id: Optional[UUID] = None
    title: str
    time_str: str
    category: str
    subtitle: str
    due_in_text: str
    is_completed: bool
    portion_size: Optional[str] = None
