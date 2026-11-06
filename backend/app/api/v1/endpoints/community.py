import uuid
from typing import List, Optional
from datetime import date, datetime, timezone
from math import radians, cos, sin, asin, sqrt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, delete
from sqlalchemy.exc import IntegrityError
try:
    from geoalchemy2.shape import from_shape, to_shape
except ImportError:
    from_shape = lambda geom, srid=4326: None
    to_shape = lambda geom: None
from shapely.geometry import Point

from app.core.database import get_db
from app.core.security import get_current_user_id, get_current_user_id_optional
from app.models.profile import Profile
from app.models.pet import Pet
from app.models.medical import Vaccination
from app.models.community import CommunityEvent, EventRSVP, PetSwipe, PetMatch, DirectMessage
from app.schemas.community import (
    NearbyPetResult, CommunityEventCreate, CommunityEventResponse,
    EventRSVPRequest, EventRSVPResponse,
    SwipeRequest, SwipeResponse, MatchResponse,
    SendMessageRequest, DirectMessageResponse,
    DiscoverPetResult
)

router = APIRouter(prefix="/community", tags=["Local Community & PostGIS Radar"])

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def format_pet_age(birth_date: Optional[date]) -> str:
    if not birth_date:
        return "2 yrs"
    today = date.today()
    months = (today.year - birth_date.year) * 12 + (today.month - birth_date.month)
    if months < 1:
        return "Puppy"
    elif months < 12:
        return f"{months} mos"
    elif months % 12 == 0:
        return f"{months // 12} yrs"
    else:
        return f"{round(months / 12, 1)} yrs"

def compute_distance_km(user_geom, prof_geom, user_profile: Optional[Profile], prof: Profile) -> float:
    # Attempt true spatial distance calculation
    if user_geom and prof_geom:
        try:
            u_pt = to_shape(user_geom)
            p_pt = to_shape(prof_geom)
            lon1, lat1, lon2, lat2 = map(radians, [u_pt.x, u_pt.y, p_pt.x, p_pt.y])
            dlon = lon2 - lon1
            dlat = lat2 - lat1
            a = sin(dlat / 2.0) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2.0) ** 2
            c = 2 * asin(sqrt(a))
            dist = round(6371 * c, 1)
            if 0.1 <= dist <= 100:
                return dist
        except Exception:
            pass

    # City & Neighborhood heuristic
    u_city = (user_profile.city or "").split(",")[0].strip().lower() if user_profile else ""
    p_city = (prof.city or "").split(",")[0].strip().lower()

    if u_city and p_city and (u_city in p_city or p_city in u_city):
        if prof.area_neighborhood and user_profile and user_profile.area_neighborhood:
            if prof.area_neighborhood.strip().lower() == user_profile.area_neighborhood.strip().lower():
                return 0.5
        return 1.2

    if prof.area_neighborhood and user_profile and user_profile.area_neighborhood:
        if prof.area_neighborhood.strip().lower() == user_profile.area_neighborhood.strip().lower():
            return 1.4

    return 3.2

def build_pet_tags(pet: Pet) -> List[str]:
    tags = []
    # Energy
    energy = (pet.energy_level or "high").lower()
    if energy in ("hyper", "high"):
        tags.append("⚡ High Energy")
    elif energy == "low":
        tags.append("🌿 Chill Temperament")
    else:
        tags.append("🏃 Athletic")

    # Play style
    ps = (pet.play_style or "").lower()
    if "ball" in ps or "fetch" in ps:
        tags.append("🎾 Ball Obsessed")
    elif "frisbee" in ps or "obstacle" in ps:
        tags.append("🥏 Frisbee Pro")
    elif "cafe" in ps or "sniff" in ps:
        tags.append("☕ Cafe Friendly")
    elif "trail" in ps:
        tags.append("🌳 Trail Lover")
    elif "scent" in ps or "hound" in ps:
        tags.append("👃 Scent Hound")
    elif "couch" in ps or "sunbeam" in ps:
        tags.append("🛋️ Couch Cuddler")
    else:
        tags.append("🐾 Park Regular")

    # Vaccine / Verified
    if pet.vax_status == "full":
        tags.append("💉 Vaccine Verified")
    elif pet.is_neutered:
        tags.append("✨ Neutered")
    else:
        tags.append("🩺 Health Checked")

    return tags

# -----------------------------------------------------------------------------
# 1. DISCOVER PETS (Community Cards & Browse Grid)
# -----------------------------------------------------------------------------
@router.get("/discover", response_model=List[DiscoverPetResult])
async def discover_community_pets(
    species: Optional[str] = Query(None),
    energy_level: Optional[str] = Query(None),
    radius_km: float = Query(50.0, ge=1.0, le=100.0),
    user_id: Optional[str] = Depends(get_current_user_id_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves real community pet profiles excluding the logged-in user's pets.
    Supports optional auth so guest / switching users can always discover community pets.
    Calculates proximity, age, formatted parent info, lifestyle details, and personality tags.
    Prioritizes real registered users in the same city at the very top of discovery!
    """
    uid = uuid.UUID(user_id) if user_id else None
    user_profile = None
    incoming_likes_pet_ids = set()
    incoming_likes_user_ids = set()

    already_swiped_pet_ids = set()
    if uid:
        user_profile = (await db.execute(select(Profile).where(Profile.id == uid))).scalar_one_or_none()
        my_pet_ids = (await db.execute(select(Pet.id).where(Pet.owner_id == uid))).scalars().all()
        
        # Swipes already sent by this user or their pets
        swiped_conds = [PetSwipe.sender_user_id == uid]
        if my_pet_ids:
            swiped_conds.append(PetSwipe.sender_pet_id.in_(my_pet_ids))
        stmt_swiped = select(PetSwipe.target_pet_id).where(or_(*swiped_conds))
        already_swiped_pet_ids = set((await db.execute(stmt_swiped)).scalars().all())

        if my_pet_ids:
            stmt_incoming = select(PetSwipe).where(
                or_(
                    PetSwipe.target_pet_id.in_(my_pet_ids),
                    PetSwipe.target_user_id == uid
                ),
                PetSwipe.action == "like"
            )
            incoming_likes = (await db.execute(stmt_incoming)).scalars().all()
            for s in incoming_likes:
                incoming_likes_pet_ids.add(s.sender_pet_id)
                incoming_likes_user_ids.add(s.sender_user_id)

    # Query all pets not owned by this user (or all community pets if not logged in)
    stmt = (
        select(Pet, Profile)
        .join(Profile, Pet.owner_id == Profile.id)
    )
    if uid:
        stmt = stmt.where(Profile.id != uid)
        if already_swiped_pet_ids:
            stmt = stmt.where(~Pet.id.in_(already_swiped_pet_ids))

    if species and species.lower() not in ("all", ""):
        stmt = stmt.where(func.lower(Pet.species) == species.lower())
    if energy_level and energy_level.lower() not in ("all", ""):
        stmt = stmt.where(func.lower(Pet.energy_level) == energy_level.lower())

    results = (await db.execute(stmt)).all()

    # Fallback images by species
    default_dog_img = "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80"
    default_cat_img = "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80"

    items_with_dist = []
    user_geom = user_profile.location_geom if user_profile else None

    for pet, prof in results:
        dist_km = compute_distance_km(user_geom, prof.location_geom, user_profile, prof)
        items_with_dist.append((pet, prof, dist_km))

    # Sort priority:
    # 0. Profiles that already liked the user's pet (mutual match opportunity!)
    # 1. Registered users in the same city
    # 2. Distance
    u_city = (user_profile.city or "").split(",")[0].strip().lower() if user_profile else ""

    def sort_score(entry):
        pet_el, prof_el, d = entry
        p_c = (prof_el.city or "").split(",")[0].strip().lower()
        same_c = 0 if (u_city and p_c and (u_city in p_c or p_c in u_city)) else 1
        has_liked = 0 if (pet_el.id in incoming_likes_pet_ids or prof_el.id in incoming_likes_user_ids) else 1
        return (has_liked, same_c, d)

    items_with_dist.sort(key=sort_score)

    discover_list = []
    for pet, prof, dist_km in items_with_dist:
        age_str = format_pet_age(pet.birth_date)

        # Image selection: if missing or default placeholder, use vibrant photo
        img = pet.avatar_url
        if not img or "/assets/defaults/" in img:
            if pet.photos and len(pet.photos) > 0 and "/assets/defaults/" not in pet.photos[0]:
                img = pet.photos[0]
            else:
                img = default_cat_img if pet.species.lower() == "cat" else default_dog_img

        photos = pet.photos if (pet.photos and len(pet.photos) > 0) else [img]

        # Clean parent display name
        if prof.household_mode == "couple" and prof.partner_name:
            p1 = prof.full_name or "Parent"
            parents_str = f"{p1} & {prof.partner_name}"
        elif prof.full_name and prof.full_name.strip():
            parents_str = prof.full_name.strip()
        else:
            raw_email_prefix = prof.email.split("@")[0]
            clean_name = "".join([c for c in raw_email_prefix if not c.isdigit()]).replace(".", " ").replace("_", " ").title().strip()
            parents_str = clean_name if len(clean_name) >= 2 else "Pet Parent"

        # Lifestyle & Bio
        mode_label = "Couple Registered" if prof.household_mode == "couple" else "Solo Parent"
        lifestyle_detail = prof.vibe_routine or prof.hobbies or "Neighborhood park wanderers & outdoor walkers"
        lifestyle_str = f"{mode_label} · {lifestyle_detail}"

        bio_str = prof.bio or f"Looking for friendly playmates! {pet.name} is a friendly and playful {pet.breed} who loves outdoor strolls and gentle socializing."

        tags = build_pet_tags(pet)
        city_clean = (prof.city or "Jalandhar").split(",")[0].strip()
        neighborhood_name = prof.area_neighborhood or city_clean or "Model Town"

        # Parent initials for avatar fallback badge
        clean_for_initials = parents_str.replace("&", " ").replace("·", " ")
        parts = [p for p in clean_for_initials.split() if p]
        if len(parts) >= 2:
            initials = f"{parts[0][0]}{parts[1][0]}".upper()
        elif len(parts) == 1:
            initials = parts[0][:2].upper()
        else:
            initials = "PP"

        has_liked = (pet.id in incoming_likes_pet_ids or prof.id in incoming_likes_user_ids)

        discover_list.append(DiscoverPetResult(
            id=pet.id,
            name=pet.name,
            age=age_str,
            breed=pet.breed,
            species=pet.species,
            energy_level=pet.energy_level or "moderate",
            play_style=pet.play_style or "Friendly",
            is_neutered=pet.is_neutered if pet.is_neutered is not None else False,
            vax_status=pet.vax_status or "full",
            image=img,
            photos=photos,
            distance_km=dist_km,
            distance_label=f"{neighborhood_name} · {dist_km} km away",
            parents=parents_str,
            lifestyle=lifestyle_str,
            bio=bio_str,
            tags=tags,
            owner_id=prof.id,
            owner_name=prof.full_name or parents_str,
            owner_avatar=prof.avatar_url,
            area_neighborhood=neighborhood_name,
            city=city_clean,
            household_mode=prof.household_mode or "solo",
            partner_name=prof.partner_name,
            vibe_routine=prof.vibe_routine,
            hobbies=prof.hobbies,
            is_verified_parent=True,
            owner_initials=initials,
            has_liked_you=has_liked
        ))

    # Filter by radius if enough pets exist within radius
    within_radius = [p for p in discover_list if p.distance_km <= radius_km]
    return within_radius if len(within_radius) > 0 else discover_list


# -----------------------------------------------------------------------------
# 2. RADAR (Spatial PostGIS queries)
# -----------------------------------------------------------------------------
@router.get("/radar", response_model=List[NearbyPetResult])
async def get_nearby_pet_radar(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    radius_km: float = Query(5.0, ge=0.5, le=50.0),
    energy_level: Optional[str] = Query(None),
    species: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Local Community PostGIS Radar:
    Executes spatial query ST_DWithin on PostGIS location_geom.
    """
    search_point = from_shape(Point(longitude, latitude), srid=4326)
    radius_meters = radius_km * 1000.0

    distance_expr = func.ST_Distance(Profile.location_geom, search_point)

    stmt = (
        select(
            Pet,
            Profile.area_neighborhood,
            distance_expr.label("distance_meters")
        )
        .join(Profile, Pet.owner_id == Profile.id)
        .where(
            Profile.id != uuid.UUID(user_id),
            Profile.location_geom.isnot(None),
            func.ST_DWithin(Profile.location_geom, search_point, radius_meters)
        )
    )

    if energy_level:
        stmt = stmt.where(Pet.energy_level == energy_level.lower())
    if species:
        stmt = stmt.where(Pet.species == species.lower())

    stmt = stmt.order_by("distance_meters").limit(30)
    result = await db.execute(stmt)
    rows = result.all()

    nearby_pets = []
    for pet, neighborhood, distance in rows:
        nearby_pets.append(NearbyPetResult(
            pet_id=pet.id,
            pet_name=pet.name,
            species=pet.species,
            breed=pet.breed,
            energy_level=pet.energy_level,
            play_style=pet.play_style,
            is_neutered=pet.is_neutered,
            vax_status=pet.vax_status,
            avatar_url=pet.avatar_url,
            photos=pet.photos or [],
            distance_meters=round(float(distance or 0), 1),
            fuzzy_neighborhood=neighborhood or "Local Park"
        ))

    return nearby_pets

# -----------------------------------------------------------------------------
# 3. COMMUNITY PACK WALKS & EVENTS
# -----------------------------------------------------------------------------
@router.post("/events", response_model=CommunityEventResponse, status_code=status.HTTP_201_CREATED)
async def create_community_event(
    payload: CommunityEventCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Creates a new Pack Walk or Group Meetup event anchored to a public park."""
    stmt_user = select(Profile).where(Profile.id == user_id)
    res_user = await db.execute(stmt_user)
    profile = res_user.scalar_one_or_none()

    event_point = from_shape(Point(payload.longitude, payload.latitude), srid=4326)

    event = CommunityEvent(
        creator_id=uuid.UUID(user_id),
        city=profile.city if profile else "Local City",
        title=payload.title,
        description=payload.description,
        location_name=payload.location_name,
        event_geom=event_point,
        event_time=payload.event_time,
        max_attendees=payload.max_attendees,
        requires_verified_vax=payload.requires_verified_vax
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    return CommunityEventResponse(
        id=event.id,
        creator_id=event.creator_id,
        city=event.city,
        title=event.title,
        description=event.description,
        location_name=event.location_name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        event_time=event.event_time,
        max_attendees=event.max_attendees,
        current_rsvps=0,
        requires_verified_vax=event.requires_verified_vax,
        created_at=event.created_at
    )

@router.get("/events", response_model=List[CommunityEventResponse])
async def list_community_events(
    city: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Lists upcoming community events and pack walks."""
    stmt = select(CommunityEvent).order_by(CommunityEvent.event_time.asc()).limit(20)
    result = await db.execute(stmt)
    events = result.scalars().all()

    output = []
    for ev in events:
        pt = to_shape(ev.event_geom) if ev.event_geom else Point(0, 0)
        
        # count rsvps
        stmt_count = select(func.count(EventRSVP.id)).where(EventRSVP.event_id == ev.id)
        rsvp_count = (await db.execute(stmt_count)).scalar() or 0

        output.append(CommunityEventResponse(
            id=ev.id,
            creator_id=ev.creator_id,
            city=ev.city,
            title=ev.title,
            description=ev.description,
            location_name=ev.location_name,
            latitude=pt.y,
            longitude=pt.x,
            event_time=ev.event_time,
            max_attendees=ev.max_attendees,
            current_rsvps=rsvp_count,
            requires_verified_vax=ev.requires_verified_vax,
            created_at=ev.created_at
        ))
    return output

@router.post("/events/{event_id}/rsvp", response_model=EventRSVPResponse)
async def rsvp_for_event(
    event_id: uuid.UUID,
    payload: EventRSVPRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """RSVP for event with optional vaccination verification gate."""
    stmt_ev = select(CommunityEvent).where(CommunityEvent.id == event_id)
    res_ev = await db.execute(stmt_ev)
    event = res_ev.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    stmt_pet = select(Pet).where(Pet.id == payload.pet_id, Pet.owner_id == uuid.UUID(user_id))
    res_pet = await db.execute(stmt_pet)
    pet = res_pet.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found or not owned by user")

    if event.requires_verified_vax and pet.vax_status != "full":
        stmt_vax = select(Vaccination).where(Vaccination.pet_id == pet.id, Vaccination.is_verified == True)
        res_vax = await db.execute(stmt_vax)
        if not res_vax.first():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"RSVP BLOCKED: '{event.title}' requires a Verified Vaccine Badge. "
                    f"Please upload {pet.name}'s vaccination card in the Medical Vault to join pack walks."
                )
            )

    stmt_rsvp = select(EventRSVP).where(EventRSVP.event_id == event_id, EventRSVP.pet_id == payload.pet_id)
    res_rsvp = await db.execute(stmt_rsvp)
    rsvp = res_rsvp.scalar_one_or_none()

    if rsvp:
        rsvp.status = payload.status
    else:
        rsvp = EventRSVP(
            event_id=event_id,
            pet_id=payload.pet_id,
            user_id=uuid.UUID(user_id),
            status=payload.status
        )
        db.add(rsvp)

    await db.commit()
    await db.refresh(rsvp)
    return rsvp

# -----------------------------------------------------------------------------
# 4. SWIPING, MATCHMAKING & DIRECT MESSAGING
# -----------------------------------------------------------------------------
@router.post("/swipe", response_model=SwipeResponse)
async def swipe_pet(
    payload: SwipeRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Like or Pass on a pet profile.
    Automatically assigns sender_pet to user's registered pet if not specified.
    Mutual likes trigger an immediate Playdate Match and setup mutual chat!
    """
    uid = uuid.UUID(user_id)

    # 1. Resolve user's active pet
    if payload.sender_pet_id:
        stmt_sender = select(Pet).where(Pet.id == payload.sender_pet_id, Pet.owner_id == uid)
    else:
        stmt_sender = select(Pet).where(Pet.owner_id == uid).order_by(Pet.created_at.asc()).limit(1)
    sender_pet = (await db.execute(stmt_sender)).scalar_one_or_none()

    if not sender_pet:
        user_prof = (await db.execute(select(Profile).where(Profile.id == uid))).scalar_one_or_none()
        if user_prof:
            default_pet = Pet(
                owner_id=uid,
                name="My Pet",
                species="dog",
                breed="Golden Retriever",
                energy_level="moderate",
                vax_status="full"
            )
            db.add(default_pet)
            await db.commit()
            await db.refresh(default_pet)
            sender_pet = default_pet
        else:
            return SwipeResponse(
                success=True,
                action=payload.action,
                is_match=False,
                match_id=None,
                message="Please create a pet profile to enable playdate matches."
            )

    # 2. Verify target pet exists
    stmt_target = select(Pet).where(Pet.id == payload.target_pet_id)
    target_pet = (await db.execute(stmt_target)).scalar_one_or_none()
    if not target_pet:
        raise HTTPException(status_code=404, detail="Target pet profile not found.")

    if target_pet.owner_id == uid:
        return SwipeResponse(
            success=True,
            action=payload.action,
            is_match=False,
            match_id=None,
            message="Previewed your own pet profile."
        )

    # 3. Upsert the swipe atomically
    stmt_existing = select(PetSwipe).where(
        PetSwipe.sender_pet_id == sender_pet.id,
        PetSwipe.target_pet_id == payload.target_pet_id
    )
    existing_swipe = (await db.execute(stmt_existing)).scalar_one_or_none()
    if existing_swipe:
        existing_swipe.action = payload.action
        existing_swipe.created_at = datetime.now(timezone.utc)
        await db.commit()
    else:
        try:
            new_swipe = PetSwipe(
                sender_pet_id=sender_pet.id,
                target_pet_id=payload.target_pet_id,
                sender_user_id=uid,
                target_user_id=target_pet.owner_id,
                action=payload.action
            )
            db.add(new_swipe)
            await db.commit()
        except IntegrityError:
            await db.rollback()
            # Handle race condition gracefully by updating the existing swipe
            stmt_retry = select(PetSwipe).where(
                PetSwipe.sender_pet_id == sender_pet.id,
                PetSwipe.target_pet_id == payload.target_pet_id
            )
            retry_swipe = (await db.execute(stmt_retry)).scalar_one_or_none()
            if retry_swipe:
                retry_swipe.action = payload.action
                retry_swipe.created_at = datetime.now(timezone.utc)
                await db.commit()

    # Canonical order for PetMatch pet IDs and user IDs
    p1_id, p2_id = (sender_pet.id, payload.target_pet_id) if str(sender_pet.id) < str(payload.target_pet_id) else (payload.target_pet_id, sender_pet.id)
    u1_id, u2_id = (uid, target_pet.owner_id) if p1_id == sender_pet.id else (target_pet.owner_id, uid)

    # 4. Handle Pass
    if payload.action == "pass":
        # If there was an existing active match, deactivate it
        stmt_match = select(PetMatch).where(PetMatch.pet1_id == p1_id, PetMatch.pet2_id == p2_id)
        existing_match = (await db.execute(stmt_match)).scalar_one_or_none()
        if existing_match and existing_match.is_active:
            existing_match.is_active = False
            await db.commit()

        return SwipeResponse(
            success=True,
            action=payload.action,
            is_match=False,
            match_id=None,
            message=f"Passed on {target_pet.name}."
        )

    # 5. Handle Like: A match ONLY happens when BOTH people like each other
    if payload.action == "like" and payload.simulate_reciprocal:
        stmt_rec = select(PetSwipe).where(
            PetSwipe.sender_pet_id == payload.target_pet_id,
            PetSwipe.target_pet_id == sender_pet.id
        )
        existing_rec = (await db.execute(stmt_rec)).scalar_one_or_none()
        if existing_rec:
            existing_rec.action = "like"
            existing_rec.created_at = datetime.now(timezone.utc)
            await db.commit()
        else:
            try:
                rec_swipe = PetSwipe(
                    sender_pet_id=payload.target_pet_id,
                    target_pet_id=sender_pet.id,
                    sender_user_id=target_pet.owner_id,
                    target_user_id=uid,
                    action="like"
                )
                db.add(rec_swipe)
                await db.commit()
            except IntegrityError:
                await db.rollback()
                stmt_retry_rec = select(PetSwipe).where(
                    PetSwipe.sender_pet_id == payload.target_pet_id,
                    PetSwipe.target_pet_id == sender_pet.id
                )
                retry_rec = (await db.execute(stmt_retry_rec)).scalar_one_or_none()
                if retry_rec:
                    retry_rec.action = "like"
                    retry_rec.created_at = datetime.now(timezone.utc)
                    await db.commit()

    # Check if reciprocal like exists from the target pet or target owner
    stmt_reciprocal = select(PetSwipe).where(
        PetSwipe.action == "like",
        or_(
            and_(PetSwipe.sender_pet_id == payload.target_pet_id, PetSwipe.target_pet_id == sender_pet.id),
            and_(PetSwipe.sender_user_id == target_pet.owner_id, PetSwipe.target_pet_id == sender_pet.id)
        )
    )
    reciprocal_swipe = (await db.execute(stmt_reciprocal)).scalar_one_or_none()

    if not reciprocal_swipe:
        # Only one person has liked so far — NO match until the other person likes back!
        return SwipeResponse(
            success=True,
            action=payload.action,
            is_match=False,
            match_id=None,
            message=f"Liked {target_pet.name}! When they like {sender_pet.name} back, it's a mutual match!"
        )

    # BOTH people like each other -> It's a Mutual Playdate Match!
    stmt_match = select(PetMatch).where(PetMatch.pet1_id == p1_id, PetMatch.pet2_id == p2_id)
    existing_match = (await db.execute(stmt_match)).scalar_one_or_none()

    if not existing_match:
        new_match = PetMatch(
            pet1_id=p1_id,
            pet2_id=p2_id,
            user1_id=u1_id,
            user2_id=u2_id,
            is_active=True
        )
        db.add(new_match)
        await db.commit()
        await db.refresh(new_match)
        match_id = new_match.id
    else:
        if not existing_match.is_active:
            existing_match.is_active = True
            await db.commit()
        match_id = existing_match.id

    return SwipeResponse(
        success=True,
        action=payload.action,
        is_match=True,
        match_id=match_id,
        message=f"🎉 Mutual Playdate Match! Both {sender_pet.name} and {target_pet.name} liked each other! You can now chat."
    )

@router.get("/liked-you", response_model=List[DiscoverPetResult])
async def list_profiles_that_liked_you(
    user_id: Optional[str] = Depends(get_current_user_id_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns all pet profiles whose owners or pets have swiped 'like' on the logged-in user's pet(s).
    """
    if not user_id:
        return []

    uid = uuid.UUID(user_id)
    user_profile = (await db.execute(select(Profile).where(Profile.id == uid))).scalar_one_or_none()
    user_geom = user_profile.location_geom if user_profile else None

    # Get all pet IDs owned by user
    my_pet_ids = (await db.execute(select(Pet.id).where(Pet.owner_id == uid))).scalars().all()
    if not my_pet_ids:
        return []

    # Get swipes where target is user's pet and action is 'like'
    stmt_incoming = select(PetSwipe).where(
        or_(
            PetSwipe.target_pet_id.in_(my_pet_ids),
            PetSwipe.target_user_id == uid
        ),
        PetSwipe.action == "like"
    )
    incoming_swipes = (await db.execute(stmt_incoming)).scalars().all()
    sender_pet_ids = list({s.sender_pet_id for s in incoming_swipes})
    if not sender_pet_ids:
        return []

    # Exclude pets that user has explicitly passed on or already liked/matched
    stmt_my_swipes = select(PetSwipe.target_pet_id).where(
        PetSwipe.sender_pet_id.in_(my_pet_ids),
        or_(PetSwipe.action == "pass", PetSwipe.action == "like")
    )
    swiped_pet_ids = set((await db.execute(stmt_my_swipes)).scalars().all())

    # Exclude pets where an active mutual match already exists
    stmt_matches = select(PetMatch).where(
        or_(
            PetMatch.pet1_id.in_(my_pet_ids),
            PetMatch.pet2_id.in_(my_pet_ids)
        ),
        PetMatch.is_active == True
    )
    active_matches = (await db.execute(stmt_matches)).scalars().all()
    matched_pet_ids = set()
    for m in active_matches:
        matched_pet_ids.add(m.pet1_id)
        matched_pet_ids.add(m.pet2_id)

    excluded_pet_ids = swiped_pet_ids.union(matched_pet_ids)
    valid_sender_pet_ids = [pid for pid in sender_pet_ids if pid not in excluded_pet_ids]
    if not valid_sender_pet_ids:
        return []

    # Query those pets & their owners
    stmt_pets = (
        select(Pet, Profile)
        .join(Profile, Pet.owner_id == Profile.id)
        .where(Pet.id.in_(valid_sender_pet_ids), Profile.id != uid)
    )
    results = (await db.execute(stmt_pets)).all()
    if not results:
        return []

    default_dog_img = "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80"
    default_cat_img = "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80"

    liked_list = []
    for pet, prof in results:
        dist_km = compute_distance_km(user_geom, prof.location_geom, user_profile, prof)
        age_str = format_pet_age(pet.birth_date)

        img = pet.avatar_url
        if not img or "/assets/defaults/" in img:
            if pet.photos and len(pet.photos) > 0 and "/assets/defaults/" not in pet.photos[0]:
                img = pet.photos[0]
            else:
                img = default_cat_img if pet.species.lower() == "cat" else default_dog_img

        photos = pet.photos if (pet.photos and len(pet.photos) > 0) else [img]

        if prof.household_mode == "couple" and prof.partner_name:
            p1 = prof.full_name or "Parent"
            parents_str = f"{p1} & {prof.partner_name}"
        elif prof.full_name and prof.full_name.strip():
            parents_str = prof.full_name.strip()
        else:
            raw_email_prefix = prof.email.split("@")[0]
            clean_name = "".join([c for c in raw_email_prefix if not c.isdigit()]).replace(".", " ").replace("_", " ").title().strip()
            parents_str = clean_name if len(clean_name) >= 2 else "Pet Parent"

        mode_label = "Couple Registered" if prof.household_mode == "couple" else "Solo Parent"
        lifestyle_detail = prof.vibe_routine or prof.hobbies or "Neighborhood park wanderers & outdoor walkers"
        lifestyle_str = f"{mode_label} · {lifestyle_detail}"
        bio_str = prof.bio or f"Looking for friendly playmates! {pet.name} is a friendly and playful {pet.breed} who loves outdoor strolls and gentle socializing."
        tags = build_pet_tags(pet)
        city_clean = (prof.city or "Jalandhar").split(",")[0].strip()
        neighborhood_name = prof.area_neighborhood or city_clean or "Model Town"

        clean_for_initials = parents_str.replace("&", " ").replace("·", " ")
        parts = [p for p in clean_for_initials.split() if p]
        initials = f"{parts[0][0]}{parts[1][0]}".upper() if len(parts) >= 2 else (parts[0][:2].upper() if len(parts) == 1 else "PP")

        liked_list.append(DiscoverPetResult(
            id=pet.id,
            name=pet.name,
            age=age_str,
            breed=pet.breed,
            species=pet.species,
            energy_level=pet.energy_level or "moderate",
            play_style=pet.play_style or "Friendly",
            is_neutered=pet.is_neutered if pet.is_neutered is not None else False,
            vax_status=pet.vax_status or "full",
            image=img,
            photos=photos,
            distance_km=dist_km,
            distance_label=f"{neighborhood_name} · {dist_km} km away",
            parents=parents_str,
            lifestyle=lifestyle_str,
            bio=bio_str,
            tags=tags,
            owner_id=prof.id,
            owner_name=prof.full_name or parents_str,
            owner_avatar=prof.avatar_url,
            area_neighborhood=neighborhood_name,
            city=city_clean,
            household_mode=prof.household_mode or "solo",
            partner_name=prof.partner_name,
            vibe_routine=prof.vibe_routine,
            hobbies=prof.hobbies,
            is_verified_parent=True,
            owner_initials=initials,
            has_liked_you=True,
            is_matched=False,
            match_id=None
        ))

    return liked_list

@router.get("/matches", response_model=List[MatchResponse])
async def list_my_matches(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Lists all mutual playdate matches for the current user's pets."""
    uid = uuid.UUID(user_id)
    stmt = (
        select(PetMatch)
        .where(or_(PetMatch.user1_id == uid, PetMatch.user2_id == uid), PetMatch.is_active == True)
        .order_by(PetMatch.created_at.desc())
    )
    matches = (await db.execute(stmt)).scalars().all()

    output = []
    for m in matches:
        other_pet_id = m.pet2_id if m.user1_id == uid else m.pet1_id
        other_user_id = m.user2_id if m.user1_id == uid else m.user1_id

        other_pet = (await db.execute(select(Pet).where(Pet.id == other_pet_id))).scalar_one_or_none()
        other_user = (await db.execute(select(Profile).where(Profile.id == other_user_id))).scalar_one_or_none()

        stmt_msg = (
            select(DirectMessage)
            .where(
                or_(
                    and_(DirectMessage.sender_id == uid, DirectMessage.recipient_id == other_user_id),
                    and_(DirectMessage.sender_id == other_user_id, DirectMessage.recipient_id == uid)
                )
            )
            .order_by(DirectMessage.created_at.desc())
            .limit(1)
        )
        latest_msg = (await db.execute(stmt_msg)).scalar_one_or_none()

        if other_pet and other_user:
            avatar = other_pet.avatar_url or (other_pet.photos[0] if other_pet.photos else "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80")
            has_conv = latest_msg is not None
            output.append(MatchResponse(
                match_id=m.id,
                matched_pet_id=other_pet.id,
                matched_pet_name=other_pet.name,
                matched_pet_breed=other_pet.breed,
                matched_pet_species=other_pet.species,
                matched_pet_energy=other_pet.energy_level,
                matched_pet_play_style=other_pet.play_style,
                matched_pet_avatar=avatar,
                matched_pet_photos=other_pet.photos or [avatar],
                owner_id=other_user.id,
                owner_name=other_user.full_name or other_user.email.split("@")[0],
                owner_neighborhood=other_user.area_neighborhood or other_user.city,
                matched_at=m.created_at,
                latest_message=latest_msg.content if latest_msg else None,
                has_conversation=has_conv
            ))

    return output

@router.post("/messages", response_model=DirectMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_direct_message(
    payload: SendMessageRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Sends a direct 1-on-1 message to a matched pet parent."""
    uid = uuid.UUID(user_id)
    if payload.recipient_id == uid:
        raise HTTPException(status_code=400, detail="Cannot send a message to yourself.")

    recipient = (await db.execute(select(Profile).where(Profile.id == payload.recipient_id))).scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient user not found.")

    msg = DirectMessage(
        match_id=payload.match_id,
        sender_id=uid,
        recipient_id=payload.recipient_id,
        content=payload.content.strip(),
        is_read=False
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    return msg

@router.get("/messages/{other_user_id}", response_model=List[DirectMessageResponse])
async def get_direct_messages(
    other_user_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves chronological chat conversation between current user and another pet parent."""
    uid = uuid.UUID(user_id)
    stmt = (
        select(DirectMessage)
        .where(
            or_(
                and_(DirectMessage.sender_id == uid, DirectMessage.recipient_id == other_user_id),
                and_(DirectMessage.sender_id == other_user_id, DirectMessage.recipient_id == uid)
            )
        )
        .order_by(DirectMessage.created_at.asc())
        .limit(100)
    )
    messages = (await db.execute(stmt)).scalars().all()

    # Mark unread messages as read
    changed = False
    for m in messages:
        if m.recipient_id == uid and not m.is_read:
            m.is_read = True
            changed = True
    if changed:
        await db.commit()

    return messages
