import os
import re
import uuid
from datetime import time, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.database import get_db
from app.core.security import get_current_user_id, decode_token
from app.models.pet import Pet
from app.models.diet import DietPlan, MealSchedule
from app.models.diary import DailyRoutineItem
from app.schemas.diet import (
    DietPlanGenerateRequest, DietPlanResponse, AdoptDietPlanRequest,
    MealScheduleItem, StructuredDietPlan, ManualRoutineDietPlanCreate,
    PhotoRoutineExtractionResponse, PetIdRequest, DietRoutineDetailResponse,
    IngredientSafetyRequest, IngredientSafetyResponse,
    WalkPlayAiRequest, WalkPlayAiResponse
)
from app.services.qwen_hf_service import qwen_hf_service
from app.services.storage import storage_service
from app.services.routine_service import build_pet_routine_items
from app.services.nutrition_engine import calculate_target_calories

router = APIRouter(prefix="/diet", tags=["AI Nutrition & Meal Schedules"])

@router.post("/generate", response_model=DietPlanResponse)
async def generate_diet_plan(
    payload: DietPlanGenerateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    On-Demand AI Diet & Meal Plan Generator:
    Fuses deterministic RER/DER math with Qwen2.5-VL structured reasoning.
    """
    stmt = select(Pet).where(Pet.id == payload.pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found or not owned by user")

    pet_dict = {
        "id": pet.id,
        "name": pet.name,
        "species": pet.species,
        "breed": pet.breed,
        "weight_kg": pet.weight_kg,
        "birth_date": pet.birth_date,
        "allergies": pet.allergies,
        "is_neutered": pet.is_neutered
    }

    # Call AI generation service (uses weight & activity chosen in the Quick Plan UI)
    structured_plan = await qwen_hf_service.generate_diet_plan(
        pet=pet_dict,
        custom_prompt=payload.custom_prompt,
        diet_preset=payload.diet_preset,
        weight_kg=payload.weight_kg,
        activity_level=payload.activity_level
    )

    # No predefined fallback: the meal plan must come from the AI
    if not structured_plan:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI meal plan generation is temporarily unavailable. Please try again in a moment."
        )

    # Mirror the AI recipe title into current_food for the Diet Plan form
    structured_plan["current_food"] = structured_plan.get("recommended_diet_type")
    structured_plan["overview"] = structured_plan.get("overview") or structured_plan.get("paragraph")

    # Save generated plan to database
    diet_plan = DietPlan(
        pet_id=pet.id,
        target_calories_kcal=structured_plan["target_calories_kcal"],
        meals_per_day=structured_plan["meals_per_day"],
        diet_type=structured_plan["recommended_diet_type"],
        custom_instructions=payload.custom_prompt or payload.diet_preset,
        full_plan_json=structured_plan,
        is_active=False
    )
    db.add(diet_plan)
    await db.commit()
    await db.refresh(diet_plan)

    return diet_plan

@router.post("/manual-plan", response_model=DietPlanResponse)
async def save_manual_diet_and_routine_plan(
    payload: ManualRoutineDietPlanCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Saves user-configured or AI/Photo-extracted Diet & Routine plan:
    1. Records active plan in diet_plans
    2. Synchronizes meal_schedules and daily_routines for the pet in database
    """
    stmt = select(Pet).where(Pet.id == payload.pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found or not owned by user")

    weight = float(pet.weight_kg or 25.0)
    rer = 70.0 * (weight ** 0.75)
    baseline_cal = int(round(rer * (1.6 if pet.is_neutered else 1.8)))

    # Parse calories from amount_per_day safely:
    # 1. Look for explicit kcal in amount_per_day string e.g. "(1507 kcal)" or "1600 kcal"
    kcal_match = re.search(r'(\d+)\s*(?:kcal|calories)', payload.amount_per_day or "", re.IGNORECASE)
    if kcal_match:
        parsed_kcal = int(kcal_match.group(1))
        # Ensure parsed kcal is clinically plausible for pet's current weight (at least 80% of RER)
        calories = parsed_kcal if (parsed_kcal >= rer * 0.8) else baseline_cal
    else:
        # 2. Look for grams e.g. "430 g"
        g_match = re.search(r'(\d+)\s*g', payload.amount_per_day or "", re.IGNORECASE)
        if g_match:
            parsed_grams = int(g_match.group(1))
            est_cal = int(round(parsed_grams * 3.5))
            calories = est_cal if (est_cal >= rer * 0.8) else baseline_cal
        else:
            calories = baseline_cal

    # Ensure amount_per_day text stays synchronized with pet weight if it was empty, outdated, or legacy 720/200
    total_food_grams = int(round(calories / 3.5))
    amount_text = payload.amount_per_day or ""
    if not amount_text or "720" in amount_text or (kcal_match and int(kcal_match.group(1)) < rer * 0.8):
        amount_text = f"About {total_food_grams} g of balanced food a day ({calories} kcal)"

    # Set old plans inactive
    await db.execute(update(DietPlan).where(DietPlan.pet_id == pet.id).values(is_active=False))

    plan_json = {
        "overview": payload.overview,
        "current_food": payload.current_food,
        "amount_per_day": amount_text,
        "meals": payload.meals,
        "morning_meal": payload.morning_meal,
        "evening_meal": payload.evening_meal,
        "snacks": payload.snacks,
        "notes": payload.notes,
        "custom_walks": payload.custom_walks,
        "target_calories_kcal": calories,
        "weight_kg_used": weight
    }

    diet_plan = DietPlan(
        pet_id=pet.id,
        target_calories_kcal=calories,
        meals_per_day=2,
        diet_type=payload.current_food,
        custom_instructions=payload.notes,
        full_plan_json=plan_json,
        is_active=True
    )
    db.add(diet_plan)
    await db.flush()

    # Update daily_routines for pet
    stmt_old = select(DailyRoutineItem).where(DailyRoutineItem.pet_id == pet.id)
    res_old = await db.execute(stmt_old)
    for r in res_old.scalars().all():
        await db.delete(r)

    half_grams = max(round(total_food_grams / 2), 50)
    routines_to_add = build_pet_routine_items(
        pet_id=pet.id,
        food_name=payload.current_food,
        half_grams_or_desc=str(half_grams),
        overview_text=payload.overview or "Morning meal formulated for energy and digestion",
        notes_text=payload.notes or "Evening nutrition + mobility support",
        custom_walks=payload.custom_walks
    )
    for r in routines_to_add:
        db.add(r)

    # Re-sync meal_schedules
    stmt_ms = select(MealSchedule).where(MealSchedule.pet_id == pet.id)
    res_ms = await db.execute(stmt_ms)
    for s in res_ms.scalars().all():
        await db.delete(s)

    db.add(MealSchedule(
        pet_id=pet.id,
        diet_plan_id=diet_plan.id,
        schedule_type="manual",
        meal_time=time(8, 30),
        portion_size=f"{half_grams}g",
        notes=payload.current_food,
        is_active=True
    ))
    db.add(MealSchedule(
        pet_id=pet.id,
        diet_plan_id=diet_plan.id,
        schedule_type="manual",
        meal_time=time(19, 30),
        portion_size=f"{half_grams}g",
        notes=payload.current_food,
        is_active=True
    ))

    await db.commit()
    await db.refresh(diet_plan)
    return diet_plan

@router.post("/upload-routine-photo", response_model=PhotoRoutineExtractionResponse)
async def upload_routine_photo(
    pet_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Multimodal Vision OCR:
    Upload a photo of food packaging, vet care notes, or feeding guide.
    AI extracts food details, daily portions, meal schedule, and instructions.
    """
    stmt = select(Pet).where(Pet.id == pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    file_bytes = await file.read()
    doc_url = await storage_service.save_uploaded_file(file_bytes, file.filename)
    full_path = os.path.join(storage_service.upload_dir, os.path.basename(doc_url))

    parsed = await qwen_hf_service.parse_routine_food_image(full_path, pet_name=pet.name, species=pet.species)

    return PhotoRoutineExtractionResponse(
        overview=parsed.get("overview", ""),
        current_food=parsed.get("current_food", ""),
        amount_per_day=parsed.get("amount_per_day", ""),
        meals=parsed.get("meals", ""),
        morning_meal=parsed.get("morning_meal", ""),
        evening_meal=parsed.get("evening_meal", ""),
        snacks=parsed.get("snacks", ""),
        notes=parsed.get("notes", ""),
        custom_walks=parsed.get("custom_walks", ""),
        document_url=doc_url
    )

@router.post("/generate-routine-ai", response_model=PhotoRoutineExtractionResponse)
async def generate_routine_form_ai(
    payload: PetIdRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    AI generation of daily routine & feeding guidance based on pet's breed, age, and weight.
    """
    stmt = select(Pet).where(Pet.id == payload.pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    pet_dict = {
        "name": pet.name,
        "species": pet.species,
        "breed": pet.breed,
        "weight_kg": pet.weight_kg
    }
    parsed = await qwen_hf_service.generate_routine_form_ai(pet_dict)

    return PhotoRoutineExtractionResponse(
        overview=parsed.get("overview", ""),
        current_food=parsed.get("current_food", ""),
        amount_per_day=parsed.get("amount_per_day", ""),
        meals=parsed.get("meals", ""),
        morning_meal=parsed.get("morning_meal", ""),
        evening_meal=parsed.get("evening_meal", ""),
        snacks=parsed.get("snacks", ""),
        notes=parsed.get("notes", ""),
        custom_walks=parsed.get("custom_walks", "")
    )

optional_bearer = HTTPBearer(auto_error=False)

@router.post("/generate-walk-play-ai", response_model=WalkPlayAiResponse)
async def generate_walk_play_ai_endpoint(
    payload: WalkPlayAiRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(optional_bearer),
    db: AsyncSession = Depends(get_db)
):
    """
    AI generation of personalized Walk/Play note schedule based on pet profile
    (name, breed, species, age, weight, energy level, play style).
    """
    pet_name = payload.name or "your pet"
    species = payload.species or "dog"
    breed = payload.breed or "Canine"
    age_str = ""
    weight = payload.weight_kg
    energy_level = payload.energy_level
    play_style = payload.play_style

    user_id = None
    if credentials:
        try:
            tok = decode_token(credentials.credentials)
            user_id = tok.get("sub")
        except Exception:
            pass

    if payload.pet_id:
        try:
            if user_id:
                stmt = select(Pet).where(Pet.id == payload.pet_id, Pet.owner_id == uuid.UUID(user_id))
            else:
                stmt = select(Pet).where(Pet.id == payload.pet_id)
            result = await db.execute(stmt)
            pet = result.scalar_one_or_none()
            if pet:
                pet_name = pet.name or pet_name
                species = pet.species or species
                breed = pet.breed or breed
                weight = float(pet.weight_kg) if pet.weight_kg else weight
                energy_level = pet.energy_level or energy_level
                play_style = pet.play_style or play_style
                if pet.birth_date:
                    from datetime import date
                    today = date.today()
                    birth = pet.birth_date
                    years = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
                    months = (today.year - birth.year) * 12 + today.month - birth.month
                    if years < 1:
                        age_str = f"{max(months, 1)} months old (puppy)"
                    elif years == 1:
                        age_str = "1 year old"
                    else:
                        age_str = f"{years} years old"
        except Exception as db_err:
            print(f"[Walk AI DB lookup notice: {db_err}]")

    if not age_str and payload.age_years:
        if payload.age_years < 1:
            age_str = f"{int(payload.age_years * 12)} months old"
        else:
            age_str = f"{payload.age_years} years old"

    pet_dict = {
        "name": pet_name,
        "species": species,
        "breed": breed,
        "age_str": age_str or "Adult",
        "weight_kg": weight or 15.0,
        "energy_level": energy_level or "moderate",
        "play_style": play_style or "fetch and scent exploration",
    }

    parsed = await qwen_hf_service.generate_walk_play_ai(pet_dict)
    return WalkPlayAiResponse(
        overview=parsed.get("overview", ""),
        daily_target=parsed.get("daily_target", ""),
        morning_walk=parsed.get("morning_walk", ""),
        evening_walk=parsed.get("evening_walk", ""),
        playtime_games=parsed.get("playtime_games", ""),
        gear_behavior=parsed.get("gear_behavior", ""),
        weather_safety=parsed.get("weather_safety", "")
    )

@router.get("/{pet_id}/detail", response_model=DietRoutineDetailResponse)
async def get_diet_routine_detail(
    pet_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns configured routine & diet plan details for a pet.
    """
    stmt = (
        select(DietPlan)
        .where(DietPlan.pet_id == pet_id, DietPlan.is_active == True)
        .order_by(DietPlan.created_at.desc())
    )
    result = await db.execute(stmt)
    active_plan = result.scalars().first()
    if not active_plan or not active_plan.full_plan_json:
        return DietRoutineDetailResponse(pet_id=pet_id, is_configured=False)

    data = dict(active_plan.full_plan_json)

    # Sanity check: Ensure calorie target & amount_per_day match pet's current weight
    stmt_pet = select(Pet).where(Pet.id == pet_id)
    res_pet = await db.execute(stmt_pet)
    pet = res_pet.scalar_one_or_none()
    if pet and pet.weight_kg:
        weight = float(pet.weight_kg)
        rer = 70.0 * (weight ** 0.75)
        if active_plan.target_calories_kcal < int(rer * 0.85):
            calc = calculate_target_calories(
                species=pet.species or "dog",
                weight_kg=weight,
                birth_date=pet.birth_date or (date.today() - timedelta(days=365 * 2)),
                is_neutered=bool(pet.is_neutered),
                diet_preset=active_plan.diet_type or ""
            )
            active_plan.target_calories_kcal = calc["target_der_kcal"]
            data["target_calories_kcal"] = calc["target_der_kcal"]
            data["weight_kg_used"] = weight
            data["amount_per_day"] = f"About {calc['total_food_grams_per_day']} g of food a day ({calc['target_der_kcal']} kcal)"
            active_plan.full_plan_json = data
            await db.commit()

    return DietRoutineDetailResponse(
        pet_id=pet_id,
        is_configured=True,
        overview=data.get("overview"),
        current_food=data.get("current_food") or active_plan.diet_type,
        amount_per_day=data.get("amount_per_day"),
        meals=data.get("meals"),
        morning_meal=data.get("morning_meal"),
        evening_meal=data.get("evening_meal"),
        snacks=data.get("snacks"),
        notes=data.get("notes"),
        custom_walks=data.get("custom_walks")
    )

@router.post("/adopt", response_model=List[MealScheduleItem])
async def adopt_diet_plan(
    payload: AdoptDietPlanRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DietPlan).where(DietPlan.id == payload.diet_plan_id)
    result = await db.execute(stmt)
    diet_plan = result.scalar_one_or_none()
    if not diet_plan:
        raise HTTPException(status_code=404, detail="Diet plan not found")

    await db.execute(
        update(DietPlan).where(DietPlan.pet_id == diet_plan.pet_id).values(is_active=False)
    )
    diet_plan.is_active = True

    stmt_existing = select(MealSchedule).where(MealSchedule.pet_id == diet_plan.pet_id)
    res_existing = await db.execute(stmt_existing)
    for old_s in res_existing.scalars().all():
        await db.delete(old_s)

    plan_json = diet_plan.full_plan_json
    meal_breakdown = plan_json.get("meal_breakdown", [])
    
    times = [time(8, 0), time(19, 30)]
    if len(meal_breakdown) == 3:
        times = [time(8, 0), time(13, 30), time(19, 30)]

    created_schedules = []
    for i, meal_info in enumerate(meal_breakdown):
        meal_time = times[i] if i < len(times) else time(12, 0)
        schedule = MealSchedule(
            pet_id=diet_plan.pet_id,
            diet_plan_id=diet_plan.id,
            schedule_type="ai",
            meal_time=meal_time,
            portion_size=f"{meal_info.get('portion_grams', 150)}g ({meal_info.get('portion_cups', '1 cup')})",
            notes=meal_info.get("ingredients", "Balanced Formula"),
            is_active=True
        )
        db.add(schedule)
        created_schedules.append(schedule)

    # Also synchronize DailyRoutineItems in database
    stmt_old_routines = select(DailyRoutineItem).where(DailyRoutineItem.pet_id == diet_plan.pet_id)
    res_old_routines = await db.execute(stmt_old_routines)
    for r in res_old_routines.scalars().all():
        await db.delete(r)

    overview_text = plan_json.get("overview") or f"Active AI diet plan ({diet_plan.diet_type})"
    food_name = plan_json.get("current_food") or diet_plan.diet_type
    notes_text = plan_json.get("notes") or "AI balanced nutrition plan"

    amt_str = plan_json.get("amount_per_day") or ""
    g_match = re.search(r"(\d+)\s*g", amt_str)
    half_desc = str(int(g_match.group(1)) // 2) if g_match else "350"
    plan_walks = plan_json.get("custom_walks") or diet_plan.custom_instructions

    routines_to_add = build_pet_routine_items(
        pet_id=diet_plan.pet_id,
        food_name=food_name,
        half_grams_or_desc=half_desc,
        overview_text=overview_text,
        notes_text=notes_text,
        custom_walks=plan_walks
    )
    for r in routines_to_add:
        db.add(r)

    await db.commit()
    for s in created_schedules:
        await db.refresh(s)

    return created_schedules

@router.get("/{pet_id}/current", response_model=Optional[DietPlanResponse])
async def get_current_diet_plan(
    pet_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(DietPlan)
        .where(DietPlan.pet_id == pet_id, DietPlan.is_active == True)
        .order_by(DietPlan.created_at.desc())
    )
    result = await db.execute(stmt)
    active_plan = result.scalars().first()
    if not active_plan:
        return None

    # Sanity check: Ensure calorie target is synchronized with pet's current weight
    stmt_pet = select(Pet).where(Pet.id == pet_id)
    res_pet = await db.execute(stmt_pet)
    pet = res_pet.scalar_one_or_none()
    if pet and pet.weight_kg:
        weight = float(pet.weight_kg)
        rer = 70.0 * (weight ** 0.75)
        # If target calories are impossibly low for this pet (under 85% RER, e.g. 720 kcal for 32kg),
        # recalculate based on pet's true weight and save
        if active_plan.target_calories_kcal < int(rer * 0.85):
            calc = calculate_target_calories(
                species=pet.species or "dog",
                weight_kg=weight,
                birth_date=pet.birth_date or (date.today() - timedelta(days=365 * 2)),
                is_neutered=bool(pet.is_neutered),
                diet_preset=active_plan.diet_type or ""
            )
            active_plan.target_calories_kcal = calc["target_der_kcal"]
            if isinstance(active_plan.full_plan_json, dict):
                p = dict(active_plan.full_plan_json)
                p["target_calories_kcal"] = calc["target_der_kcal"]
                p["weight_kg_used"] = weight
                p["amount_per_day"] = f"About {calc['total_food_grams_per_day']} g of food a day ({calc['target_der_kcal']} kcal)"
                active_plan.full_plan_json = p
            await db.commit()
            await db.refresh(active_plan)

    return active_plan

@router.get("/{pet_id}/schedules", response_model=List[MealScheduleItem])
async def get_meal_schedules(
    pet_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(MealSchedule).where(MealSchedule.pet_id == pet_id, MealSchedule.is_active == True)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/ingredient-safety", response_model=IngredientSafetyResponse)
async def check_ingredient_safety(
    payload: IngredientSafetyRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    AI Food Safety & Toxicity Radar:
    Evaluates whether an ingredient or food is safe, moderate, severe, or fatal for pets.
    Uses clinical veterinary toxicology knowledge and Google Gemini multimodal AI.
    """
    result = await qwen_hf_service.check_ingredient_safety(
        ingredient=payload.ingredient,
        species=payload.species or "dog"
    )
    return IngredientSafetyResponse(**result)

