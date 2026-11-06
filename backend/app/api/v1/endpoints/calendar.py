import re
import urllib.parse
from typing import Optional, List
import httpx
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.profile import Profile
from app.core.security import create_access_token
from app.services.google_calendar_service import google_calendar_service
from app.schemas.calendar import (
    CalendarStatusResponse, ScheduleFeedingRequest,
    ScheduleFeedingResponse, ScheduledEventDetail,
    ScheduleVaccineRequest, ScheduleVaccineResponse
)

router = APIRouter(prefix="/calendar", tags=["Google Calendar Integration"])

@router.get("/status", response_model=CalendarStatusResponse)
async def get_calendar_status():
    """
    Returns the Google Calendar OAuth configuration and authorization status.
    """
    is_conf = google_calendar_service.is_configured()
    creds = google_calendar_service.load_credentials()
    is_conn = creds is not None and creds.valid
    conn_email = google_calendar_service.get_connected_email() if is_conn else None

    auth_url = None
    if is_conf:
        try:
            auth_url = google_calendar_service.get_authorization_url()
        except Exception:
            auth_url = None

    return CalendarStatusResponse(
        configured=is_conf,
        connected=is_conn,
        connected_email=conn_email,
        auth_url=auth_url
    )

@router.get("/callback")
async def google_calendar_oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Receives OAuth2 authorization code from Google:
    1. Robustly exchanges code for tokens.
    2. Persists calendar credentials for automated feeding & vaccine schedule sync.
    3. Retrieves authorized Google profile (email & name).
    4. Automatically provisions/retrieves user profile & generates session JWT.
    5. Redirects to HawPulse with active login and calendar connected!
    """
    frontend_base = "http://localhost:5175"
    if state and state.startswith("http"):
        # Strip trailing slash or path if just host
        frontend_base = state.rstrip("/")

    if error or not code:
        return HTMLResponse(
            f"<h3>Google Authorization Failed</h3><p>{error or 'No code provided.'}</p>"
            f"<p><a href='{frontend_base}'>Return to HawPulse</a></p>",
            status_code=400
        )

    try:
        # 1. Exchange code for credentials & save for Calendar
        creds = google_calendar_service.exchange_code_for_token(code)

        # 2. Fetch Google user info (email & name)
        email = None
        full_name = None
        if creds and creds.token:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {creds.token}"}
                    )
                    if resp.status_code == 200:
                        uinfo = resp.json()
                        email = uinfo.get("email")
                        full_name = uinfo.get("name")
            except Exception as e:
                print(f"[!] Warning: Failed to fetch userinfo from Google: {e}")

        # If userinfo didn't give email, fallback to calendar service connected email
        if not email:
            email = google_calendar_service.get_connected_email()

        token = None
        user_email = email or "parent@hawpulse.com"
        user_name = full_name or user_email.split("@")[0].capitalize()

        # 3. Create or fetch Profile in database & issue HawPulse JWT token
        if email:
            stmt = select(Profile).where(Profile.email == email.lower())
            res_db = await db.execute(stmt)
            profile = res_db.scalar_one_or_none()

            if not profile:
                profile = Profile(
                    email=email.lower(),
                    full_name=user_name,
                    city="Detecting City...",
                    is_first_time_parent=False
                )
                db.add(profile)
                await db.commit()
                await db.refresh(profile)
            else:
                if user_name and not profile.full_name:
                    profile.full_name = user_name
                    await db.commit()
                    await db.refresh(profile)

            token = create_access_token({"sub": str(profile.id), "email": profile.email})
            user_name = profile.full_name or user_name
            user_email = profile.email

        # 4. Determine redirect URL
        # If user specifically intended to connect Diet Lab Calendar:
        if state and "#diet-lab" in state:
            target = f"{frontend_base}/#diet-lab?calendar=connected"
            if token:
                target += f"&google_auth=success&token={token}&email={urllib.parse.quote(user_email)}&name={urllib.parse.quote(user_name)}"
            return RedirectResponse(url=target)

        # Otherwise (General Login / Continue with Google):
        if token:
            target = (
                f"{frontend_base}/?google_auth=success"
                f"&token={token}"
                f"&email={urllib.parse.quote(user_email)}"
                f"&name={urllib.parse.quote(user_name)}"
            )
            return RedirectResponse(url=target)

        return RedirectResponse(url=f"{frontend_base}/#diet-lab?calendar=connected")

    except Exception as e:
        print(f"[!] [Google Callback Error]: {e}")
        fresh_auth_url = None
        try:
            fresh_auth_url = google_calendar_service.get_authorization_url(state=state)
        except Exception:
            pass

        return HTMLResponse(
            f"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>HawPulse Google Authorization</title></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #faf9f6; padding: 40px 20px;">
                <div style="max-width: 520px; margin: 40px auto; background: white; padding: 36px; border: 2px solid #1c1b1a; border-radius: 24px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.06);">
                    <div style="font-size: 40px; margin-bottom: 12px;">🐾</div>
                    <h2 style="color: #1c1b1a; font-size: 20px; font-weight: 800; margin-bottom: 10px;">Google Authorization Session Expired</h2>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
                        That Google authorization code expired or was already exchanged. Click below to start a fresh connection directly:
                    </p>
                    {f'<a href="{fresh_auth_url}" style="display: inline-block; padding: 12px 24px; background: #1A73E8; color: white; border-radius: 9999px; text-decoration: none; font-weight: bold; font-size: 14px; margin-bottom: 16px;">Click Here to Connect Google Account</a>' if fresh_auth_url else ''}
                    <div>
                        <a href="{frontend_base}" style="color: #94a3b8; font-size: 13px; text-decoration: none; font-weight: 600;">← Return to HawPulse</a>
                    </div>
                </div>
            </body>
            </html>
            """,
            status_code=400
        )

@router.post("/disconnect")
async def disconnect_google_calendar():
    """
    Disconnects the current Google Calendar integration by removing stored credentials.
    """
    google_calendar_service.disconnect()
    return {"success": True, "message": "Google Calendar disconnected successfully"}

@router.get("/auth-url")
async def get_google_calendar_auth_url():
    """
    Returns the Google OAuth consent URL for connecting a Google Calendar account.
    """
    if not google_calendar_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Client ID and Secret are not configured in backend environment."
        )
    return {"auth_url": google_calendar_service.get_authorization_url()}

def _extract_time_or_default(text: Optional[str], default_time: str) -> str:
    if not text:
        return default_time
    # Look for patterns like "8:30 AM", "08:30", "7:30 PM", "19:30"
    match = re.search(r"(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)", text)
    if match:
        return match.group(1).strip()
    return default_time

def _extract_portion(text: Optional[str], default_portion: str) -> str:
    if not text:
        return default_portion
    # Look for ~120g or 120 g or 1 cup
    match = re.search(r"([~]?\d+\s*(?:g|grams|cups?|oz|ml))", text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return text.split(":")[0].strip() if ":" in text else default_portion

@router.post("/schedule-feeding", response_model=ScheduleFeedingResponse)
async def schedule_feeding_events(payload: ScheduleFeedingRequest):
    """
    Triggers automated Google Calendar scheduling for recurring daily feeding events:
    - Schedules Morning Feeding (e.g., 08:30 AM) with 10m advance popup notification
    - Schedules Evening Feeding (e.g., 07:30 PM) with 10m advance popup notification
    - Automatically syncs into authenticated user's primary Google Calendar (or provides 1-click fallback)
    """
    pet_name = payload.pet_name or "Cooper"
    food = payload.current_food or "Daily Nutrition Formula"
    
    # Resolve times
    m_time = payload.morning_time or _extract_time_or_default(payload.morning_meal, "08:30")
    e_time = payload.evening_time or _extract_time_or_default(payload.evening_meal, "19:30")
    
    # Resolve portions
    m_portion = _extract_portion(payload.morning_meal, "Balanced morning portion")
    e_portion = _extract_portion(payload.evening_meal, "Balanced evening portion")
    
    # Details & notes
    m_ingr = f"{food} • Portion: {m_portion}"
    if payload.notes:
        m_ingr += f"\nNotes: {payload.notes}"
    e_ingr = f"{food} • Portion: {e_portion}"
    if payload.notes:
        e_ingr += f"\nNotes: {payload.notes}"

    dur_days = payload.duration_days if payload.duration_days and payload.duration_days > 0 else 30

    # Schedule morning event
    res_m = google_calendar_service.schedule_daily_feeding(
        pet_name=pet_name,
        meal_label="Breakfast",
        portion=m_portion,
        ingredients=m_ingr,
        meal_time_str=m_time,
        user_timezone=payload.user_timezone,
        duration_days=dur_days
    )
    
    # Schedule evening event
    res_e = google_calendar_service.schedule_daily_feeding(
        pet_name=pet_name,
        meal_label="Dinner",
        portion=e_portion,
        ingredients=e_ingr,
        meal_time_str=e_time,
        user_timezone=payload.user_timezone,
        duration_days=dur_days
    )

    tz_used = res_m.get("timezone", payload.user_timezone or "UTC")
    mode = "live_google_calendar" if res_m.get("mode") == "live_google_calendar" else "1click_url"

    # Also compute 1-click fallback URLs
    from datetime import date
    today_str = date.today().isoformat()
    recurrence_str = f"DAILY;COUNT={dur_days}"
    fallback_m = google_calendar_service.generate_1click_calendar_url(
        title=f"🐾 {pet_name} Feeding Time: Breakfast",
        details=f"HawPulse Feeding Schedule ({dur_days}-Day Plan)\n• Pet: {pet_name}\n• Portion: {m_portion}\n• Food: {food}\n• Duration: {dur_days} days",
        start_date=today_str,
        start_time=m_time,
        duration_minutes=30,
        timezone=tz_used,
        recurrence=recurrence_str
    )
    fallback_e = google_calendar_service.generate_1click_calendar_url(
        title=f"🐾 {pet_name} Feeding Time: Dinner",
        details=f"HawPulse Feeding Schedule ({dur_days}-Day Plan)\n• Pet: {pet_name}\n• Portion: {e_portion}\n• Food: {food}\n• Duration: {dur_days} days",
        start_date=today_str,
        start_time=e_time,
        duration_minutes=30,
        timezone=tz_used,
        recurrence=recurrence_str
    )

    events: List[ScheduledEventDetail] = [
        ScheduledEventDetail(
            meal_label="Morning Breakfast",
            time=m_time,
            summary=res_m.get("summary", f"🐾 {pet_name} Feeding Time: Breakfast"),
            html_link=res_m.get("html_link", fallback_m),
            web_fallback_link=fallback_m,
            mode=res_m.get("mode", "1click_url"),
            event_id=res_m.get("event_id"),
            duration_days=dur_days
        ),
        ScheduledEventDetail(
            meal_label="Evening Dinner",
            time=e_time,
            summary=res_e.get("summary", f"🐾 {pet_name} Feeding Time: Dinner"),
            html_link=res_e.get("html_link", fallback_e),
            web_fallback_link=fallback_e,
            mode=res_e.get("mode", "1click_url"),
            event_id=res_e.get("event_id"),
            duration_days=dur_days
        )
    ]

    if mode == "live_google_calendar":
        msg = (
            f"Successfully scheduled daily feeding reminders in Google Calendar for {pet_name} "
            f"for {dur_days} days! Alarms active at {m_time} and {e_time} daily with 10-minute advance notifications."
        )
    else:
        msg = (
            f"Your Google account is not connected for background auto-sync yet. "
            f"Click 'Add to My Calendar (1-Click)' below for Breakfast & Dinner to save them to your account, "
            f"or connect your Google account above for automatic background sync."
        )

    return ScheduleFeedingResponse(
        success=True,
        mode=mode,
        message=msg,
        timezone=tz_used,
        duration_days=dur_days,
        events=events
    )

@router.post("/schedule-vaccine", response_model=ScheduleVaccineResponse)
async def schedule_vaccine_event(payload: ScheduleVaccineRequest):
    """
    Schedules vaccine booster appointment on the user's Google Calendar with 7-day and 1-day advance alarms.
    """
    res = google_calendar_service.schedule_vaccine_booster(
        pet_name=payload.pet_name,
        vaccine_name=payload.vaccine_name,
        due_date=payload.due_date,
        batch_number=payload.batch_number or "N/A",
        clinic_name=payload.clinic_name or "Veterinary Hospital"
    )
    return ScheduleVaccineResponse(
        success=True,
        mode=res.get("mode", "1click_url"),
        event_id=res.get("event_id"),
        html_link=res.get("html_link", ""),
        summary=res.get("summary", f"💉 {payload.pet_name}'s {payload.vaccine_name} Booster Due"),
        message=f"Vaccine reminder for {payload.pet_name} scheduled on {payload.due_date} with 7-day and 1-day alarms."
    )
