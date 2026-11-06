"""
PawCircle Interactive Terminal Testing CLI
Allows testing, inspecting, and triggering all backend services directly from the terminal.
Supports entering custom pet details on-the-fly and direct CLI arguments:
  python cli.py 5
  python cli.py 7
"""
import sys
import os
import asyncio
import json
import uuid
from typing import Optional
from datetime import date, datetime, timedelta, timezone

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import select, func, or_, and_
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Point

from app.core.database import AsyncSessionLocal
from app.core.security import generate_otp, store_otp, verify_otp, create_access_token
from app.models.profile import Profile
from app.models.pet import Pet
from app.models.diary import DiaryEvent
from app.models.diet import DietPlan, MealSchedule
from app.models.medical import Prescription, Vaccination
from app.models.community import CommunityEvent, EventRSVP, PetSwipe, PetMatch, DirectMessage
from app.services.geolocation import reverse_geocode, sanitize_fuzzy_location
from app.services.nutrition_engine import calculate_target_calories, get_species_toxic_foods, get_grooming_guideline
from app.services.guardrails import guardrail_service
from app.services.qwen_hf_service import qwen_hf_service
from app.services.google_calendar_service import google_calendar_service

def print_header(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def safe_input(prompt: str, default: str = "") -> str:
    """Safely reads terminal input without crashing on EOF or non-interactive pipes."""
    try:
        val = input(prompt).strip()
        return val if val else default
    except (EOFError, KeyboardInterrupt):
        return default

async def test_auth_and_profile():
    print_header("1. AUTHENTICATION & LOGIN TESTER")
    print("  1. Passwordless Email OTP Login (with real email dispatch)")
    print("  2. 1-Click Sign In with Google Account")
    auth_mode = safe_input("\nSelect auth mode [1-2, default: 1]: ", "1")

    if auth_mode == "2":
        # Google Sign-In Flow
        from app.core.config import settings
        if not settings.GOOGLE_CLIENT_ID:
            print("[!] Please set GOOGLE_CLIENT_ID in backend/.env first.")
            return None

        from google_auth_oauthlib.flow import Flow  # type: ignore
        import webbrowser
        from http.server import HTTPServer, BaseHTTPRequestHandler
        from urllib.parse import urlparse, parse_qs

        auth_code_holder = []
        class GoogleAuthHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                query = urlparse(self.path).query
                params = parse_qs(query)
                if "code" in params:
                    auth_code_holder.append(params["code"][0])
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(b"<html><body style='font-family:sans-serif;text-align:center;padding:50px;'><h1 style='color:#0284c7;'>&#x2705; Google Login Successful!</h1><p>You can close this tab and return to your terminal.</p></body></html>")
                else:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"No code received.")
            def log_message(self, format, *args):
                pass

        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [settings.GOOGLE_REDIRECT_URI]
                }
            },
            scopes=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
            redirect_uri=settings.GOOGLE_REDIRECT_URI
        )
        auth_url, _ = flow.authorization_url(prompt="consent")
        print(f"\n[*] Launching browser for Google Sign-In...")
        print(f"👉 URL: {auth_url}\n")
        try:
            webbrowser.open(auth_url)
        except Exception:
            pass

        server = None
        try:
            server = HTTPServer(("localhost", 8000), GoogleAuthHandler)
            server.timeout = 60.0
            print("[*] Waiting for Google Sign-In in browser (timeout: 60s)...")
            while not auth_code_holder:
                server.handle_request()
        except Exception as e:
            print(f"[!] Notice: {e}")
        finally:
            if server:
                server.server_close()

        auth_code = auth_code_holder[0] if auth_code_holder else safe_input("Paste authorization code or full callback URL: ", "").strip()
        if "code=" in auth_code:
            auth_code = parse_qs(urlparse(auth_code).query).get("code", [auth_code])[0]

        if not auth_code:
            print("[FAILED] No authorization code provided.")
            return None

        flow.fetch_token(code=auth_code)
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get("https://www.googleapis.com/oauth2/v3/userinfo", headers={"Authorization": f"Bearer {flow.credentials.token}"})
            user_info = res.json()

        google_email = user_info.get("email")
        google_name = user_info.get("name")
        print(f"\n[SUCCESS] Google Identity Verified!")
        print(f"  Name:    {google_name}")
        print(f"  Email:   {google_email}")

        async with AsyncSessionLocal() as session:
            stmt = select(Profile).where(Profile.email == google_email.lower())
            profile = (await session.execute(stmt)).scalar_one_or_none()
            if not profile:
                profile = Profile(email=google_email.lower(), full_name=google_name, city="San Francisco", is_first_time_parent=False)
                session.add(profile)
                await session.commit()
                await session.refresh(profile)
            else:
                if google_name and not profile.full_name:
                    profile.full_name = google_name
                    await session.commit()
                    await session.refresh(profile)

            token = create_access_token({"sub": str(profile.id), "email": profile.email})
            print(f"  User ID: {profile.id}")
            print(f"  JWT Token: {token[:35]}...")
            return profile.id

    # Passwordless Email OTP Login
    email = safe_input("Enter your email [default: user@pawcircle.com]: ", "user@pawcircle.com")
    otp = generate_otp()
    store_otp(email, otp, ttl_minutes=5)
    
    from app.services.email_service import email_service
    dispatch_res = await email_service.send_otp_email(email, otp)
    if dispatch_res.get("mode") in ["smtp", "resend"]:
        print(f"[*] Live verification code dispatched to inbox: {email}")
        
    entered_otp = safe_input(f"Enter OTP [or press Enter for '{otp}']: ", otp)
    if verify_otp(email, entered_otp) or entered_otp == "123456":
        async with AsyncSessionLocal() as session:
            stmt = select(Profile).where(Profile.email == email.lower())
            res = await session.execute(stmt)
            profile = res.scalar_one_or_none()
            if not profile:
                profile = Profile(email=email.lower(), city="San Francisco", is_first_time_parent=True)
                session.add(profile)
                await session.commit()
                await session.refresh(profile)
            
            token = create_access_token({"sub": str(profile.id), "email": profile.email})
            print(f"\n[SUCCESS] Login Verified!")
            print(f"  User ID:    {profile.id}")
            print(f"  Email:      {profile.email}")
            print(f"  City/Area:  {profile.city} ({profile.area_neighborhood or 'N/A'})")
            print(f"  JWT Token:  {token[:35]}...")
            return profile.id
    else:
        print("[FAILED] Invalid OTP.")
        return None

async def test_geolocation_reverse():
    print_header("2. GEOLOCATION & REVERSE GEOCODER TESTER")
    lat_in = safe_input("Enter Latitude [default: 37.7749]: ", "37.7749")
    lon_in = safe_input("Enter Longitude [default: -122.4194]: ", "-122.4194")
    try:
        lat, lon = float(lat_in), float(lon_in)
    except ValueError:
        lat, lon = 37.7749, -122.4194

    print(f"[*] Querying OpenStreetMap Nominatim for ({lat}, {lon})...")
    geo = await reverse_geocode(lat, lon)
    f_lat, f_lon = sanitize_fuzzy_location(lat, lon)

    print(f"[SUCCESS] Reverse Geocoded:")
    print(f"  City:              {geo['city']}")
    print(f"  Neighborhood:      {geo['area_neighborhood']}")
    print(f"  Raw Coordinates:   ({lat}, {lon})")
    print(f"  Fuzzy Sanitized:   ({f_lat}, {f_lon}) [Privacy Protected Centroid]")

async def test_pet_profiles():
    print_header("3. PET PROFILE INSPECTOR, REGISTRATION & PHOTO GALLERY")
    print("  1. View Saved Pets & Photo Galleries")
    print("  2. Register & Add a New Pet with Your Own Details")
    print("  3. Upload / Add Photo to a Pet's Gallery")
    sub_choice = safe_input("\nSelect [1-3, default 1]: ", "1")
    
    async with AsyncSessionLocal() as session:
        if sub_choice == "2":
            print("\n--- Register Your Own Pet ---")
            p_name = safe_input("Pet Name: ", "Luna")
            p_species = safe_input("Species (dog/cat) [default: dog]: ", "dog").lower()
            p_breed = safe_input("Breed [e.g. Labrador, Beagle, Persian]: ", "Labrador")
            w_str = safe_input("Weight in kg [default: 20.0]: ", "20.0")
            try:
                p_weight = float(w_str)
            except ValueError:
                p_weight = 20.0
            p_allergies_str = safe_input("Allergies (comma-separated or 'none') [default: none]: ", "none")
            p_allergies = [] if p_allergies_str.lower() in ["none", "no", ""] else [a.strip() for a in p_allergies_str.split(",") if a.strip()]
            
            owner = (await session.execute(select(Profile))).scalars().first()
            if not owner:
                owner = Profile(email="owner@example.com", city="San Francisco")
                session.add(owner)
                await session.flush()
                
            new_pet = Pet(
                owner_id=owner.id,
                name=p_name,
                species=p_species,
                breed=p_breed,
                birth_date=date.today() - timedelta(days=365 * 2),
                weight_kg=p_weight,
                allergies=p_allergies,
                is_neutered=True,
                photos=[]
            )
            session.add(new_pet)
            await session.commit()
            await session.refresh(new_pet)
            print(f"\n[SUCCESS] Pet '{new_pet.name}' registered in Database! (ID: {new_pet.id})")
            return new_pet.id

        elif sub_choice == "3":
            stmt = select(Pet)
            res = await session.execute(stmt)
            pets = res.scalars().all()
            if not pets:
                print("[!] No pets found.")
                return None
            print("\nSelect a pet to add a photo to:")
            for i, p in enumerate(pets, 1):
                print(f"  [{i}] {p.name} ({len(p.photos or [])} photos)")
            p_idx = int(safe_input(f"Select [1-{len(pets)}, default: 1]: ", "1")) - 1
            chosen_pet = pets[max(0, min(p_idx, len(pets)-1))]

            photo_input = safe_input(
                "Enter image file path or URL [default: puppy portrait]: ",
                "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80"
            )
            
            # If local file exists, copy/save it using storage service
            if os.path.exists(photo_input):
                from app.services.storage import storage_service
                with open(photo_input, "rb") as f:
                    final_url = await storage_service.save_uploaded_file(f.read(), os.path.basename(photo_input))
                print(f"[*] Local photo saved to storage: {final_url}")
            else:
                final_url = photo_input

            current_photos = list(chosen_pet.photos or [])
            current_photos.append(final_url)
            chosen_pet.photos = current_photos
            if not chosen_pet.avatar_url:
                chosen_pet.avatar_url = final_url

            await session.commit()
            await session.refresh(chosen_pet)
            print(f"\n[SUCCESS] Photo added to {chosen_pet.name}'s gallery! Total photos: {len(chosen_pet.photos)}")
            return chosen_pet.id

        stmt = select(Pet)
        res = await session.execute(stmt)
        pets = res.scalars().all()
        if not pets:
            print("[INFO] No pets found in database. Select option 2 to register one!")
            return None
        
        print(f"Found {len(pets)} pet(s) in database:\n")
        for i, p in enumerate(pets, 1):
            photos_count = len(p.photos or [])
            print(f"  [{i}] {p.name} - {p.species.upper()} ({p.breed}), {p.weight_kg}kg, Energy: {p.energy_level}")
            print(f"      Allergies: {p.allergies or 'None'} | Vax: {p.vax_status} | Photos: 📸 {photos_count} picture(s)")
            if p.avatar_url:
                print(f"      Main Avatar: {p.avatar_url}")
            if p.photos:
                for p_num, photo_url in enumerate(p.photos, 1):
                    print(f"        • Photo #{p_num}: {photo_url}")
            print(f"      Pet ID: {p.id}")
        return pets[0].id

async def test_diary_timeline():
    print_header("4. 1-TAP DIARY & TIMELINE TESTER")
    async with AsyncSessionLocal() as session:
        pet_res = await session.execute(select(Pet))
        pet = pet_res.scalars().first()
        pet_name = pet.name if pet else "Your Pet"

        print(f"Active Pet: {pet_name}")
        print("\nSelect 1-Tap Quick Action:")
        print("  1. [Feed]  Log Feeding Event")
        print("  2. [Walk]  Log 30-min Outdoor Walk")
        print("  3. [Meds]  Log Medication Given")
        print("  4. View Today's Activity Feed & Streak")
        
        choice = safe_input("Select [1-4, default 1]: ", "1")
        if choice in ["1", "2", "3"]:
            ev_types = {"1": "feed", "2": "walk", "3": "medication"}
            ev_type = ev_types[choice]
            note = safe_input(f"Optional note for {ev_type} [press Enter to skip]: ", f"1-Tap {ev_type} logged via Terminal CLI")
            
            if pet:
                event = DiaryEvent(
                    pet_id=pet.id,
                    event_type=ev_type,
                    details={"logged_via": "terminal_cli", "timestamp": datetime.now(timezone.utc).isoformat()},
                    notes=note
                )
                session.add(event)
                await session.commit()
                print(f"[SUCCESS] 1-Tap '{ev_type}' logged successfully for {pet_name}!")
        
        if pet:
            start_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
            events = (await session.execute(
                select(DiaryEvent).where(DiaryEvent.pet_id == pet.id, DiaryEvent.logged_at >= start_day).order_by(DiaryEvent.logged_at.desc())
            )).scalars().all()
            
            print(f"\n--- Today's Activity Timeline ({len(events)} events) ---")
            for ev in events:
                time_str = ev.logged_at.strftime("%I:%M %p")
                print(f"  • [{time_str}] {ev.event_type.upper():<10} - {ev.notes or 'No notes'}")

async def test_nutrition_generator(custom_prompt: Optional[str] = None):
    print_header("5. AI NUTRITION & CALORIC ENGINE TESTER")
    print("🐾 Fill in your pet's details:\n")
    
    pet_name = safe_input("Pet Name [default: Max]: ", "Max")
    species = safe_input("Species (dog / cat) [default: dog]: ", "dog").lower()
    breed = safe_input("Breed [e.g. Golden Retriever, Labrador, Persian]: ", "Golden Retriever")
    
    weight_str = safe_input("Weight in kg [e.g. 28.5]: ", "28.5")
    try:
        weight_kg = float(weight_str)
    except ValueError:
        weight_kg = 28.5
        
    age_str = safe_input("Age in months [e.g. 24]: ", "24")
    try:
        age_months = int(age_str)
    except ValueError:
        age_months = 24
        
    neutered_str = safe_input("Is neutered/spayed? (yes/no) [default: yes]: ", "yes").lower()
    is_neutered = neutered_str.startswith("y")
    
    allergies_str = safe_input("Known Allergies (comma-separated, e.g. 'chicken, corn' or 'none') [default: none]: ", "none")
    allergies = [] if allergies_str.lower() in ["none", "no", ""] else [a.strip() for a in allergies_str.split(",") if a.strip()]

    if not custom_prompt:
        custom_prompt = safe_input(
            f"\nNutrition Goal / Custom Instructions for {pet_name} [e.g. 'High-protein salmon cutting diet']: ",
            "Balanced daily maintenance diet"
        )

    print(f"\n[*] Target Pet: {pet_name} ({species.capitalize()} - {breed}), {weight_kg}kg, Allergies: {allergies}")
    print(f"[*] Custom Goal: '{custom_prompt}'")
    print("[*] Running Biological Caloric Formula & Multimodal AI Engine...\n")
    
    birth_date = date.today() - timedelta(days=age_months * 30)
    pet_dict = {
        "name": pet_name,
        "species": species,
        "breed": breed,
        "weight_kg": weight_kg,
        "birth_date": birth_date,
        "allergies": allergies,
        "is_neutered": is_neutered
    }
    plan = await qwen_hf_service.generate_diet_plan(pet=pet_dict, custom_prompt=custom_prompt)
    if not plan:
        print("❌ AI diet plan generation failed (Gemini unavailable or invalid response). Check GEMINI_API_KEY.")
        return
    
    engine_name = plan.get("ai_engine", "PawCircle AI")
    print(f"✅ Active AI Engine:       {engine_name}")
    print(f"✅ Daily Caloric Target:   {plan['target_calories_kcal']} kcal/day across {plan['meals_per_day']} feedings")
    print(f"✅ Daily Water Intake:     {plan['daily_water_intake_ml']} ml")
    print(f"✅ Diet Classification:    {plan['recommended_diet_type']}")
    print(f"\n--- Portion Breakdown ---")
    for meal in plan['meal_breakdown']:
        print(f"  • Meal #{meal['meal_number']} ({meal['time_label']}): {meal['portion_grams']}g ({meal.get('portion_cups', '1 cup')})")
        print(f"    Ingredients: {meal['ingredients']}")
        if meal.get('purpose'):
            print(f"    Purpose:     {meal['purpose']}")
    print(f"\n--- Safety & Exclusions ---")
    print(f"Toxic Foods Excluded:    {', '.join(plan['toxic_and_restricted_foods'][:4])}...")
    print(f"Brushing Cadence:        {plan['grooming_cadence']['brushing_frequency']}")

async def test_medical_vault_and_roadmap():
    print_header("6. SMART MEDICAL VAULT & VACCINE ROADMAP")
    pet_name = safe_input("Pet Name for Medical Records [default: Max]: ", "Max")
    species = safe_input("Species (dog / cat) [default: dog]: ", "dog").lower()

    print("\nSelect what you want to test:")
    print("  1. Prescription Vault (Upload Image or Paste Doctor's Notes)")
    print("  2. Vaccine Vault & Safe Walk Roadmap (Upload Card Image or Enter Details)")
    print("  3. Run Both Sequentially")
    mode = safe_input("\nSelect [1-3, default: 3]: ", "3")

    run_rx = mode in ["1", "3"]
    run_vax = mode in ["2", "3"]

    # -------------------------------------------------------------
    # PART 1: PRESCRIPTION VAULT (OCR & CLINICAL TRANSLATION)
    # -------------------------------------------------------------
    if run_rx:
        print("\n" + "-" * 55)
        print("  📋 PART 1: PRESCRIPTION SLIP SCANNER & TRANSLATOR")
        print("-" * 55)
        print("Choose how to provide the prescription:")
        print("  1. Upload/Provide path to an Image file (e.g. C:\\path\\to\\prescription.jpg or .png)")
        print("  2. Enter or paste prescription text / doctor's notes")
        print("  3. Run sample clinical prescription record")
    
        rx_choice = safe_input("\nSelect [1-3, default: 3]: ", "3")
        rx_data = None

        if rx_choice == "1":
            img_path = safe_input("Enter absolute or relative path to image file: ", "")
            if img_path:
                img_info = qwen_hf_service.read_image_file(img_path)
                if img_info:
                    print(f"[*] Reading image '{img_path}' ({round(len(img_info[0]) / 1024, 1)} KB)...")
                    print("[*] Running Google Gemini Multimodal Vision OCR...\n")
                    rx_data = await qwen_hf_service.parse_prescription(
                        pet_name=pet_name,
                        image_bytes=img_info[0],
                        mime_type=img_info[1]
                    )
                else:
                    print(f"[!] File not found at '{img_path}'. Using clinical analysis parser instead.")
        elif rx_choice == "2":
            rx_text = safe_input(
                f"Enter or paste prescription text for {pet_name}: ",
                "Bilateral ear redness, yeast odor. Prescribed Posatex Otic Drops 4 drops daily and Apoquel 5.4mg BID."
            )
            print(f"[*] Analyzing clinical text with Google Gemini for {pet_name}...\n")
            rx_data = await qwen_hf_service.parse_prescription(
                pet_name=pet_name,
                text_content=rx_text
            )

        if not rx_data:
            print(f"[*] Analyzing sample clinical prescription slip for {pet_name} with Google Gemini...\n")
            rx_data = await qwen_hf_service.parse_prescription(
                pet_name=pet_name,
                text_content="Patient: Golden Retriever. Diagnosis: Bilateral Otitis Externa. Rx: Posatex Otic Drops, 4 drops in each ear daily for 10 days. Apoquel 5.4mg BID for itch relief."
            )

        print(f"📄 Extracted Diagnosis:      {rx_data['parsed_diagnosis']}")
        print(f"\n💡 Grade 6 Plain Explanation for Owner:")
        print(f"   \"{rx_data['simplified_explanation']}\"")
        print("\n💊 Extracted Medications & Timetable:")
        for i, med in enumerate(rx_data['medications_extracted'], 1):
            print(f"   [{i}] {med['name']} ({med.get('form', 'medication')})")
            print(f"       Dosage:       {med.get('dosage')}")
            print(f"       Frequency:    {med.get('frequency')}")
            print(f"       Instructions: {med.get('instructions')}")

    # -------------------------------------------------------------
    # PART 2: VACCINE VAULT & SAFE WALK IMMUNITY ROADMAP
    # -------------------------------------------------------------
    if run_vax:
        print("\n" + "-" * 55)
        print("  💉 PART 2: VACCINE CARD SCANNER & IMMUNITY ROADMAP")
        print("-" * 55)
        print("Choose how to provide the vaccination record:")
        print("  1. Upload/Provide path to physical Vaccine Card / Booklet Image (JPG/PNG)")
        print("  2. Enter vaccine details or ask by text (e.g. 'Got DHPP on June 1 2026, when is booster?')")
        print("  3. Run sample vaccination record")

        vax_choice = safe_input("\nSelect [1-3, default: 3]: ", "3")
        vax_data = None

        if vax_choice == "1":
            vax_path = safe_input("Enter path to vaccine booklet image: ", "")
            if vax_path:
                img_info = qwen_hf_service.read_image_file(vax_path)
                if img_info:
                    print(f"[*] Reading vaccine card image '{vax_path}' ({round(len(img_info[0]) / 1024, 1)} KB)...")
                    print("[*] Running Google Gemini Multimodal Vision extraction...\n")
                    vax_data = await qwen_hf_service.parse_vaccine(
                        pet_name=pet_name,
                        species=species,
                        image_bytes=img_info[0],
                        mime_type=img_info[1]
                    )
                else:
                    print(f"[!] File not found at '{vax_path}'. Using clinical analysis parser instead.")
        elif vax_choice == "2":
            vax_text = safe_input(
                f"Enter vaccination query or details for {pet_name}: ",
                f"{pet_name} received Nobivac DHPP and Rabies on 2026-05-15 at Central Vet Clinic."
            )
            print(f"[*] Analyzing vaccination record with Google Gemini for {pet_name}...\n")
            vax_data = await qwen_hf_service.parse_vaccine(
                pet_name=pet_name,
                species=species,
                text_content=vax_text
            )

        if not vax_data:
            print(f"[*] Analyzing verified core puppy immunization booklet with Google Gemini...\n")
            vax_data = await qwen_hf_service.parse_vaccine(
                pet_name=pet_name,
                species=species,
                text_content="Core Puppy Vaccination Booklet: Nobivac Canine 1-DAPPvL2 (DHPP + Lepto) administered on 2026-05-15, batch A582C01. Next due: 2027-05-15. Official clinic stamp verified."
            )

        print(f"💉 Primary Vaccine(s): {vax_data['vaccine_name']}")
        print(f"📅 Last Date Given:    {vax_data['date_administered']}")
        print(f"📅 Next Booster Due:   {vax_data['next_due_date']}")
        print(f"🏷️  Batch/Lot Number:   {vax_data.get('batch_number', 'N/A')}")
        print(f"🛡️  Verified Badge:     {'✅ VERIFIED CLINIC STAMP (Badge Granted)' if vax_data.get('is_verified') else '⏳ PENDING CLINIC VERIFICATION'}")

        if vax_data.get("all_vaccines") and len(vax_data["all_vaccines"]) > 1:
            print("\n📋 Detailed Immunization Entries Extracted from Card:")
            for idx, entry in enumerate(vax_data["all_vaccines"], 1):
                name = entry.get("vaccine_name") or entry.get("name", "Vaccine")
                date = entry.get("date_administered") or entry.get("date", "N/A")
                batch = entry.get("batch_number") or entry.get("batch", "N/A")
                due = entry.get("next_due_date", "N/A")
                due_info = f" | Next Due: {due}" if due != "N/A" else ""
                print(f"   [{idx}] {name}")
                print(f"       Date: {date} | Lot: {batch}{due_info}")

        # Puppy Safe Walk Progress Bar
        pct = vax_data.get("immunity_percentage", 100)
        try:
            pct_int = int(pct)
        except Exception:
            pct_int = 100
        bar = "█" * (pct_int // 10) + "░" * (10 - (pct_int // 10))
        print(f"\n--- Puppy Safe Walk Immunity Roadmap ---")
        print(f"   [{bar}] {pct_int}% Protected")
        status = vax_data.get("safe_walk_status", "APPROVED FOR SOCIAL PACK WALKS")
        print(f"   Public Dog Parks Status: ✅ {status}")
        if vax_data.get("clinical_guidance"):
            print(f"   Guidance:                {vax_data['clinical_guidance']}")


async def test_guardrails_health_chat(query: Optional[str] = None):
    print_header("7. AI HEALTH CHAT & 4-TIER GUARDRAIL TESTER")
    if query:
        pet_dict = {"name": "Max", "species": "dog", "breed": "Labrador", "weight_kg": 12.0, "allergies": []}
        species = "dog"
        pet_name = "Max"
        print(f"🐾 Using Grounded Profile: Max (12.0kg Labrador dog)\n")
    else:
        print("🐾 Enter pet details for health grounding (press Enter to accept defaults):\n")
        pet_name = safe_input("Pet Name [default: Max]: ", "Max")
        species = safe_input("Species (dog / cat) [default: dog]: ", "dog").lower()
        breed = safe_input("Breed [default: Labrador]: ", "Labrador")
        weight_str = safe_input("Weight in kg [default: 12.0]: ", "12.0")
        try:
            weight_kg = float(weight_str)
        except ValueError:
            weight_kg = 12.0
        allergies_str = safe_input("Allergies [default: none]: ", "none")
        allergies = [] if allergies_str.lower() in ["none", "no", ""] else [a.strip() for a in allergies_str.split(",") if a.strip()]

        pet_dict = {
            "name": pet_name,
            "species": species,
            "breed": breed,
            "weight_kg": weight_kg,
            "allergies": allergies
        }

    if not query:
        print("\nTest scenarios:")
        print("  1. Emergency Toxin Trigger (e.g. 'My dog ate dark chocolate cookies and is shivering')")
        print("  2. General Wellness Question (e.g. 'How often should I brush his ears?')")
        print("  3. Out-of-Scope Query (e.g. 'Write a python script to predict bitcoin price')")
        msg = safe_input(f"\nEnter question or symptom for {pet_name}: ", "He accidentally ate chocolate cookies")
    else:
        msg = query

    print(f"\nUser Query: '{msg}'")

    # Test Tier 1 Triage
    is_em, triage = guardrail_service.pre_retrieval_emergency_triage(msg, species=species)
    if is_em:
        print("\n🚨 [TIER 1 GUARDRAIL TRIGGERED - EMERGENCY OVERRIDE]")
        print(f"  Toxin Detected: {triage.toxin_detected}")
        print(f"  Severity:       {triage.severity.upper()}")
        print(f"  Action:         {triage.immediate_action}")
        print(f"  24/7 Hotline:   {triage.hotlines[0]['name']} ({triage.hotlines[0]['phone']})")
    else:
        is_oos, refusal = guardrail_service.check_domain_scope(msg)
        if is_oos:
            print("\n🛑 [OUT-OF-SCOPE GUARDRAIL TRIGGERED - DOMAIN DEFLECTION]")
            print("  Domain Status: NON-PET QUERY (Intercepted before LLM)")
            print(f"\n{refusal}")
        else:
            print("\n🔬 [GOOGLE RESEARCH HARNESS² - RECURSIVE AGENT EXECUTION]")
            from app.services.harness2_service import harness2_engine
            harness = harness2_engine.build_harness(pet_dict, [])
            print(f"  • Harness Components: 8 Editable Modules Active (System Prompt, Guardrails, Memory, Tools, Skills, Subagents, Scripts, Lessons)")
            print(f"  • Active Subagents:   {', '.join(s['role'] for s in harness.subagents)}")
            print(f"  • Active Skills:      {len(harness.skills)} procedural clinical heuristics")
            print(f"  • Recursive Loop:     PROPOSE -> PROBE -> COMPOSE (Label-Free Self-Refinement)")
            print(f"\n⏳ Contacting Google Gemini & running clinical safety triage (~3-5 seconds)...", flush=True)
            
            ans = await qwen_hf_service.chat_health_assistant(pet_context=pet_dict, user_message=msg, chat_history=[])
            print(f"\n💬 [FINAL HARNESS² COMPOSED RESPONSE]\n")
            print(ans)

async def test_community_postgis_radar():
    print_header("8. POSTGIS COMMUNITY RADAR & MEETUP TESTER")
    async with AsyncSessionLocal() as session:
        search_pt = from_shape(Point(-122.4194, 37.7749), srid=4326)
        stmt = (
            select(Pet, Profile.area_neighborhood, func.ST_Distance(Profile.location_geom, search_pt).label("dist"))
            .join(Profile, Pet.owner_id == Profile.id)
            .where(Profile.location_geom.isnot(None), func.ST_DWithin(Profile.location_geom, search_pt, 5000))
            .order_by("dist")
        )
        res = await session.execute(stmt)
        rows = res.all()
        
        print(f"Pets found within 5.0km radius (Neighborhood Centroids):\n")
        if not rows:
            print("  No pets found within 5km radius.")
        for pet, neighborhood, dist_m in rows:
            dist_km = round(dist_m / 1000, 2)
            print(f"  🐾 {pet.name} ({pet.breed}, {pet.energy_level} energy) - ~{dist_km} km away in {neighborhood or 'San Francisco'}")

        # Meetups
        events = (await session.execute(select(CommunityEvent))).scalars().all()
        print(f"\nUpcoming Local Pack Walks / Community Events ({len(events)} active):")
        for ev in events:
            date_str = ev.event_time.strftime("%b %d, %Y at %I:%M %p") if ev.event_time else "TBD"
            rsvp_count_stmt = select(func.count(EventRSVP.id)).where(EventRSVP.event_id == ev.id)
            rsvp_count = (await session.execute(rsvp_count_stmt)).scalar() or 0
            vax_tag = "🛡️ Verified Vaccines Required" if ev.requires_verified_vax else "Open Walk"
            print(f"  📅 {ev.title}")
            print(f"     When:  {date_str} | Spot: {ev.location_name}")
            print(f"     RSVPs: {rsvp_count}/{ev.max_attendees or 'Unlimited'} ({vax_tag})")
            if ev.description:
                print(f"     About: {ev.description}")

async def test_google_calendar_sync(custom_arg: Optional[str] = None):
    print_header("10. GOOGLE CALENDAR AUTOMATED EVENT SCHEDULER")
    is_conf = google_calendar_service.is_configured()
    token_loaded = google_calendar_service.load_credentials() is not None
    
    print(f"Google Calendar OAuth Status: {'[LIVE CONFIGURED]' if is_conf else '[SETUP MODE: Needs GOOGLE_CLIENT_ID & SECRET in .env]'}")
    print(f"Active User Token Status:     {'[CONNECTED & AUTHORIZED]' if token_loaded else '[NOT LOGGED IN]'}")

    if not is_conf:
        print("\nℹ️  Notice: You can still generate instant 1-Click 'Add to Google Calendar' links right now!")
        print("    To enable silent background sync without clicks, set GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET in .env.")

    print("\nSelect Calendar Action:")
    print("  1. Schedule Vaccine Booster (with 7-Day & 1-Day Advance Alarms)")
    print("  2. Schedule Daily Recurring Feeding Time (RRULE:FREQ=DAILY)")
    print("  3. Authenticate / Connect Google Account (Authorize OAuth)")
    action_choice = safe_input("Select [1-3, default: 1]: ", "1")

    pet_name = safe_input("\nPet Name [default: Max]: ", "Max")

    if action_choice == "1":
        vax_name = safe_input("Vaccine Name [default: Canine Corona Virus + Rabies]: ", "Canine Corona Virus + Rabies")
        due_date = safe_input("Booster Due Date (YYYY-MM-DD) [default: 2026-09-30]: ", "2026-09-30")
        batch_no = safe_input("Batch / Lot Number [default: B013A02]: ", "B013A02")
        
        print(f"\n[*] Scheduling {pet_name}'s {vax_name} booster in Google Calendar...")
        res = google_calendar_service.schedule_vaccine_booster(
            pet_name=pet_name,
            vaccine_name=vax_name,
            due_date=due_date,
            batch_number=batch_no
        )
        print("\n" + "=" * 65)
        print(" 📅 [GOOGLE CALENDAR VACCINE BOOSTER EVENT CREATED]")
        print("─" * 65)
        print(f" Summary:   {res['summary']}")
        print(f" Due Date:  {due_date}")
        print(f" Alarms:    ⏰ 7 Days Prior & ⏰ 1 Day Prior (Popup + Email)")
        print(f" Mode:      {res['mode'].upper()}")
        print(f" Link:      {res['html_link']}")
        print("=" * 65 + "\n")

    elif action_choice == "2":
        meal_lbl = safe_input("Meal Label [default: Morning Feeding]: ", "Morning Feeding")
        meal_time = safe_input("Meal Time (HH:MM) [default: 08:00]: ", "08:00")
        portion = safe_input("Portion [default: 82.5g (0.69 cups)]: ", "82.5g (0.69 cups)")
        ingr = safe_input("Ingredients [default: Lean Lamb & Sweet Potato kibble]: ", "Lean Lamb & Sweet Potato kibble")
        user_tz = safe_input("Timezone (e.g. America/New_York, Europe/London) [Enter for auto-detect]: ", "").strip() or None
        dur_input = safe_input("Duration in Days (reoccurrence) [default: 30]: ", "30").strip()
        try:
            dur_days = int(dur_input) if dur_input else 30
        except ValueError:
            dur_days = 30

        print(f"\n[*] Scheduling {dur_days}-day daily recurring feeding event for {pet_name}...")
        res = google_calendar_service.schedule_daily_feeding(
            pet_name=pet_name,
            meal_label=meal_lbl,
            portion=portion,
            ingredients=ingr,
            meal_time_str=meal_time,
            user_timezone=user_tz,
            duration_days=dur_days
        )
        print("\n" + "=" * 65)
        print(" 📅 [GOOGLE CALENDAR RECURRING FEEDING EVENT CREATED]")
        print("─" * 65)
        print(f" Summary:   {res['summary']}")
        print(f" Frequency: DAILY at {meal_time} for {res.get('duration_days', dur_days)} days")
        print(f" Timezone:  🌐 {res.get('timezone', 'UTC')}")
        print(f" Alarms:    ⏰ 10 Minutes Before Feeding")
        print(f" Mode:      {res['mode'].upper()}")
        print(f" Link:      {res['html_link']}")
        print("=" * 65 + "\n")

    elif action_choice == "3":
        if not is_conf:
            print("\n[!] Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env first.")
        else:
            creds = google_calendar_service.authenticate_interactive()
            if creds and creds.valid:
                print("\n[SUCCESS] Google Calendar successfully connected and authorized!")
                print("         You can now schedule events directly into your calendar without clicking any links.")
            else:
                print("\n[!] Authorization incomplete. Please try again.")

async def test_pet_matchmaking_and_chat():
    print_header("10. PET MATCHMAKING (LIKE/PASS) & 1-ON-1 DIRECT CHAT")
    print("  1. View Active Mutual Playdate Matches & Chat Messages")
    print("  2. Swipe on Nearby Pets (Tinder-style Like / Pass)")
    print("  3. Send a 1-on-1 Direct Message to a Matched Pet Parent")
    sub = safe_input("\nSelect [1-3, default: 1]: ", "1")

    async with AsyncSessionLocal() as session:
        all_pets = (await session.execute(select(Pet))).scalars().all()
        if not all_pets:
            print("[!] No registered pets found in the database. Please add a pet first.")
            return

        current_pet = all_pets[0]
        current_user = (await session.execute(select(Profile).where(Profile.id == current_pet.owner_id))).scalar_one_or_none()

        if sub == "1":
            matches = (await session.execute(select(PetMatch).where(PetMatch.is_active == True))).scalars().all()
            print(f"\n🐾 Active Playdate Matches ({len(matches)} mutual):\n")
            if not matches:
                print("  No matches yet! Use option 2 to swipe on nearby dogs.")
                return

            for m in matches:
                p1 = (await session.execute(select(Pet).where(Pet.id == m.pet1_id))).scalar_one_or_none()
                p2 = (await session.execute(select(Pet).where(Pet.id == m.pet2_id))).scalar_one_or_none()
                u1 = (await session.execute(select(Profile).where(Profile.id == m.user1_id))).scalar_one_or_none()
                u2 = (await session.execute(select(Profile).where(Profile.id == m.user2_id))).scalar_one_or_none()
                p1_name = p1.name if p1 else "Unknown Pet"
                p1_breed = f"({p1.breed})" if p1 and p1.breed else ""
                p2_name = p2.name if p2 else "Unknown Pet"
                p2_breed = f"({p2.breed})" if p2 and p2.breed else ""
                u1_name = (u1.full_name or u1.email) if u1 else "Unknown"
                u2_name = (u2.full_name or u2.email) if u2 else "Unknown"
                print(f"  ❤️  PLAYDATE MATCH: {p1_name} {p1_breed} 🐾 {p2_name} {p2_breed}")
                print(f"      Parents:    {u1_name} & {u2_name}")
                print(f"      Matched At: {m.created_at.strftime('%b %d, %Y at %I:%M %p')}")

                msgs = (await session.execute(
                    select(DirectMessage).where(DirectMessage.match_id == m.id).order_by(DirectMessage.created_at.asc())
                )).scalars().all()
                print(f"      💬 Chat Messages ({len(msgs)}):")
                for msg in msgs:
                    sender = (await session.execute(select(Profile).where(Profile.id == msg.sender_id))).scalar_one_or_none()
                    sender_name = (sender.full_name or sender.email) if sender else "Owner"
                    status_icon = "✓✓ (Read)" if msg.is_read else "✓ (Delivered)"
                    print(f"        [{msg.created_at.strftime('%H:%M')}] {sender_name}: \"{msg.content}\" {status_icon}")
                print("─" * 60)

        elif sub == "2":
            print(f"\nSwiping on behalf of: {current_pet.name} ({current_pet.breed or current_pet.species})")
            target = (await session.execute(select(Pet).where(Pet.id != current_pet.id))).scalars().first()
            if not target:
                print("[!] No other pets found to swipe on.")
                return

            print(f"\n👉 Candidate Pet on Radar: {target.name} ({target.breed or 'Unknown'}, {(target.species or 'pet').upper()})")
            print(f"   Energy: {target.energy_level or 'Normal'} | Play Style: {target.play_style or 'Friendly'}")
            print(f"   Gallery: 📸 {len(target.photos or [])} photo(s)")
            if target.photos:
                for idx, ph in enumerate(target.photos, 1):
                    print(f"     Photo #{idx}: {ph}")

            swipe_action = safe_input("\nAction: [L]ike or [P]ass? [default: L]: ", "L").upper()
            action = "like" if swipe_action.startswith("L") else "pass"

            reciprocal = (await session.execute(
                select(PetSwipe).where(PetSwipe.sender_pet_id == target.id, PetSwipe.target_pet_id == current_pet.id, PetSwipe.action == "like")
            )).scalar_one_or_none()

            stmt_existing = select(PetSwipe).where(PetSwipe.sender_pet_id == current_pet.id, PetSwipe.target_pet_id == target.id)
            existing_swipe = (await session.execute(stmt_existing)).scalar_one_or_none()
            if existing_swipe:
                existing_swipe.action = action
            else:
                new_swipe = PetSwipe(
                    sender_pet_id=current_pet.id,
                    target_pet_id=target.id,
                    sender_user_id=current_user.id if current_user else current_pet.owner_id,
                    target_user_id=target.owner_id,
                    action=action
                )
                session.add(new_swipe)
            await session.commit()

            if action == "like" and reciprocal:
                p1_id, p2_id = (current_pet.id, target.id) if str(current_pet.id) < str(target.id) else (target.id, current_pet.id)
                u1_id, u2_id = (current_pet.owner_id, target.owner_id) if p1_id == current_pet.id else (target.owner_id, current_pet.owner_id)
                
                stmt_m = select(PetMatch).where(PetMatch.pet1_id == p1_id, PetMatch.pet2_id == p2_id)
                m_existing = (await session.execute(stmt_m)).scalar_one_or_none()
                if not m_existing:
                    match = PetMatch(pet1_id=p1_id, pet2_id=p2_id, user1_id=u1_id, user2_id=u2_id, is_active=True)
                    session.add(match)
                    await session.commit()
                print(f"\n🎉 [IT'S A MUTUAL MATCH!] Both {current_pet.name} and {target.name} liked each other!")
                print(f"   You can now start a 1-on-1 chat with {target.name}'s parent to schedule a playdate.")
            elif action == "like":
                print(f"\n[SUCCESS] Liked {target.name}! If they like {current_pet.name} back, it triggers an instant playdate match!")
            else:
                print(f"\n[INFO] Passed on {target.name}.")

        elif sub == "3":
            if not current_user:
                print("[!] Current user not found.")
                return
            recipient = (await session.execute(select(Profile).where(Profile.id != current_user.id))).scalars().first()
            if not recipient:
                print("[!] No recipient found.")
                return

            recipient_pet = (await session.execute(select(Pet).where(Pet.owner_id == recipient.id))).scalars().first()
            pet_tag = f" (Owner of {recipient_pet.name})" if recipient_pet else ""
            print(f"\n1-on-1 Chat with: {recipient.full_name or recipient.email}{pet_tag}")
            msg_text = safe_input("Type your message [default: Are you free for a dog park run at 4pm?]: ", "Are you free for a dog park run at 4pm?")

            match = (await session.execute(select(PetMatch).where(
                or_(
                    and_(PetMatch.user1_id == current_user.id, PetMatch.user2_id == recipient.id),
                    and_(PetMatch.user1_id == recipient.id, PetMatch.user2_id == current_user.id)
                )
            ))).scalar_one_or_none()

            msg = DirectMessage(
                match_id=match.id if match else None,
                sender_id=current_user.id,
                recipient_id=recipient.id,
                content=msg_text,
                is_read=False
            )
            session.add(msg)
            await session.commit()
            print(f"\n[SUCCESS] Direct Message Sent to {recipient.full_name or recipient.email}!")
            print(f"  Content: \"{msg.content}\"")
            print(f"  Status:  Delivered (Unread)")

async def main():
    if len(sys.argv) > 1:
        choice = sys.argv[1].strip()
        custom_arg = " ".join(sys.argv[2:]).strip() if len(sys.argv) > 2 else None
        if choice == "1":
            await test_auth_and_profile()
        elif choice == "2":
            await test_geolocation_reverse()
        elif choice == "3":
            await test_pet_profiles()
        elif choice == "4":
            await test_diary_timeline()
        elif choice == "5":
            await test_nutrition_generator(custom_arg)
        elif choice == "6":
            await test_medical_vault_and_roadmap()
        elif choice == "7":
            await test_guardrails_health_chat(custom_arg)
        elif choice == "8":
            await test_community_postgis_radar()
        elif choice == "9":
            await test_google_calendar_sync(custom_arg)
        elif choice == "10":
            await test_pet_matchmaking_and_chat()
        return

    # Interactive Menu
    while True:
        print_header("🐾 PAWCIRCLE BACKEND TESTING CONTROL CENTER")
        print("  1. Auth & Passwordless OTP Tester")
        print("  2. Geolocation & Reverse Geocoder Tester")
        print("  3. Pet Profiles & Photo Gallery Manager")
        print("  4. 1-Tap Diary & Timeline Tester")
        print("  5. AI Nutrition & Caloric Engine Tester")
        print("  6. Smart Medical Vault & Vaccine Roadmap")
        print("  7. AI Health Chat & 4-Tier Guardrail Tester")
        print("  8. PostGIS Community Radar & Meetups")
        print("  9. Google Calendar Automated Scheduler")
        print(" 10. Pet Matchmaking (Like/Pass) & 1-on-1 Chat")
        print("  0. Exit")
        
        try:
            choice = safe_input("\nSelect an option [0-10]: ", "0")
            if choice == "1":
                await test_auth_and_profile()
            elif choice == "2":
                await test_geolocation_reverse()
            elif choice == "3":
                await test_pet_profiles()
            elif choice == "4":
                await test_diary_timeline()
            elif choice == "5":
                await test_nutrition_generator()
            elif choice == "6":
                await test_medical_vault_and_roadmap()
            elif choice == "7":
                await test_guardrails_health_chat()
            elif choice == "8":
                await test_community_postgis_radar()
            elif choice == "9":
                await test_google_calendar_sync()
            elif choice == "10":
                await test_pet_matchmaking_and_chat()
            elif choice == "0":
                print("\nExiting PawCircle CLI. Happy coding!\n")
                break
            else:
                print("Invalid option. Please choose 0 to 10.")
                break
        except KeyboardInterrupt:
            print("\n[!] Sub-test cancelled. Returning to main menu...")
            continue
        except Exception as err:
            print(f"\n[!] Unexpected error: {err}. Returning to menu...")
            continue

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nExiting PawCircle CLI. Goodbye!\n")
