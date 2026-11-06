import os
import re
import json
import urllib.parse
from datetime import datetime, date, timedelta, time
from typing import Dict, Any, Optional, List, Tuple
from zoneinfo import ZoneInfo

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow  # type: ignore
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

from app.core.config import settings

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

class GoogleCalendarService:
    """
    Direct Google Calendar Integration for HawPulse:
    - Automated Background Sync via Google Calendar REST API (OAuth2)
    - Schedule Vaccine Boosters with advance popup alarms (7 days & 1 day prior)
    - Schedule Daily Recurring Feeding Times (RRULE:FREQ=DAILY)
    - Schedule Multi-Day Medication Schedules
    - Instant 1-Click Web Links (fallback)
    """

    def __init__(self):
        self.token_file = os.path.join(os.path.dirname(__file__), "..", "..", "calendar_token.json")
        self._flow: Optional[Flow] = None
        self._cached_timezone: Optional[str] = None

    @property
    def client_id(self) -> str:
        return os.environ.get("GOOGLE_CLIENT_ID") or settings.GOOGLE_CLIENT_ID or ""

    @property
    def client_secret(self) -> str:
        return os.environ.get("GOOGLE_CLIENT_SECRET") or settings.GOOGLE_CLIENT_SECRET or ""

    @property
    def redirect_uri(self) -> str:
        return os.environ.get("GOOGLE_REDIRECT_URI") or settings.GOOGLE_REDIRECT_URI or "http://localhost:8000/api/v1/calendar/callback"

    def is_configured(self) -> bool:
        """Returns True if Google Client ID and Secret are configured."""
        return bool(self.client_id.strip() and self.client_secret.strip())

    def get_client_config(self) -> Dict[str, Any]:
        """Builds OAuth2 client configuration dictionary."""
        return {
            "web": {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [self.redirect_uri]
            }
        }

    def get_authorization_url(self, state: Optional[str] = None) -> str:
        """Generates the Google OAuth2 consent URL for the user to grant calendar access."""
        flow = Flow.from_client_config(
            self.get_client_config(),
            scopes=SCOPES,
            redirect_uri=self.redirect_uri,
            autogenerate_code_verifier=False
        )
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
            state=state
        )
        return auth_url

    def exchange_code_for_token(self, auth_code: str) -> Credentials:
        """Exchanges authorization code for access and refresh tokens using server client_secret."""
        import requests
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": auth_code,
            "grant_type": "authorization_code",
            "redirect_uri": self.redirect_uri,
        }
        resp = requests.post("https://oauth2.googleapis.com/token", data=data, timeout=15)
        if resp.status_code != 200:
            raise Exception(f"Google token exchange failed ({resp.status_code}): {resp.text}")
        
        token_info = resp.json()
        access_token = token_info.get("access_token")
        refresh_token = token_info.get("refresh_token")
        
        existing_creds = self.load_credentials()
        if not refresh_token and existing_creds and existing_creds.refresh_token:
            refresh_token = existing_creds.refresh_token
            
        scopes = token_info.get("scope", "").split() if token_info.get("scope") else SCOPES
        creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=scopes
        )
        self.save_credentials(creds)
        return creds

    def save_credentials(self, creds: Credentials):
        """Persists user credentials to calendar_token.json."""
        token_data = {
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": creds.scopes
        }
        with open(self.token_file, "w") as f:
            json.dump(token_data, f)

    def load_credentials(self) -> Optional[Credentials]:
        """Loads and refreshes saved credentials."""
        if not os.path.exists(self.token_file):
            return None

        try:
            with open(self.token_file, "r") as f:
                data = json.load(f)
            creds = Credentials.from_authorized_user_info(data, SCOPES)
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
                self.save_credentials(creds)
            return creds
        except Exception as e:
            print(f"[!] [Google Calendar Token Load Error: {e}]")
            return None

    def get_connected_email(self) -> Optional[str]:
        """Returns the email address of the currently authorized Google account."""
        service = self.get_calendar_service()
        if not service:
            return None
        try:
            res = service.events().list(calendarId="primary", maxResults=1).execute()
            items = res.get("items", [])
            if items:
                organizer = items[0].get("organizer", {})
                if organizer.get("email"):
                    return organizer.get("email")
            cal = service.calendars().get(calendarId="primary").execute()
            return cal.get("id") or cal.get("summary")
        except Exception:
            return None

    def disconnect(self) -> bool:
        """Removes the stored token file to allow connecting a new Google account."""
        try:
            if os.path.exists(self.token_file):
                os.remove(self.token_file)
            return True
        except Exception as e:
            print(f"[!] [Google Calendar Token Remove Error: {e}]")
            return False

    def authenticate_interactive(self) -> Optional[Credentials]:
        """
        Runs an automated local OAuth loopback server on port 8000 to authorize
        Google Calendar without manual copy-pasting.
        """
        import webbrowser
        from http.server import HTTPServer, BaseHTTPRequestHandler
        from urllib.parse import urlparse, parse_qs

        auth_code_holder = []

        class OAuthCallbackHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                query = urlparse(self.path).query
                params = parse_qs(query)
                if "code" in params:
                    auth_code_holder.append(params["code"][0])
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.end_headers()
                    html = (
                        "<html><body style='font-family:sans-serif;text-align:center;padding:50px;'>"
                        "<h1 style='color:#16a34a;'>✅ HawPulse Google Calendar Connected!</h1>"
                        "<p>Authorization successful. You can close this window and return to your terminal.</p>"
                        "</body></html>"
                    )
                    self.wfile.write(html.encode("utf-8"))
                else:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"No code provided.")

            def log_message(self, format, *args):
                pass  # Suppress default server logs

        auth_url = self.get_authorization_url()
        print(f"\n[*] Launching browser for Google Calendar authorization...")
        print(f"👉 URL: {auth_url}\n")
        try:
            webbrowser.open(auth_url)
        except Exception:
            pass

        server = None
        try:
            server = HTTPServer(("localhost", 8000), OAuthCallbackHandler)
            server.timeout = 60.0
            print("[*] Waiting for authorization in browser (timeout: 60s)...")
            while not auth_code_holder:
                server.handle_request()
        except Exception as e:
            print(f"[!] Local loopback listener notice: {e}")
        finally:
            if server:
                server.server_close()

        if auth_code_holder:
            try:
                creds = self.exchange_code_for_token(auth_code_holder[0])
                return creds
            except Exception as e:
                print(f"[!] Token exchange error: {e}")

        from cli import safe_input
        code = safe_input("Paste the code or full redirect URL from browser: ", "").strip()
        if "code=" in code:
            code = parse_qs(urlparse(code).query).get("code", [code])[0]
        if code:
            try:
                return self.exchange_code_for_token(code)
            except Exception as e:
                print(f"[!] Token exchange error: {e}")
        return None

    def get_calendar_service(self) -> Optional[Any]:
        """Builds authorized Google Calendar API v3 service."""
        creds = self.load_credentials()
        if not creds or not creds.valid:
            return None
        return build("calendar", "v3", credentials=creds)

    # =========================================================================
    # HIGH-LEVEL EVENT SCHEDULERS
    # =========================================================================

    def schedule_vaccine_booster(
        self,
        pet_name: str,
        vaccine_name: str,
        due_date: str,
        batch_number: str = "N/A",
        clinic_name: str = "Veterinary Hospital"
    ) -> Dict[str, Any]:
        """
        Schedules a vaccine booster appointment on the user's Google Calendar.
        Automatically attaches 2 alarms: 7 days before and 1 day before.
        """
        service = self.get_calendar_service()
        
        event_body = {
            "summary": f"💉 {pet_name}'s {vaccine_name} Booster Due",
            "description": (
                f"🐾 HawPulse Medical Vault Reminder\n\n"
                f"Patient: {pet_name}\n"
                f"Vaccine: {vaccine_name}\n"
                f"Lot/Batch: {batch_number}\n"
                f"Scheduled Clinic: {clinic_name}\n\n"
                "🛡️ Timely booster administration maintains public dog park safe walk approval."
            ),
            "start": {
                "date": due_date,
            },
            "end": {
                "date": due_date,
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 7 * 24 * 60},  # 7 days before
                    {"method": "popup", "minutes": 24 * 60},       # 1 day before
                    {"method": "email", "minutes": 24 * 60}        # 1 day before email
                ]
            }
        }

        if service:
            try:
                created = service.events().insert(calendarId="primary", body=event_body).execute()
                return {
                    "success": True,
                    "mode": "live_google_calendar",
                    "event_id": created.get("id"),
                    "html_link": created.get("htmlLink"),
                    "summary": event_body["summary"]
                }
            except Exception as e:
                print(f"[!] [Google Calendar API Error: {e}]")

        # 1-Click Web Fallback Link
        web_link = self.generate_1click_calendar_url(
            title=event_body["summary"],
            details=event_body["description"],
            start_date=due_date
        )
        return {
            "success": True,
            "mode": "1click_url",
            "html_link": web_link,
            "summary": event_body["summary"]
        }

    def resolve_timezone(self, service: Optional[Any] = None, user_timezone: Optional[str] = None) -> str:
        """
        Dynamically resolves the user's IANA timezone worldwide:
        1. If user_timezone is explicitly provided (e.g. from frontend / profile), validate and use it.
        2. Else, query the authenticated user's primary Google Calendar timezone via Google Calendar API.
        3. Else, detect host / local system timezone using tzlocal.
        4. Fallback to 'UTC' if unrecognized.
        """
        # 1. Explicit timezone requested (e.g. 'America/New_York', 'Europe/London', 'Asia/Tokyo', etc.)
        if user_timezone and str(user_timezone).strip():
            tz_candidate = str(user_timezone).strip()
            try:
                ZoneInfo(tz_candidate)
                return tz_candidate
            except Exception:
                pass

        # 2. Check cached calendar timezone
        if hasattr(self, "_cached_timezone") and self._cached_timezone:
            return self._cached_timezone

        # 3. Query Google Calendar primary calendar metadata
        if service:
            try:
                cal_meta = service.events().list(calendarId="primary", maxResults=1).execute()
                cal_tz = cal_meta.get("timeZone")
                if cal_tz:
                    ZoneInfo(cal_tz)
                    self._cached_timezone = cal_tz
                    return cal_tz
            except Exception:
                pass

        # 4. Detect local system timezone via tzlocal
        try:
            import tzlocal
            tz = tzlocal.get_localzone_name()
            if tz:
                ZoneInfo(tz)
                return tz
        except Exception:
            pass

        return "UTC"

    @staticmethod
    def _parse_hm(time_str: str) -> Tuple[int, int]:
        """Safely parses time strings like '08:30', '8:30 AM', '19:30', '7:30 PM' into (hour, minute)."""
        s = str(time_str or "08:00").strip().upper()
        is_pm = "PM" in s
        is_am = "AM" in s
        clean = re.sub(r"[^\d:]", "", s)
        if ":" in clean:
            parts = clean.split(":")
            h = int(parts[0]) if parts[0] else 8
            m = int(parts[1]) if len(parts) > 1 and parts[1] else 0
        else:
            h = int(clean) if clean else 8
            m = 0
        if is_pm and h < 12:
            h += 12
        elif is_am and h == 12:
            h = 0
        return h % 24, m % 60

    def schedule_daily_feeding(
        self,
        pet_name: str,
        meal_label: str,
        portion: str,
        ingredients: str,
        meal_time_str: str = "08:00",
        user_timezone: Optional[str] = None,
        duration_days: int = 30
    ) -> Dict[str, Any]:
        """
        Schedules a daily recurring feeding event catering to any timezone in the world.
        Default recurrence is for 30 days (RRULE:FREQ=DAILY;COUNT=30), or customized by duration_days.
        """
        service = self.get_calendar_service()
        today = date.today()
        h, m = self._parse_hm(meal_time_str)

        # Resolve worldwide timezone (User-specified -> Google Calendar user setting -> System -> UTC)
        tz_name = self.resolve_timezone(service=service, user_timezone=user_timezone)
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = ZoneInfo("UTC")
            tz_name = "UTC"

        start_dt = datetime.combine(today, time(h, m), tzinfo=tz)
        end_dt = start_dt + timedelta(minutes=30)

        # Build RFC 5545 recurrence rule with specified duration (default: 30 days)
        duration_clean = int(duration_days) if duration_days and int(duration_days) > 0 else 30
        rrule = f"RRULE:FREQ=DAILY;COUNT={duration_clean}"

        event_body = {
            "summary": f"🐾 {pet_name} Feeding Time: {meal_label}",
            "description": (
                f"HawPulse Dual-Mode Feeding Schedule ({duration_clean}-Day Plan)\n\n"
                f"• Pet: {pet_name}\n"
                f"• Target Portion: {portion}\n"
                f"• Meal Formula: {ingredients}\n"
                f"• Duration: {duration_clean} days (daily recurrence)\n"
                f"• Timezone: {tz_name}\n\n"
                "Log your feeding in the HawPulse Diary to track daily caloric progress."
            ),
            "start": {
                "dateTime": start_dt.isoformat(),
                "timeZone": tz_name,
            },
            "end": {
                "dateTime": end_dt.isoformat(),
                "timeZone": tz_name,
            },
            "recurrence": [
                rrule
            ],
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 10}
                ]
            }
        }

        if service:
            try:
                created = service.events().insert(calendarId="primary", body=event_body).execute()
                return {
                    "success": True,
                    "mode": "live_google_calendar",
                    "event_id": created.get("id"),
                    "html_link": created.get("htmlLink"),
                    "summary": event_body["summary"],
                    "timezone": tz_name,
                    "duration_days": duration_clean
                }
            except Exception as e:
                print(f"[!] [Google Calendar API Error: {e}]")

        web_link = self.generate_1click_calendar_url(
            title=event_body["summary"],
            details=event_body["description"],
            start_date=today.isoformat(),
            start_time=meal_time_str,
            duration_minutes=30,
            timezone=tz_name,
            recurrence=f"DAILY;COUNT={duration_clean}"
        )
        return {
            "success": True,
            "mode": "1click_url",
            "html_link": web_link,
            "summary": event_body["summary"],
            "timezone": tz_name,
            "duration_days": duration_clean
        }

    @staticmethod
    def generate_1click_calendar_url(
        title: str,
        details: str,
        start_date: str,
        start_time: Optional[str] = None,
        duration_minutes: int = 30,
        timezone: Optional[str] = None,
        recurrence: Optional[str] = None
    ) -> str:
        """Generates an instant 1-click Google Calendar web link with universal worldwide timezone support."""
        clean_date = start_date.replace("-", "")
        if start_time:
            h, m = GoogleCalendarService._parse_hm(start_time)
            clean_start = f"{clean_date}T{h:02d}{m:02d}00"
            end_minutes = (h * 60 + m + duration_minutes) % 1440
            end_h = end_minutes // 60
            end_m = end_minutes % 60
            clean_end = f"{clean_date}T{end_h:02d}{end_m:02d}00"
            dates_param = f"{clean_start}/{clean_end}"
        else:
            # All day format: YYYYMMDD/YYYYMMDD
            dates_param = f"{clean_date}/{clean_date}"
        
        base_url = "https://calendar.google.com/calendar/render"
        params = {
            "action": "TEMPLATE",
            "text": title,
            "details": details,
            "dates": dates_param
        }
        if timezone:
            params["ctz"] = timezone
        if recurrence:
            if recurrence.startswith("RRULE:"):
                params["recur"] = recurrence
            elif recurrence.startswith("FREQ="):
                params["recur"] = f"RRULE:{recurrence}"
            else:
                params["recur"] = f"RRULE:FREQ={recurrence}"

        return f"{base_url}?{urllib.parse.urlencode(params)}"

# Global Singleton
google_calendar_service = GoogleCalendarService()
