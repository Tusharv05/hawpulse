import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from datetime import date, timedelta
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.pet import Pet
from app.models.diet import DietPlan
from app.schemas.pet import PetCreate, PetUpdate, PetResponse
from app.services.storage import storage_service
from app.services.nutrition_engine import calculate_target_calories

router = APIRouter(prefix="/pets", tags=["Pet Profiles"])

@router.post("", response_model=PetResponse, status_code=status.HTTP_201_CREATED)
async def create_pet(
    payload: PetCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Registers a new pet profile under authenticated owner."""
    default_avatar = "/assets/defaults/default-cat.png" if payload.species.lower() == "cat" else "/assets/defaults/default-dog.png"
    pet = Pet(
        owner_id=uuid.UUID(user_id),
        name=payload.name,
        species=payload.species.lower(),
        gender=(payload.gender or "male").lower(),
        breed=payload.breed,
        birth_date=payload.birth_date,
        weight_kg=payload.weight_kg,
        allergies=payload.allergies,
        energy_level=payload.energy_level,
        play_style=payload.play_style,
        is_neutered=payload.is_neutered,
        vax_status=payload.vax_status,
        avatar_url=payload.avatar_url or default_avatar
    )
    db.add(pet)
    await db.commit()
    await db.refresh(pet)
    return pet

@router.get("", response_model=List[PetResponse])
async def list_my_pets(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Lists all registered pets belonging to current user."""
    stmt = select(Pet).where(Pet.owner_id == uuid.UUID(user_id)).order_by(Pet.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{pet_id}", response_model=PetResponse)
async def get_pet(
    pet_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Fetches details for a single pet."""
    stmt = select(Pet).where(Pet.id == pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    return pet

@router.put("/{pet_id}", response_model=PetResponse)
async def update_pet(
    pet_id: uuid.UUID,
    payload: PetUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Updates pet statistics (weight, allergies, vaccination status)."""
    stmt = select(Pet).where(Pet.id == pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ("species", "gender") and isinstance(value, str):
            value = value.lower()
        setattr(pet, field, value)

    # If weight, neutered status, species, or birth date changed, synchronize active diet plan
    if any(k in update_data for k in ("weight_kg", "is_neutered", "birth_date", "species")) and pet.weight_kg:
        stmt_plan = (
            select(DietPlan)
            .where(DietPlan.pet_id == pet.id, DietPlan.is_active == True)
            .order_by(DietPlan.created_at.desc())
        )
        res_plan = await db.execute(stmt_plan)
        active_plan = res_plan.scalars().first()
        if not active_plan:
            stmt_any = select(DietPlan).where(DietPlan.pet_id == pet.id).order_by(DietPlan.created_at.desc())
            res_any = await db.execute(stmt_any)
            active_plan = res_any.scalars().first()
            if active_plan:
                active_plan.is_active = True

        if active_plan:
            calc = calculate_target_calories(
                species=pet.species or "dog",
                weight_kg=float(pet.weight_kg),
                birth_date=pet.birth_date or (date.today() - timedelta(days=365 * 2)),
                is_neutered=bool(pet.is_neutered),
                diet_preset=active_plan.diet_type or ""
            )
            active_plan.target_calories_kcal = calc["target_der_kcal"]
            if isinstance(active_plan.full_plan_json, dict):
                p = dict(active_plan.full_plan_json)
                p["target_calories_kcal"] = calc["target_der_kcal"]
                p["weight_kg_used"] = float(pet.weight_kg)
                p["amount_per_day"] = f"About {calc['total_food_grams_per_day']} g of food a day ({calc['target_der_kcal']} kcal)"
                active_plan.full_plan_json = p

    await db.commit()
    await db.refresh(pet)
    return pet

@router.delete("/{pet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pet(
    pet_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Deletes a pet profile and cascades related records."""
    stmt = select(Pet).where(Pet.id == pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    await db.delete(pet)
    await db.commit()
    return None

@router.post("/{pet_id}/photos", response_model=PetResponse)
async def upload_pet_photo(
    pet_id: uuid.UUID,
    file: UploadFile = File(...),
    set_as_avatar: bool = Form(True),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads a photo for a pet, appends it to their gallery (photos array),
    and optionally sets it as their main avatar/profile picture.
    """
    stmt = select(Pet).where(Pet.id == pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file submitted")

    photo_url = await storage_service.save_uploaded_file(content, file.filename or "pet_photo.jpg")

    # Update pet photos list (creating a new list to trigger SQLAlchemy array change tracking)
    current_photos = list(pet.photos or [])
    if photo_url not in current_photos:
        current_photos.append(photo_url)
    pet.photos = current_photos

    if set_as_avatar or not pet.avatar_url:
        pet.avatar_url = photo_url

    await db.commit()
    await db.refresh(pet)
    return pet

@router.delete("/{pet_id}/photos", response_model=PetResponse)
async def delete_pet_photo(
    pet_id: uuid.UUID,
    photo_url: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Removes a photo from a pet's gallery."""
    stmt = select(Pet).where(Pet.id == pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    current_photos = list(pet.photos or [])
    if photo_url in current_photos:
        current_photos.remove(photo_url)
        pet.photos = current_photos
        if pet.avatar_url == photo_url:
            pet.avatar_url = current_photos[0] if current_photos else None
        await db.commit()
        await db.refresh(pet)

    return pet
