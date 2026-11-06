from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import time, datetime

class MealPortionItem(BaseModel):
    meal_number: int
    time_label: str
    portion_grams: float
    portion_cups: Optional[str] = None
    ingredients: str
    purpose: Optional[str] = None

class GroomingCadence(BaseModel):
    brushing_frequency: str
    bathing_frequency: str
    ear_cleaning: Optional[str] = None

class DietPlanGenerateRequest(BaseModel):
    pet_id: UUID
    custom_prompt: Optional[str] = None  # e.g., "Allergic to chicken, high protein"
    diet_preset: Optional[str] = None   # e.g., "Puppy Growth", "Senior Joint Care", "Weight Cutting"
    weight_kg: Optional[float] = None
    activity_level: Optional[str] = None

class StructuredDietPlan(BaseModel):
    target_calories_kcal: int
    daily_water_intake_ml: int
    meals_per_day: int
    recommended_diet_type: str
    meal_breakdown: List[MealPortionItem]
    toxic_and_restricted_foods: List[str]
    grooming_cadence: GroomingCadence

class DietPlanResponse(BaseModel):
    id: UUID
    pet_id: UUID
    target_calories_kcal: int
    meals_per_day: int
    diet_type: str
    custom_instructions: Optional[str] = None
    full_plan_json: Dict[str, Any]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class AdoptDietPlanRequest(BaseModel):
    diet_plan_id: UUID

class MealScheduleItem(BaseModel):
    id: UUID
    pet_id: UUID
    diet_plan_id: Optional[UUID] = None
    schedule_type: str
    meal_time: time
    portion_size: str
    notes: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

class ManualRoutineDietPlanCreate(BaseModel):
    pet_id: UUID
    overview: Optional[str] = None
    current_food: str
    amount_per_day: str
    meals: Optional[str] = None
    morning_meal: Optional[str] = None
    evening_meal: Optional[str] = None
    snacks: Optional[str] = None
    notes: Optional[str] = None
    custom_walks: Optional[str] = None

class PhotoRoutineExtractionResponse(BaseModel):
    overview: str
    current_food: str
    amount_per_day: str
    meals: str
    morning_meal: Optional[str] = None
    evening_meal: Optional[str] = None
    snacks: Optional[str] = None
    notes: str
    custom_walks: Optional[str] = None
    document_url: Optional[str] = None

class PetIdRequest(BaseModel):
    pet_id: UUID

class DietRoutineDetailResponse(BaseModel):
    pet_id: UUID
    is_configured: bool
    overview: Optional[str] = None
    current_food: Optional[str] = None
    amount_per_day: Optional[str] = None
    meals: Optional[str] = None
    morning_meal: Optional[str] = None
    evening_meal: Optional[str] = None
    snacks: Optional[str] = None
    notes: Optional[str] = None
    custom_walks: Optional[str] = None

class IngredientSafetyRequest(BaseModel):
    ingredient: str
    species: Optional[str] = "dog"

class IngredientSafetyResponse(BaseModel):
    name: str
    status: str  # "safe" | "moderate" | "severe" | "fatal"
    note: str
    icon: Optional[str] = "🍽️"
    recommendation: Optional[str] = None
    is_safe: bool = True

class MealReminderItem(BaseModel):
    label: str
    time_str: str = "08:30"
    portion: Optional[str] = None
    ingredients: Optional[str] = None

class DietCalendarScheduleRequest(BaseModel):
    pet_name: str
    meals: List[MealReminderItem]
    timezone: Optional[str] = None
    duration_days: int = Field(30, ge=1, le=365, description="Number of days to repeat meal reminders (default 30 days)")

class CalendarEventResult(BaseModel):
    meal_label: str
    time_str: str
    summary: str
    mode: str
    html_link: str
    event_id: Optional[str] = None
    timezone: Optional[str] = None
    duration_days: Optional[int] = Field(30, description="Duration in days for recurrence")

class DietCalendarScheduleResponse(BaseModel):
    success: bool
    mode: str
    message: str
    duration_days: int = Field(30, description="Number of days scheduled")
    events: List[CalendarEventResult]

class WalkPlayAiRequest(BaseModel):
    pet_id: Optional[UUID] = None
    name: Optional[str] = "Coco"
    species: Optional[str] = "dog"
    breed: Optional[str] = "Canine"
    age_years: Optional[float] = None
    weight_kg: Optional[float] = None
    energy_level: Optional[str] = None
    play_style: Optional[str] = None

class WalkPlayAiResponse(BaseModel):
    overview: str
    daily_target: str
    morning_walk: str
    evening_walk: str
    playtime_games: str
    gear_behavior: str
    weather_safety: str
