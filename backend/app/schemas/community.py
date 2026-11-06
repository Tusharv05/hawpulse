from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

class CommunityRadarQuery(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = Field(5.0, ge=0.5, le=50.0)
    species: Optional[str] = None
    energy_level: Optional[str] = None
    size: Optional[str] = None

class NearbyPetResult(BaseModel):
    pet_id: UUID
    pet_name: str
    species: str
    breed: str
    energy_level: Optional[str] = None
    play_style: Optional[str] = None
    is_neutered: bool
    vax_status: str
    avatar_url: Optional[str] = None
    photos: List[str] = Field(default_factory=list)
    distance_meters: float
    fuzzy_neighborhood: Optional[str] = None

class CommunityEventCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=150)
    description: Optional[str] = None
    location_name: str
    latitude: float
    longitude: float
    event_time: datetime
    max_attendees: int = Field(15, ge=2, le=100)
    requires_verified_vax: bool = True

class CommunityEventResponse(BaseModel):
    id: UUID
    creator_id: UUID
    city: str
    title: str
    description: Optional[str] = None
    location_name: str
    latitude: float
    longitude: float
    event_time: datetime
    max_attendees: int
    current_rsvps: int = 0
    requires_verified_vax: bool
    created_at: datetime

    class Config:
        from_attributes = True

class EventRSVPRequest(BaseModel):
    pet_id: UUID
    status: str = Field("going", pattern="^(going|interested|cancelled)$")

class EventRSVPResponse(BaseModel):
    id: UUID
    event_id: UUID
    pet_id: UUID
    user_id: UUID
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class DiscoverPetResult(BaseModel):
    id: UUID
    name: str
    age: str
    breed: str
    species: str
    energy_level: Optional[str] = None
    play_style: Optional[str] = None
    is_neutered: bool = False
    vax_status: str = "full"
    image: str
    photos: List[str] = Field(default_factory=list)
    distance_km: float = 1.8
    distance_label: str = "Nearby"
    parents: str
    lifestyle: str
    bio: str
    tags: List[str] = Field(default_factory=list)
    owner_id: UUID
    owner_name: Optional[str] = None
    owner_avatar: Optional[str] = None
    area_neighborhood: Optional[str] = None
    city: Optional[str] = None
    household_mode: Optional[str] = "solo"
    partner_name: Optional[str] = None
    vibe_routine: Optional[str] = None
    hobbies: Optional[str] = None
    is_verified_parent: bool = True
    owner_initials: Optional[str] = None
    has_liked_you: bool = False
    is_matched: bool = False
    match_id: Optional[UUID] = None

# --- Matchmaking (Like / Pass) & Messaging Schemas ---

class SwipeRequest(BaseModel):
    sender_pet_id: Optional[UUID] = None
    target_pet_id: UUID
    action: str = Field(..., pattern="^(like|pass)$")
    simulate_reciprocal: bool = False

class SwipeResponse(BaseModel):
    success: bool
    action: str
    is_match: bool
    match_id: Optional[UUID] = None
    message: str

class MatchResponse(BaseModel):
    match_id: UUID
    matched_pet_id: UUID
    matched_pet_name: str
    matched_pet_breed: str
    matched_pet_species: str
    matched_pet_energy: Optional[str] = None
    matched_pet_play_style: Optional[str] = None
    matched_pet_avatar: Optional[str] = None
    matched_pet_photos: List[str] = Field(default_factory=list)
    owner_id: UUID
    owner_name: Optional[str] = None
    owner_neighborhood: Optional[str] = None
    matched_at: datetime
    latest_message: Optional[str] = None
    has_conversation: bool = False

class SendMessageRequest(BaseModel):
    recipient_id: UUID
    match_id: Optional[UUID] = None
    content: str = Field(..., min_length=1, max_length=2000)

class DirectMessageResponse(BaseModel):
    id: UUID
    match_id: Optional[UUID] = None
    sender_id: UUID
    recipient_id: UUID
    content: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
