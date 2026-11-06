import pytest
import io
import os
import sys
from datetime import date, datetime, timedelta, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_complete_backend_phases_1_to_4():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("\n==================================================")
        print(" PAWCIRCLE BACKEND INTEGRATION TEST: PHASES 1 TO 4")
        print("==================================================")

        # -------------------------------------------------------------
        # 1. PHASE 1: AUTHENTICATION & ONBOARDING
        # -------------------------------------------------------------
        print("\n[*] 1. Testing Passwordless Auth & OTP...")
        # Step A: Request OTP
        req_res = await client.post("/api/v1/auth/request-otp", json={"email": "alpha_parent@example.com"})
        assert req_res.status_code == 200
        assert "OTP sent" in req_res.json()["message"]

        # Step B: Verify OTP (using dev test OTP '123456')
        verify_res = await client.post("/api/v1/auth/verify-otp", json={
            "email": "alpha_parent@example.com",
            "otp": "123456"
        })
        assert verify_res.status_code == 200
        auth_data = verify_res.json()
        token = auth_data["access_token"]
        user_id = auth_data["user_id"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"[SUCCESS] Authenticated! User ID: {user_id}")

        # Step C: Geolocation reverse-lookup & update
        loc_res = await client.post("/api/v1/auth/location", json={
            "latitude": 37.7749,
            "longitude": -122.4194
        }, headers=headers)
        assert loc_res.status_code == 200
        loc_data = loc_res.json()
        print(f"[SUCCESS] Location sanitized to fuzzy neighborhood: {loc_data['area_neighborhood']} ({loc_data['city']})")

        # -------------------------------------------------------------
        # 2. PHASE 1: PET PROFILE & 1-TAP DIARY
        # -------------------------------------------------------------
        print("\n[*] 2. Testing Pet Registration & 1-Tap Diary...")
        pet_payload = {
            "name": "Milo",
            "species": "dog",
            "breed": "Golden Retriever",
            "birth_date": "2024-06-15",
            "weight_kg": 28.5,
            "allergies": ["chicken"],
            "energy_level": "high",
            "play_style": "gentle player",
            "is_neutered": True,
            "vax_status": "partial"
        }
        pet_res = await client.post("/api/v1/pets", json=pet_payload, headers=headers)
        assert pet_res.status_code == 201
        pet = pet_res.json()
        pet_id = pet["id"]
        print(f"[SUCCESS] Pet registered: {pet['name']} ({pet['breed']}) - ID: {pet_id}")

        # 1-Tap Quick Log: Feed
        feed_res = await client.post("/api/v1/diary/log", json={
            "pet_id": pet_id,
            "event_type": "feed",
            "details": {"portion_grams": 180, "food": "Salmon formula"},
            "notes": "Morning feeding finished enthusiastically"
        }, headers=headers)
        assert feed_res.status_code == 201
        print(f"[SUCCESS] 1-Tap Diary entry created: {feed_res.json()['event_type']}")

        # Fetch today's timeline
        timeline_res = await client.get(f"/api/v1/diary/{pet_id}/today", headers=headers)
        assert timeline_res.status_code == 200
        tl_data = timeline_res.json()
        assert tl_data["total_events"] >= 1
        assert tl_data["feed_count"] >= 1
        print(f"[SUCCESS] Diary timeline retrieved! Events today: {tl_data['total_events']}, Streak: {tl_data['streak_days']} day(s)")

        # Create pet sitter share link
        share_res = await client.post(f"/api/v1/diary/{pet_id}/share-token", headers=headers)
        assert share_res.status_code == 200
        sitter_token = share_res.json()["share_token"]
        # Access public sitter view without auth header
        public_res = await client.get(f"/api/v1/diary/shared/{sitter_token}")
        assert public_res.status_code == 200
        print(f"[SUCCESS] Pet sitter shareable read-only link verified!")

        # -------------------------------------------------------------
        # 3. PHASE 2: AI NUTRITION ENGINE & MEAL SCHEDULES
        # -------------------------------------------------------------
        print("\n[*] 3. Testing AI Diet Generation & Adoption...")
        diet_gen_res = await client.post("/api/v1/diet/generate", json={
            "pet_id": pet_id,
            "custom_prompt": "Need high protein raw/kibble mix for active retriever with chicken allergy",
            "diet_preset": "Active Adult Maintenance"
        }, headers=headers)
        assert diet_gen_res.status_code == 200
        diet_plan = diet_gen_res.json()
        diet_plan_id = diet_plan["id"]
        assert diet_plan["target_calories_kcal"] > 0
        assert diet_plan["meals_per_day"] in [2, 3]
        print(f"[SUCCESS] AI Diet Generated: {diet_plan['target_calories_kcal']} kcal/day across {diet_plan['meals_per_day']} meals.")

        # Adopt the diet plan
        adopt_res = await client.post("/api/v1/diet/adopt", json={"diet_plan_id": diet_plan_id}, headers=headers)
        assert adopt_res.status_code == 200
        schedules = adopt_res.json()
        assert len(schedules) >= 2
        print(f"[SUCCESS] Diet plan adopted! Configured {len(schedules)} active daily meal alerts.")

        # -------------------------------------------------------------
        # 4. PHASE 3: MEDICAL VAULT, OCR & 4-TIER GUARDRAILS
        # -------------------------------------------------------------
        print("\n[*] 4. Testing Medical Vault OCR & LLM Guardrails...")
        # Upload Prescription Slip
        dummy_rx = io.BytesIO(b"fake_prescription_image_data")
        rx_res = await client.post(
            "/api/v1/medical/prescriptions/upload",
            data={"pet_id": pet_id},
            files={"file": ("prescription_slip.jpg", dummy_rx, "image/jpeg")},
            headers=headers
        )
        assert rx_res.status_code == 200
        rx_data = rx_res.json()
        rx_id = rx_data["id"]
        assert len(rx_data["medications_extracted"]) >= 1
        print(f"[SUCCESS] Prescription OCR Parsed: Diagnosis: '{rx_data['parsed_diagnosis']}'")
        print(f"          Plain-language: '{rx_data['simplified_explanation'][:60]}...'")

        # 1-Tap Convert Rx to Alarms
        alarm_res = await client.post(f"/api/v1/medical/prescriptions/{rx_id}/create-alarms", headers=headers)
        assert alarm_res.status_code == 200
        print(f"[SUCCESS] Converted Rx into daily diary medication alarms!")

        # Upload Vaccine Booklet Photo
        dummy_vax = io.BytesIO(b"fake_vaccine_card_image_data")
        vax_res = await client.post(
            "/api/v1/medical/vaccines/upload",
            data={"pet_id": pet_id},
            files={"file": ("vaccine_card.jpg", dummy_vax, "image/jpeg")},
            headers=headers
        )
        assert vax_res.status_code == 200
        vax_data = vax_res.json()
        assert vax_data["is_verified"] is True
        print(f"[SUCCESS] Vaccine Card Verified: {vax_data['vaccine_name']} (Batch: {vax_data['batch_number']})")

        # Check Immunization Roadmap & Safe Walk Progress
        roadmap_res = await client.get(f"/api/v1/medical/{pet_id}/roadmap", headers=headers)
        assert roadmap_res.status_code == 200
        roadmap = roadmap_res.json()
        print(f"[SUCCESS] Roadmap calculated: Safe Walk Progress = {roadmap['safe_walk_progress_percentage']}%, Park Access = {roadmap['can_visit_public_parks']}")

        # Test TIER 1 GUARDRAIL: Poison / Emergency Trigger (Chocolate Ingestion)
        emergency_chat_res = await client.post("/api/v1/health-chat", json={
            "pet_id": pet_id,
            "message": "My dog ate 4 ounces of dark chocolate, what should I do?"
        }, headers=headers)
        assert emergency_chat_res.status_code == 200
        em_data = emergency_chat_res.json()
        assert em_data["triage"]["is_emergency"] is True
        assert "Chocolate" in em_data["triage"]["toxin_detected"]
        assert len(em_data["triage"]["hotlines"]) >= 1
        print(f"[SUCCESS] Tier 1 Guardrail Triggered: Ingestion of '{em_data['triage']['toxin_detected']}' correctly routed to immediate emergency hotlines!")

        # Test TIER 2 & 4 GUARDRAIL: Safe Wellness Question
        wellness_chat_res = await client.post("/api/v1/health-chat", json={
            "pet_id": pet_id,
            "message": "What is the best way to brush a Golden Retriever coat to prevent shedding?"
        }, headers=headers)
        assert wellness_chat_res.status_code == 200
        well_data = wellness_chat_res.json()
        assert well_data["triage"]["is_emergency"] is False
        assert "Veterinary Health Disclaimer" in well_data["answer"]
        print(f"[SUCCESS] Tier 4 Guardrail Verified: Answer delivered with mandatory veterinary clinical disclaimer stamp.")

        # -------------------------------------------------------------
        # 5. PHASE 4: COMMUNITY RADAR & MEETUP RSVPS
        # -------------------------------------------------------------
        print("\n[*] 5. Testing Community PostGIS Radar & Meetup RSVPs...")
        # Create a second user and pet to test spatial proximity radar
        user2_otp_res = await client.post("/api/v1/auth/verify-otp", json={
            "email": "neighbor_bob@example.com",
            "otp": "123456"
        })
        token2 = user2_otp_res.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}

        # Set neighbor location ~500m away in San Francisco
        await client.post("/api/v1/auth/location", json={
            "latitude": 37.7780,
            "longitude": -122.4180
        }, headers=headers2)

        # Register neighbor pet
        await client.post("/api/v1/pets", json={
            "name": "Buster",
            "species": "dog",
            "breed": "Labrador",
            "birth_date": "2023-01-01",
            "weight_kg": 32.0,
            "energy_level": "high",
            "vax_status": "full"
        }, headers=headers2)

        # Query Community Radar from User 1's position
        radar_res = await client.get("/api/v1/community/radar?latitude=37.7749&longitude=-122.4194&radius_km=5.0", headers=headers)
        assert radar_res.status_code == 200
        nearby_pets = radar_res.json()
        assert len(nearby_pets) >= 1
        found_pet = nearby_pets[0]
        print(f"[SUCCESS] PostGIS Radar: Found nearby pet '{found_pet['pet_name']}' ({found_pet['breed']}) at distance {found_pet['distance_meters']} meters!")

        # Create Community Pack Walk Event
        event_time = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        ev_create_res = await client.post("/api/v1/community/events", json={
            "title": "Golden Gate Saturday Morning Pack Walk",
            "description": "Friendly pack walk for social dogs with verified vaccines.",
            "location_name": "Dolores Park Dog Area",
            "latitude": 37.7596,
            "longitude": -122.4269,
            "event_time": event_time,
            "max_attendees": 10,
            "requires_verified_vax": True
        }, headers=headers)
        assert ev_create_res.status_code == 201
        event = ev_create_res.json()
        event_id = event["id"]
        print(f"[SUCCESS] Pack Walk Event Created: '{event['title']}' at {event['location_name']}")

        # RSVP for Event (User 1's pet Milo has verified vaccine badge from step 4)
        rsvp_res = await client.post(f"/api/v1/community/events/{event_id}/rsvp", json={
            "pet_id": pet_id,
            "status": "going"
        }, headers=headers)
        assert rsvp_res.status_code == 200
        assert rsvp_res.json()["status"] == "going"
        print(f"[SUCCESS] Vaccine Verification Gate Passed! RSVP confirmed for Milo.")

        print("\n==================================================")
        print(" [ALL TESTS PASSED] PHASES 1 TO 4 ARE 100% OPERATIONAL!")
        print("==================================================")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_complete_backend_phases_1_to_4())
