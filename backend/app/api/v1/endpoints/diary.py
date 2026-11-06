import uuid
import secrets
from datetime import datetime, timezone, timedelta, date, time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.pet import Pet
from app.models.profile import Profile
from app.models.diary import DiaryEvent, DailyRoutineItem, RoutineCompletion
from app.models.diet import MealSchedule
from app.schemas.diary import (
    DiaryLogCreate, DiaryEventResponse, DailyDiarySummaryResponse, SitterShareResponse,
    RoutineItemResponse, RoutineToggleResponse, UpNextResponse
)
from app.services.routine_service import sync_or_repair_pet_routines

router = APIRouter(prefix="/diary", tags=["Daily Activity Diary"])

# In-memory share token store for pet sitters (token -> pet_id)
_sitter_share_tokens: Dict[str, Dict[str, Any]] = {}

DEFAULT_ROUTINES = [
    {
        "title": "Morning walk · 7:30 AM · 30 mins",
        "time_str": "7:30 AM",
        "subtitle": "Active morning sniff walk & bathroom break",
        "category": "walk",
        "order_index": 1
    },
    {
        "title": "Breakfast · 8:30 AM · 450 g Kibble + pumpkin topper",
        "time_str": "8:30 AM",
        "subtitle": "Morning meal formulated for energy and digestion",
        "category": "feed",
        "order_index": 2
    },
    {
        "title": "Evening walk · 6:00 PM · 35 mins",
        "time_str": "6:00 PM",
        "subtitle": "Relaxed neighborhood stroll & social enrichment",
        "category": "walk",
        "order_index": 3
    },
    {
        "title": "Dinner · 7:30 PM · 450 g Kibble + joint supplement",
        "time_str": "7:30 PM",
        "subtitle": "Evening nutrition + mobility support",
        "category": "feed",
        "order_index": 4
    }
]

@router.post("/log", response_model=DiaryEventResponse, status_code=status.HTTP_201_CREATED)
async def log_activity(
    payload: DiaryLogCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    1-Tap Quick-Log Endpoint:
    Logs 'feed', 'walk', 'medication', 'water', 'poop', 'grooming', or 'note' with instant persistence.
    """
    stmt = select(Pet).where(Pet.id == payload.pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found or not owned by user")

    event = DiaryEvent(
        pet_id=payload.pet_id,
        event_type=payload.event_type,
        details=payload.details or {},
        notes=payload.notes,
        logged_by_sitter=payload.logged_by_sitter
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event

async def compute_pet_streak(db: AsyncSession, pet_id: uuid.UUID, now: datetime) -> int:
    """
    Computes accurate continuous daily active streak:
    - Returns 0 when no events have been logged today and none yesterday.
    - Counts consecutive active days if events were logged today or yesterday.
    """
    stmt_dates = select(func.date(DiaryEvent.logged_at)).where(
        DiaryEvent.pet_id == pet_id
    ).group_by(func.date(DiaryEvent.logged_at)).order_by(func.date(DiaryEvent.logged_at).desc())
    res_dates = await db.execute(stmt_dates)
    
    normalized_dates = set()
    for row in res_dates.all():
        val = row[0]
        if isinstance(val, str):
            try:
                normalized_dates.add(datetime.strptime(val[:10], "%Y-%m-%d").date())
            except Exception:
                pass
        elif isinstance(val, datetime):
            normalized_dates.add(val.date())
        elif isinstance(val, date):
            normalized_dates.add(val)

    today = now.date()
    yesterday = today - timedelta(days=1)

    streak = 0
    if today in normalized_dates:
        curr = today
        while curr in normalized_dates:
            streak += 1
            curr -= timedelta(days=1)
    elif yesterday in normalized_dates:
        curr = yesterday
        while curr in normalized_dates:
            streak += 1
            curr -= timedelta(days=1)

    return streak

@router.get("/{pet_id}/today", response_model=DailyDiarySummaryResponse)
async def get_today_timeline(
    pet_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns today's aggregated activity timeline and streak for the pet.
    """
    now = datetime.now(timezone.utc)
    start_of_day = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)

    # Fetch events for today
    stmt = select(DiaryEvent).where(
        DiaryEvent.pet_id == pet_id,
        DiaryEvent.logged_at >= start_of_day
    ).order_by(DiaryEvent.logged_at.desc())
    
    result = await db.execute(stmt)
    events = result.scalars().all()

    # Calculate counts
    feeds = sum(1 for e in events if e.event_type == "feed")
    walks = sum(1 for e in events if e.event_type == "walk")
    meds = sum(1 for e in events if e.event_type in ("medication", "meds"))

    # Calculate real continuous daily streak (accurate 0-state if no events)
    streak = await compute_pet_streak(db, pet_id, now)

    return DailyDiarySummaryResponse(
        pet_id=pet_id,
        date=now.strftime("%Y-%m-%d"),
        total_events=len(events),
        feed_count=feeds,
        walk_count=walks,
        medication_count=meds,
        streak_days=streak,
        timeline=events,
        events=events
    )

@router.get("/{pet_id}/routines", response_model=List[RoutineItemResponse])
async def get_pet_routines(
    pet_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns today's routine checklist for the pet, auto-seeding standard healthy routines if none exist.
    """
    # Clean up obsolete water items, separate walks dynamically, and sync routines
    routines = await sync_or_repair_pet_routines(db, pet_id)

    # Fetch today's completion records
    today_date = datetime.now(timezone.utc).date()
    stmt_comp = select(RoutineCompletion).where(
        RoutineCompletion.pet_id == pet_id,
        RoutineCompletion.completed_date == today_date
    )
    res_comp = await db.execute(stmt_comp)
    completions = {c.routine_id: c for c in res_comp.scalars().all()}

    output = []
    for r in routines:
        if r.category == "water" or "water" in (r.title or "").lower():
            continue
        comp = completions.get(r.id)
        is_done = comp is not None
        subtitle_text = r.subtitle
        if is_done:
            t_str = comp.completed_at.strftime("%I:%M %p").lstrip("0")
            subtitle_text = f"Done at {t_str} by {comp.completed_by}"

        output.append(RoutineItemResponse(
            id=r.id,
            pet_id=r.pet_id,
            title=r.title,
            subtitle=subtitle_text,
            time_str=r.time_str,
            category=r.category,
            order_index=r.order_index,
            done=is_done,
            completed_at=comp.completed_at if comp else None,
            completed_by=comp.completed_by if comp else None
        ))

    return output

@router.post("/routines/{routine_id}/toggle", response_model=RoutineToggleResponse)
async def toggle_pet_routine(
    routine_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Toggles completion state of a routine item for today and syncs a diary log entry.
    """
    stmt = select(DailyRoutineItem).where(DailyRoutineItem.id == routine_id)
    result = await db.execute(stmt)
    routine = result.scalar_one_or_none()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine item not found")

    # Get user display name
    user_name = "You"
    stmt_user = select(Profile).where(Profile.id == uuid.UUID(user_id))
    res_user = await db.execute(stmt_user)
    profile = res_user.scalar_one_or_none()
    if profile and profile.full_name:
        user_name = profile.full_name.split()[0]

    today_date = datetime.now(timezone.utc).date()
    stmt_comp = select(RoutineCompletion).where(
        RoutineCompletion.routine_id == routine_id,
        RoutineCompletion.completed_date == today_date
    )
    res_comp = await db.execute(stmt_comp)
    existing_comp = res_comp.scalar_one_or_none()

    if existing_comp:
        await db.delete(existing_comp)
        await db.commit()
        return RoutineToggleResponse(
            routine_id=routine_id,
            done=False,
            message=f"Marked undone: {routine.title.split('·')[0].strip()}"
        )
    else:
        new_comp = RoutineCompletion(
            routine_id=routine_id,
            pet_id=routine.pet_id,
            completed_date=today_date,
            completed_by=user_name
        )
        db.add(new_comp)

        # Log corresponding diary activity
        event_map = {
            "feed": "feed",
            "walk": "walk",
            "water": "water",
            "medication": "medication"
        }
        event_type = event_map.get(routine.category, "note")
        diary_log = DiaryEvent(
            pet_id=routine.pet_id,
            event_type=event_type,
            details={"routine_id": str(routine.id), "title": routine.title},
            notes=f"Routine completed: {routine.title.split('·')[0].strip()}",
            logged_by_sitter=False
        )
        db.add(diary_log)

        await db.commit()
        return RoutineToggleResponse(
            routine_id=routine_id,
            done=True,
            message=f"Marked done: {routine.title.split('·')[0].strip()}"
        )

@router.get("/{pet_id}/up-next", response_model=UpNextResponse)
async def get_up_next_event(
    pet_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Calculates the imminent upcoming daily care event (meal, walk, meds) based on routines & schedules.
    """
    routines = await get_pet_routines(pet_id=pet_id, user_id=user_id, db=db)
    
    # Find next uncompleted routine
    upcoming = next((r for r in routines if not r.done), None)
    
    if not upcoming:
        # If all completed, showcase evening meal or general rest
        return UpNextResponse(
            title="All Done for Today 🎉",
            time_str="Rest time",
            category="general",
            subtitle="All daily care tasks and routines are checked off!",
            due_in_text="Good job!",
            is_completed=True,
            portion_size=None
        )

    # Derive due in text
    time_str = upcoming.time_str or "7:30 PM"
    return UpNextResponse(
        id=upcoming.id,
        title=upcoming.title.split("·")[0].strip(),
        time_str=time_str,
        category=upcoming.category,
        subtitle=upcoming.subtitle or upcoming.title,
        due_in_text="Scheduled next",
        is_completed=False,
        portion_size="450 g Adult Salmon Kibble + topper" if upcoming.category == "feed" else None
    )

@router.post("/{pet_id}/share-token", response_model=SitterShareResponse)
async def create_sitter_share_token(
    pet_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Generates a secure, temporary read-only token for pet sitters (no login needed).
    """
    token = secrets.token_urlsafe(16)
    expires = datetime.now(timezone.utc) + timedelta(hours=72)
    _sitter_share_tokens[token] = {
        "pet_id": str(pet_id),
        "expires_at": expires
    }
    
    return SitterShareResponse(
        share_token=token,
        share_url=f"/shared/diary/{token}",
        expires_in_hours=72
    )

@router.get("/shared/{token}", response_model=DailyDiarySummaryResponse)
async def get_shared_sitter_timeline(token: str, db: AsyncSession = Depends(get_db)):
    """Public read-only timeline view for sitters holding a valid share token."""
    entry = _sitter_share_tokens.get(token)
    if not entry or datetime.now(timezone.utc) > entry["expires_at"]:
        raise HTTPException(status_code=404, detail="Invalid or expired sitter link")

    pet_id = uuid.UUID(entry["pet_id"])
    now = datetime.now(timezone.utc)
    start_of_day = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)

    stmt = select(DiaryEvent).where(
        DiaryEvent.pet_id == pet_id,
        DiaryEvent.logged_at >= start_of_day
    ).order_by(DiaryEvent.logged_at.desc())
    
    result = await db.execute(stmt)
    events = result.scalars().all()

    streak = await compute_pet_streak(db, pet_id, now)

    return DailyDiarySummaryResponse(
        pet_id=pet_id,
        date=now.strftime("%Y-%m-%d"),
        total_events=len(events),
        feed_count=sum(1 for e in events if e.event_type == "feed"),
        walk_count=sum(1 for e in events if e.event_type == "walk"),
        medication_count=sum(1 for e in events if e.event_type in ("medication", "meds")),
        streak_days=streak,
        timeline=events,
        events=events
    )
