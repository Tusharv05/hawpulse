from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import date, datetime

class PetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    species: str = Field(..., pattern="^(dog|cat)$")
    gender: Optional[str] = Field("male", pattern="^(male|female)$")
    breed: str
    birth_date: date
    weight_kg: float = Field(..., gt=0.1, lt=150.0)
    allergies: List[str] = Field(default_factory=list)
    energy_level: Optional[str] = Field("moderate", pattern="^(low|moderate|high|hyper)$")
    play_style: Optional[str] = None
    is_neutered: bool = False
    vax_status: Optional[str] = Field("unknown", pattern="^(full|partial|none|unknown)$")
    avatar_url: Optional[str] = None
    photos: Optional[List[str]] = Field(default_factory=list)

class PetUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = Field(None, pattern="^(dog|cat)$")
    gender: Optional[str] = Field(None, pattern="^(male|female)$")
    breed: Optional[str] = None
    birth_date: Optional[date] = None
    weight_kg: Optional[float] = None
    allergies: Optional[List[str]] = None
    energy_level: Optional[str] = None
    play_style: Optional[str] = None
    is_neutered: Optional[bool] = None
    vax_status: Optional[str] = None
    avatar_url: Optional[str] = None
    photos: Optional[List[str]] = None

class PetResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    species: str
    gender: Optional[str] = "male"
    breed: str
    birth_date: date
    weight_kg: float
    allergies: List[str]
    energy_level: Optional[str] = None
    play_style: Optional[str] = None
    is_neutered: bool
    vax_status: str
    avatar_url: Optional[str] = None
    photos: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
