from typing import Optional
from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

class RequestOTPRequest(BaseModel):
    email: EmailStr

class RequestOTPResponse(BaseModel):
    message: str
    email: str
    expires_in_minutes: int = 5
    dispatch_mode: Optional[str] = "email"

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str

class GoogleAuthRequest(BaseModel):
    id_token: Optional[str] = None
    code: Optional[str] = None
    redirect_uri: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    city: str
    full_name: Optional[str] = None
    area_neighborhood: Optional[str] = None
    is_first_time_parent: bool = False
    gender: Optional[str] = None
    hobbies: Optional[str] = None
    vibe_routine: Optional[str] = None
    bio: Optional[str] = None
    household_mode: Optional[str] = "solo"
    partner_name: Optional[str] = None
    partner_gender: Optional[str] = None
    partner_hobbies: Optional[str] = None
    partner_vibe: Optional[str] = None
    avatar_url: Optional[str] = None
    partner_avatar_url: Optional[str] = None

class LocationUpdateRequest(BaseModel):
    latitude: float
    longitude: float

class LocationUpdateResponse(BaseModel):
    city: str
    area_neighborhood: Optional[str] = None
    latitude_fuzzy: float
    longitude_fuzzy: float
    message: str

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    city: Optional[str] = None
    area_neighborhood: Optional[str] = None
    is_first_time_parent: Optional[bool] = None
    gender: Optional[str] = None
    hobbies: Optional[str] = None
    vibe_routine: Optional[str] = None
    bio: Optional[str] = None
    household_mode: Optional[str] = None
    partner_name: Optional[str] = None
    partner_gender: Optional[str] = None
    partner_hobbies: Optional[str] = None
    partner_vibe: Optional[str] = None
    avatar_url: Optional[str] = None
    partner_avatar_url: Optional[str] = None

class ProfileResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str] = None
    city: str
    area_neighborhood: Optional[str] = None
    is_first_time_parent: bool
    gender: Optional[str] = None
    hobbies: Optional[str] = None
    vibe_routine: Optional[str] = None
    bio: Optional[str] = None
    household_mode: Optional[str] = None
    partner_name: Optional[str] = None
    partner_gender: Optional[str] = None
    partner_hobbies: Optional[str] = None
    partner_vibe: Optional[str] = None
    avatar_url: Optional[str] = None
    partner_avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

