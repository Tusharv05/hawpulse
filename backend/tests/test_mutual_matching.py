"""
Integration test for Double Opt-In / Mutual Matching in PawCircle.
Verifies:
1. Swiping 'like' when target has NOT liked you does NOT trigger a match (is_match=False).
2. Swiping 'pass' does not trigger a match.
3. Swiping 'like' when target HAS liked you triggers a Mutual Match (is_match=True, PetMatch created).
4. Both users can view the active mutual match in GET /community/matches.
5. If either user subsequently passes, the match is marked inactive and removed from active matches.
6. Liking back reactivates the mutual match.
"""
import os
import sys
import asyncio
from datetime import date

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import AsyncClient, ASGITransport
from app.main import app

async def run_mutual_match_test():
    email_a = f"parent_a_{os.getpid()}@example.com"
    email_b = f"parent_b_{os.getpid()}@example.com"
    pet_a_id = None
    pet_b_id = None
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            print("\n========================================================")
            print(" PAWCIRCLE MUTUAL MATCHING & DOUBLE OPT-IN TEST SUITE")
            print("========================================================")

            # -------------------------------------------------------------
            # 1. Authenticate User A & Register Pet A (Milo)
            # -------------------------------------------------------------
            auth_a = (await client.post("/api/v1/auth/verify-otp", json={"email": email_a, "otp": "123456"})).json()
            headers_a = {"Authorization": f"Bearer {auth_a['access_token']}"}

        res_a = await client.post("/api/v1/pets", json={
            "name": "Milo",
            "species": "dog",
            "breed": "Golden Retriever",
            "birth_date": "2023-05-10",
            "weight_kg": 28.5,
            "energy_level": "high",
            "vax_status": "full"
        }, headers=headers_a)
        assert res_a.status_code == 201, f"Failed to create Pet A: {res_a.text}"
        pet_a = res_a.json()
        pet_a_id = pet_a["id"]
        print(f"[*] User A created with pet Milo ({pet_a_id})")

        # -------------------------------------------------------------
        # 2. Authenticate User B & Register Pet B (Luna)
        # -------------------------------------------------------------
        email_b = f"parent_b_{os.getpid()}@example.com"
        auth_b = (await client.post("/api/v1/auth/verify-otp", json={"email": email_b, "otp": "123456"})).json()
        headers_b = {"Authorization": f"Bearer {auth_b['access_token']}"}

        res_b = await client.post("/api/v1/pets", json={
            "name": "Luna",
            "species": "dog",
            "breed": "Border Collie",
            "birth_date": "2023-08-20",
            "weight_kg": 18.0,
            "energy_level": "hyper",
            "vax_status": "full"
        }, headers=headers_b)
        assert res_b.status_code == 201, f"Failed to create Pet B: {res_b.text}"
        pet_b = res_b.json()
        pet_b_id = pet_b["id"]
        print(f"[*] User B created with pet Luna ({pet_b_id})")

        # -------------------------------------------------------------
        # 3. Test Step 1: User A likes Pet B (Luna)
        #    Luna has NOT liked Milo yet -> Must NOT be a match!
        # -------------------------------------------------------------
        print("\n[*] Step 1: User A likes Pet B (One-way like)...")
        swipe_1 = (await client.post("/api/v1/community/swipe", json={
            "target_pet_id": pet_b_id,
            "action": "like"
        }, headers=headers_a)).json()

        assert swipe_1["success"] is True
        assert swipe_1["action"] == "like"
        assert swipe_1["is_match"] is False, f"Expected is_match=False on one-way like, got {swipe_1['is_match']}"
        assert swipe_1["match_id"] is None
        print(f" [PASS] One-way like recorded without match: {swipe_1['message']}")

        # Verify neither user has any active matches yet
        matches_a = (await client.get("/api/v1/community/matches", headers=headers_a)).json()
        matches_b = (await client.get("/api/v1/community/matches", headers=headers_b)).json()
        assert len(matches_a) == 0, f"User A should have 0 matches, got {len(matches_a)}"
        assert len(matches_b) == 0, f"User B should have 0 matches, got {len(matches_b)}"
        print(" [PASS] Matches tab correctly empty for both users.")

        # -------------------------------------------------------------
        # 4. Test Step 2: User B checks Discover Deck
        #    Pet A (Milo) should have `has_liked_you=True`!
        # -------------------------------------------------------------
        print("\n[*] Step 2: User B views Discover deck...")
        discover_b = (await client.get("/api/v1/community/discover", headers=headers_b)).json()
        milo_card = next((p for p in discover_b if p["id"] == pet_a_id), None)
        assert milo_card is not None, "Milo should appear in User B's discover deck"
        assert milo_card["has_liked_you"] is True, "has_liked_you should be True for Milo on User B's deck"
        print(f" [PASS] User B sees Milo with has_liked_you=True badge!")

        # -------------------------------------------------------------
        # 5. Test Step 3: User B passes on Milo
        #    Still no match!
        # -------------------------------------------------------------
        print("\n[*] Step 3: User B passes on Milo...")
        pass_swipe = (await client.post("/api/v1/community/swipe", json={
            "target_pet_id": pet_a_id,
            "action": "pass"
        }, headers=headers_b)).json()
        assert pass_swipe["is_match"] is False
        assert pass_swipe["match_id"] is None
        print(" [PASS] User B pass recorded with is_match=False.")

        # -------------------------------------------------------------
        # 6. Test Step 4: User B changes mind and likes Milo back!
        #    NOW BOTH PEOPLE LIKE EACH OTHER -> MUTUAL MATCH!
        # -------------------------------------------------------------
        print("\n[*] Step 4: User B likes Milo back (Mutual like)...")
        swipe_2 = (await client.post("/api/v1/community/swipe", json={
            "target_pet_id": pet_a_id,
            "action": "like"
        }, headers=headers_b)).json()

        assert swipe_2["success"] is True
        assert swipe_2["action"] == "like"
        assert swipe_2["is_match"] is True, f"Expected is_match=True on mutual like, got {swipe_2['is_match']}"
        assert swipe_2["match_id"] is not None
        match_id = swipe_2["match_id"]
        print(f" [PASS] Mutual Match triggered! match_id={match_id}: {swipe_2['message']}")

        # -------------------------------------------------------------
        # 7. Test Step 5: Verify both users see active match & messages
        # -------------------------------------------------------------
        print("\n[*] Step 5: Verifying active match list for both parents...")
        active_matches_a = (await client.get("/api/v1/community/matches", headers=headers_a)).json()
        active_matches_b = (await client.get("/api/v1/community/matches", headers=headers_b)).json()

        assert len(active_matches_a) >= 1
        assert len(active_matches_b) >= 1
        assert active_matches_a[0]["matched_pet_name"] == "Luna"
        assert active_matches_b[0]["matched_pet_name"] == "Milo"
        print(f" [PASS] Both parents now have active playdate match ({active_matches_a[0]['matched_pet_name']} & {active_matches_b[0]['matched_pet_name']})")

        # -------------------------------------------------------------
        # 8. Test Step 6: User A passes on Luna -> Match deactivated
        # -------------------------------------------------------------
        print("\n[*] Step 6: User A changes swipe to 'pass'...")
        unmatch_swipe = (await client.post("/api/v1/community/swipe", json={
            "target_pet_id": pet_b_id,
            "action": "pass"
        }, headers=headers_a)).json()
        assert unmatch_swipe["is_match"] is False

        # Active matches should no longer contain this match
        updated_matches_a = (await client.get("/api/v1/community/matches", headers=headers_a)).json()
        assert not any(m["match_id"] == match_id for m in updated_matches_a)
        print(" [PASS] Match deactivated upon pass. Not visible in active matches.")

        # -------------------------------------------------------------
        # 9. Test Step 7: User A likes Luna again -> Match reactivated
        # -------------------------------------------------------------
        print("\n[*] Step 7: User A likes Luna again...")
        reactivate_swipe = (await client.post("/api/v1/community/swipe", json={
            "target_pet_id": pet_b_id,
            "action": "like"
        }, headers=headers_a)).json()
        assert reactivate_swipe["is_match"] is True
        assert reactivate_swipe["match_id"] == match_id

        reactivated_matches = (await client.get("/api/v1/community/matches", headers=headers_a)).json()
        assert any(m["match_id"] == match_id for m in reactivated_matches)
        print(" [PASS] Mutual match successfully reactivated!")

        print("\n========================================================")
        print(" [ALL 7 TESTS PASSED] MUTUAL MATCHING RULES VERIFIED 100%!")
        print("========================================================")
    finally:
        # -------------------------------------------------------------
        # Automatic Clean-up of Test Data
        # -------------------------------------------------------------
        from app.core.database import AsyncSessionLocal
        from app.models.profile import Profile
        from app.models.pet import Pet
        from app.models.community import PetSwipe, PetMatch
        from sqlalchemy import delete, or_
        async with AsyncSessionLocal() as session:
            pet_ids = [p for p in [pet_a_id, pet_b_id] if p]
            if pet_ids:
                await session.execute(delete(PetMatch).where(or_(PetMatch.pet1_id.in_(pet_ids), PetMatch.pet2_id.in_(pet_ids))))
                await session.execute(delete(PetSwipe).where(or_(PetSwipe.sender_pet_id.in_(pet_ids), PetSwipe.target_pet_id.in_(pet_ids))))
                await session.execute(delete(Pet).where(Pet.id.in_(pet_ids)))
            await session.execute(delete(Profile).where(Profile.email.in_([email_a, email_b])))
            await session.commit()
            print(" [*] Test profiles & pets cleaned up completely.")

if __name__ == "__main__":
    asyncio.run(run_mutual_match_test())
