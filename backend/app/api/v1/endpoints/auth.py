from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
try:
    from geoalchemy2.shape import from_shape
except ImportError:
    from_shape = lambda geom, srid=4326: None
from shapely.geometry import Point

from app.core.config import settings
from app.core.database import get_db
from app.core.security import generate_otp, store_otp, verify_otp, create_access_token, get_current_user_id
from app.models.profile import Profile
from app.schemas.auth import (
    RequestOTPRequest, RequestOTPResponse, VerifyOTPRequest, TokenResponse,
    GoogleAuthRequest, LocationUpdateRequest, LocationUpdateResponse, ProfileResponse,
    ProfileUpdateRequest
)
from app.services.geolocation import reverse_geocode, sanitize_fuzzy_location
from app.services.email_service import email_service
from app.services.storage import storage_service

router = APIRouter(prefix="/auth", tags=["Authentication & Profiles"])

@router.post("/request-otp", response_model=RequestOTPResponse)
async def request_otp(payload: RequestOTPRequest):
    """
    Step 1 of Passwordless Auth:
    User submits email -> generates 6-digit OTP stored in memory/Redis
    -> dispatches real email via SMTP / Resend (or dev console fallback).
    """
    otp = generate_otp()
    store_otp(payload.email, otp, ttl_minutes=10)
    
    dispatch_res = await email_service.send_otp_email(payload.email, otp)
    
    return RequestOTPResponse(
        message=dispatch_res.get("message", "OTP sent to your email address"),
        email=payload.email,
        expires_in_minutes=10,
        dispatch_mode=dispatch_res.get("mode", "email")
    )

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp_endpoint(payload: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    """
    Step 2 of Passwordless Auth:
    Validates OTP -> creates or retrieves user in PostgreSQL -> returns signed JWT token.
    """
    # Validate OTP strictly against stored code dispatched via email
    is_valid = verify_otp(payload.email, payload.otp)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please request a new code."
        )

    # Query or create user profile in PostgreSQL
    stmt = select(Profile).where(Profile.email == payload.email.lower())
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()

    if not profile:
        profile = Profile(
            email=payload.email.lower(),
            city="Detecting City...",
            is_first_time_parent=False
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    # Issue JWT token
    token = create_access_token({"sub": str(profile.id), "email": profile.email})

    return TokenResponse(
        access_token=token,
        user_id=str(profile.id),
        email=profile.email,
        full_name=profile.full_name,
        city=profile.city,
        area_neighborhood=profile.area_neighborhood,
        is_first_time_parent=profile.is_first_time_parent,
        gender=profile.gender,
        hobbies=profile.hobbies,
        vibe_routine=profile.vibe_routine,
        bio=profile.bio,
        household_mode=profile.household_mode or "solo",
        partner_name=profile.partner_name,
        partner_gender=profile.partner_gender,
        partner_hobbies=profile.partner_hobbies,
        partner_vibe=profile.partner_vibe,
        avatar_url=profile.avatar_url,
        partner_avatar_url=profile.partner_avatar_url
    )

@router.get("/google/login")
async def google_login(frontend_origin: Optional[str] = "http://localhost:5175"):
    """
    Directly navigates user to Google's Select Account / Consent screen.
    """
    import urllib.parse
    redirect_uri = settings.GOOGLE_REDIRECT_URI or "http://localhost:8000/api/v1/calendar/callback"
    scopes = [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/calendar.events"
    ]
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(scopes),
        "access_type": "offline",
        "prompt": "select_account",
        "state": frontend_origin or "http://localhost:5175"
    }
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=auth_url)

@router.get("/google/callback")
async def google_callback_endpoint(
    code: Optional[str] = None,
    state: Optional[str] = "http://localhost:5175",
    error: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Handles Google OAuth redirect after user selects account on accounts.google.com.
    """
    import urllib.parse
    frontend_base = state or "http://localhost:5175"
    if error or not code:
        return RedirectResponse(url=f"{frontend_base}/?google_auth_error={urllib.parse.quote(error or 'No authorization code received')}")

    try:
        import httpx
        from google.oauth2.credentials import Credentials
        from app.services.google_calendar_service import GoogleCalendarService

        redirect_uri = settings.GOOGLE_REDIRECT_URI or "http://localhost:8000/api/v1/calendar/callback"
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                }
            )
            if resp.status_code != 200:
                raise Exception(f"Google token exchange failed ({resp.status_code}): {resp.text}")
            token_info = resp.json()

        access_token = token_info.get("access_token")
        refresh_token = token_info.get("refresh_token")
        scopes = token_info.get("scope", "").split()

        creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=scopes
        )

        try:
            cal_service = GoogleCalendarService()
            cal_service.save_credentials(creds)
        except Exception as cal_err:
            print("[Google Calendar Save note]:", cal_err)

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            info = res.json() if res.status_code == 200 else {}

        email = info.get("email")
        full_name = info.get("name") or (email.split("@")[0].capitalize() if email else "Google Parent")

        if not email:
            return RedirectResponse(url=f"{frontend_base}/?google_auth_error=No email returned from Google")

        stmt = select(Profile).where(Profile.email == email.lower())
        res_db = await db.execute(stmt)
        profile = res_db.scalar_one_or_none()

        if not profile:
            profile = Profile(
                email=email.lower(),
                full_name=full_name,
                city="Detecting City...",
                is_first_time_parent=False
            )
            db.add(profile)
            await db.commit()
            await db.refresh(profile)
        else:
            if full_name and not profile.full_name:
                profile.full_name = full_name
                await db.commit()
                await db.refresh(profile)

        token = create_access_token({"sub": str(profile.id), "email": profile.email})

        redirect_target = (
            f"{frontend_base}/?google_auth=success"
            f"&token={token}"
            f"&email={urllib.parse.quote(profile.email)}"
            f"&name={urllib.parse.quote(profile.full_name or '')}"
        )
        return RedirectResponse(url=redirect_target)

    except Exception as e:
        print("[Google OAuth Callback Error]:", e)
        return RedirectResponse(url=f"{frontend_base}/?google_auth_error={urllib.parse.quote(str(e))}")

@router.post("/google", response_model=TokenResponse)
async def google_auth_endpoint(payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """
    1-Click Sign In / Sign Up with Google Account:
    - Accepts Google ID Token (from Google Identity Services / One-Tap)
    - OR exchanges OAuth authorization code
    - Automatically provisions / retrieves Profile in PostgreSQL
    - Returns signed HawPulse JWT session token
    """
    email = None
    full_name = None

    # Option A: Google ID Token verification
    if payload.id_token:
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests
            idinfo = id_token.verify_oauth2_token(
                payload.id_token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID or None
            )
            email = idinfo.get("email")
            full_name = idinfo.get("name")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid Google ID Token: {e}")

    # Option B: Authorization code exchange
    elif payload.code:
        try:
            import httpx
            red_uri = payload.redirect_uri or settings.GOOGLE_REDIRECT_URI or "http://localhost:8000/api/v1/calendar/callback"
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "code": payload.code,
                        "grant_type": "authorization_code",
                        "redirect_uri": red_uri,
                    }
                )
                if resp.status_code != 200:
                    raise Exception(f"Google token exchange failed ({resp.status_code}): {resp.text}")
                token_info = resp.json()

            access_token = token_info.get("access_token")

            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                if res.status_code == 200:
                    info = res.json()
                    email = info.get("email")
                    full_name = info.get("name")
                else:
                    raise HTTPException(status_code=400, detail="Failed to fetch Google user profile")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Google Code Exchange Error: {e}")
    else:
        raise HTTPException(status_code=400, detail="Must provide either 'id_token' or 'code'")

    if not email:
        raise HTTPException(status_code=400, detail="Could not retrieve verified email from Google account.")

    # Retrieve or create profile in PostgreSQL
    stmt = select(Profile).where(Profile.email == email.lower())
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()

    if not profile:
        profile = Profile(
            email=email.lower(),
            full_name=full_name or email.split("@")[0].capitalize(),
            city="Detecting City...",
            is_first_time_parent=False
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    else:
        if full_name and not profile.full_name:
            profile.full_name = full_name
            await db.commit()
            await db.refresh(profile)

    # Issue JWT session token
    token = create_access_token({"sub": str(profile.id), "email": profile.email})

    return TokenResponse(
        access_token=token,
        user_id=str(profile.id),
        email=profile.email,
        full_name=profile.full_name,
        city=profile.city,
        area_neighborhood=profile.area_neighborhood,
        is_first_time_parent=profile.is_first_time_parent,
        gender=profile.gender,
        hobbies=profile.hobbies,
        vibe_routine=profile.vibe_routine,
        bio=profile.bio,
        household_mode=profile.household_mode or "solo",
        partner_name=profile.partner_name,
        partner_gender=profile.partner_gender,
        partner_hobbies=profile.partner_hobbies,
        partner_vibe=profile.partner_vibe,
        avatar_url=profile.avatar_url,
        partner_avatar_url=profile.partner_avatar_url
    )

@router.get("/me", response_model=ProfileResponse)
async def get_current_profile(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Fetches authenticated profile details."""
    stmt = select(Profile).where(Profile.id == user_id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@router.put("/me", response_model=ProfileResponse)
async def update_current_profile(
    payload: ProfileUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Updates authenticated profile fields."""
    stmt = select(Profile).where(Profile.id == user_id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if payload.full_name is not None:
        profile.full_name = payload.full_name
    if payload.city is not None:
        profile.city = payload.city
    if payload.area_neighborhood is not None:
        profile.area_neighborhood = payload.area_neighborhood
    if payload.is_first_time_parent is not None:
        profile.is_first_time_parent = payload.is_first_time_parent
    if payload.gender is not None:
        profile.gender = payload.gender
    if payload.hobbies is not None:
        profile.hobbies = payload.hobbies
    if payload.vibe_routine is not None:
        profile.vibe_routine = payload.vibe_routine
    if payload.bio is not None:
        profile.bio = payload.bio
    if payload.household_mode is not None:
        profile.household_mode = payload.household_mode
    if payload.partner_name is not None:
        profile.partner_name = payload.partner_name
    if payload.partner_gender is not None:
        profile.partner_gender = payload.partner_gender
    if payload.partner_hobbies is not None:
        profile.partner_hobbies = payload.partner_hobbies
    if payload.partner_vibe is not None:
        profile.partner_vibe = payload.partner_vibe
    if payload.avatar_url is not None:
        profile.avatar_url = payload.avatar_url
    if payload.partner_avatar_url is not None:
        profile.partner_avatar_url = payload.partner_avatar_url

    await db.commit()
    await db.refresh(profile)
    return profile

@router.post("/me/photo", response_model=ProfileResponse)
async def upload_profile_photo(
    file: UploadFile = File(...),
    is_partner: bool = Form(False),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads a photo for the primary parent or co-parent, saving the image and updating avatar_url.
    """
    stmt = select(Profile).where(Profile.id == user_id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file submitted")

    photo_url = await storage_service.save_uploaded_file(content, file.filename or "profile_photo.jpg")
    if is_partner:
        profile.partner_avatar_url = photo_url
    else:
        profile.avatar_url = photo_url

    await db.commit()
    await db.refresh(profile)
    return profile

@router.post("/location", response_model=LocationUpdateResponse)
async def update_location(
    payload: LocationUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Ingests device coordinates (latitude, longitude):
    1. Reverse-geocodes into City & Neighborhood using OpenStreetMap Nominatim.
    2. Applies privacy fuzz sanitizer (never saving exact home pin).
    3. Persists location to PostGIS `location_geom`.
    """
    # 1. Reverse Geocode via OpenStreetMap
    geo_data = await reverse_geocode(payload.latitude, payload.longitude)
    
    # 2. Sanitize to fuzzy park/neighborhood coordinate
    fuzzy_lat, fuzzy_lon = sanitize_fuzzy_location(payload.latitude, payload.longitude)

    # 3. Update Profile in PostgreSQL
    stmt = select(Profile).where(Profile.id == user_id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile.city = geo_data["city"]
    profile.area_neighborhood = geo_data["area_neighborhood"]
    
    # PostGIS WKB Element: Point(longitude, latitude)
    point = Point(fuzzy_lon, fuzzy_lat)
    profile.location_geom = from_shape(point, srid=4326)

    await db.commit()

    return LocationUpdateResponse(
        city=profile.city,
        area_neighborhood=profile.area_neighborhood,
        latitude_fuzzy=fuzzy_lat,
        longitude_fuzzy=fuzzy_lon,
        message="Location successfully updated and privacy-protected."
    )


@router.post("/reverse-geocode", response_model=LocationUpdateResponse)
async def public_reverse_geocode(payload: LocationUpdateRequest):
    """
    Public reverse-geocoding for onboarding & guest discovery.
    Does NOT require authentication and does NOT log in or alter any profile.
    """
    geo_data = await reverse_geocode(payload.latitude, payload.longitude)
    fuzzy_lat, fuzzy_lon = sanitize_fuzzy_location(payload.latitude, payload.longitude)
    return LocationUpdateResponse(
        city=geo_data.get("city", "Local Area"),
        area_neighborhood=geo_data.get("area_neighborhood", ""),
        latitude_fuzzy=fuzzy_lat,
        longitude_fuzzy=fuzzy_lon,
        message="Location successfully resolved."
    )
