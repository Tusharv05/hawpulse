import uuid
import re
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_, func

from app.models.diary import DailyRoutineItem
from app.models.diet import DietPlan
from app.models.pet import Pet

def time_str_to_minutes(time_str: Optional[str]) -> int:
    """
    Parses a time string like '7:30 AM' or '6:00 PM' into total minutes since midnight for sorting.
    """
    if not time_str:
        return 720
    try:
        match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?", str(time_str).strip())
        if not match:
            return 720
        hours = int(match.group(1))
        minutes = int(match.group(2))
        period = (match.group(3) or "").upper()
        if period == "PM" and hours < 12:
            hours += 12
        elif period == "AM" and hours == 12:
            hours = 0
        return hours * 60 + minutes
    except Exception:
        return 720

def parse_daily_walks(custom_walks: Optional[str] = None, pet_name: str = "your dog") -> List[Dict[str, str]]:
    """
    Dynamically extracts two separated walks (Morning and Evening) with individual times and descriptions.
    Supports pipe-delimited format, comma/newline-delimited format, or natural summary.
    Avoids hardcoded predefined text.
    """
    default_morning = {
        "title": "Morning walk · 7:30 AM · 30 mins",
        "time_str": "7:30 AM",
        "subtitle": "Active morning sniff walk & bathroom break",
        "category": "walk"
    }
    default_evening = {
        "title": "Evening walk · 6:00 PM · 35 mins",
        "time_str": "6:00 PM",
        "subtitle": "Relaxed neighborhood stroll & social enrichment",
        "category": "walk"
    }

    if not custom_walks or not str(custom_walks).strip():
        return [default_morning, default_evening]

    cw_text = str(custom_walks).strip()
    morning_raw = ""
    evening_raw = ""

    # Split candidates by pipe, newline, semicolon, or comma
    # 1. Pipe-separated
    if "|" in cw_text:
        parts = [p.strip() for p in cw_text.split("|")]
        for p in parts:
            p_lower = p.lower()
            if p_lower.startswith("morning:"):
                morning_raw = p[len("morning:"):].strip()
            elif p_lower.startswith("evening:"):
                evening_raw = p[len("evening:"):].strip()
            elif "morning" in p_lower and not morning_raw and any(k in p for k in ["AM", "am", "min", "mins"]):
                morning_raw = p
            elif "evening" in p_lower and not evening_raw and any(k in p for k in ["PM", "pm", "min", "mins"]):
                evening_raw = p

    # 2. Newline or semicolon or comma
    if not morning_raw or not evening_raw:
        for split_char in ["\n", ";", ","]:
            if split_char in cw_text and (not morning_raw or not evening_raw):
                parts = [p.strip() for p in cw_text.split(split_char)]
                for p in parts:
                    p_lower = p.lower()
                    if ("morning" in p_lower or " am" in p_lower or re.search(r"\b\d{1,2}:\d{2}\s*am\b", p_lower)) and not morning_raw:
                        morning_raw = p
                    elif ("evening" in p_lower or " pm" in p_lower or re.search(r"\b\d{1,2}:\d{2}\s*pm\b", p_lower)) and not evening_raw:
                        evening_raw = p

    # 3. If still not found and we have multiple lines, assign line 1 as morning, line 2 as evening
    if (not morning_raw or not evening_raw) and "\n" in cw_text:
        lines = [line.strip() for line in cw_text.split("\n") if line.strip()]
        if len(lines) >= 2:
            if not morning_raw:
                morning_raw = lines[0]
            if not evening_raw:
                evening_raw = lines[1]

    def build_single_walk(raw: str, default_time: str, default_dur: str, default_sub: str, label: str) -> Dict[str, str]:
        if not raw:
            return {
                "title": f"{label} walk · {default_time} · {default_dur}",
                "time_str": default_time,
                "subtitle": default_sub,
                "category": "walk"
            }

        # Extract time e.g. '7:30 AM', '9:15 AM'
        time_match = re.search(r"(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))", raw)
        t_str = time_match.group(1).upper() if time_match else default_time

        # Extract duration e.g. '35 mins' or '30 min' or '30m'
        dur_match = re.search(r"(\d+)\s*(?:mins?|m\b)", raw, re.IGNORECASE)
        dur_str = f"{dur_match.group(1)} mins" if dur_match else default_dur

        # Clean subtitle
        clean = raw
        if time_match:
            clean = clean.replace(time_match.group(0), "")
        if dur_match:
            clean = re.sub(r"\(?\s*" + re.escape(dur_match.group(0)) + r"\s*\)?", "", clean, flags=re.IGNORECASE)
        clean = re.sub(r"\(\s*\)", "", clean)
        clean = re.sub(r"^(?:morning|evening)(?:\s+walk)?(?:\s*[:·\-])?", "", clean, flags=re.IGNORECASE)
        # Remove any predefined legacy text
        clean = re.sub(r"around\s+model\s+town\s+park", "", clean, flags=re.IGNORECASE)
        clean = re.sub(r"planned\s+route\s*:\s*community\s+green\s*&?\s*enrichment\s*sniffing", "enrichment sniffing", clean, flags=re.IGNORECASE)
        clean = re.sub(r"planned\s+route\s*:\s*", "", clean, flags=re.IGNORECASE)
        clean = clean.strip(" ·-:,()")

        if not clean or clean.lower() in ["walk", "sniff walk", "park loop"]:
            if label == "Morning":
                clean = "Active morning sniff walk & bathroom break"
            else:
                clean = "Relaxed neighborhood stroll & social enrichment"

        return {
            "title": f"{label} walk · {t_str} · {dur_str}",
            "time_str": t_str,
            "subtitle": clean,
            "category": "walk"
        }

    w_morning = build_single_walk(
        morning_raw,
        default_morning["time_str"],
        "30 mins",
        default_morning["subtitle"],
        "Morning"
    )
    w_evening = build_single_walk(
        evening_raw,
        default_evening["time_str"],
        "35 mins",
        default_evening["subtitle"],
        "Evening"
    )

    return [w_morning, w_evening]

def build_pet_routine_items(
    pet_id: uuid.UUID,
    food_name: str,
    half_grams_or_desc: str,
    overview_text: str,
    notes_text: str,
    custom_walks: Optional[str] = None
) -> List[DailyRoutineItem]:
    """
    Constructs a balanced routine item list:
    - 2 separated walks with distinct times from backend AI / user schedule
    - 2 meals (Breakfast & Dinner)
    - Chronologically sorted by scheduled time
    - STRICTLY NO water item (water is accessible 24/7 as guidance, not a task)
    """
    walks = parse_daily_walks(custom_walks)
    morning_walk = walks[0]
    evening_walk = walks[1]

    portion_label = f"{half_grams_or_desc} g {food_name}".strip() if str(half_grams_or_desc).isdigit() else f"{half_grams_or_desc} {food_name}".strip()

    raw_items = [
        {
            "title": f"Breakfast · 8:30 AM · {portion_label}",
            "time_str": "8:30 AM",
            "subtitle": overview_text or "Morning meal formulated for energy and digestion",
            "category": "feed"
        },
        morning_walk,
        evening_walk,
        {
            "title": f"Dinner · 7:30 PM · {portion_label}",
            "time_str": "7:30 PM",
            "subtitle": notes_text or "Evening nutrition + mobility support",
            "category": "feed"
        }
    ]

    # Sort chronologically by time of day
    sorted_items = sorted(raw_items, key=lambda x: time_str_to_minutes(x.get("time_str")))

    result = []
    for idx, item in enumerate(sorted_items, start=1):
        result.append(DailyRoutineItem(
            pet_id=pet_id,
            title=item["title"],
            time_str=item["time_str"],
            subtitle=item["subtitle"],
            category=item["category"],
            order_index=idx,
            is_active=True
        ))

    return result

async def sync_or_repair_pet_routines(db: AsyncSession, pet_id: uuid.UUID) -> List[DailyRoutineItem]:
    """
    Ensures pet routine checklist is clean:
    1. Removes any obsolete water routine items permanently and commits.
    2. If routines contain outdated predefined text, missing separated walks, or combined walks in a single subtitle,
       resyncs them using the pet's active DietPlan custom_walks.
    """
    # 1. Purge any water items unconditionally
    stmt_water = delete(DailyRoutineItem).where(
        DailyRoutineItem.pet_id == pet_id,
        or_(
            DailyRoutineItem.category == "water",
            func.lower(DailyRoutineItem.title).like("%water%"),
            func.lower(DailyRoutineItem.subtitle).like("%scrub bowl%")
        )
    )
    res_water_del = await db.execute(stmt_water)
    if res_water_del.rowcount and res_water_del.rowcount > 0:
        await db.commit()

    # 2. Query active routines
    stmt = select(DailyRoutineItem).where(
        DailyRoutineItem.pet_id == pet_id,
        DailyRoutineItem.is_active == True
    ).order_by(DailyRoutineItem.order_index.asc())
    res = await db.execute(stmt)
    routines = res.scalars().all()

    # 3. Check if repair / walk separation is needed
    needs_repair = False
    walk_items = [r for r in routines if r.category == "walk"]
    feed_items = [r for r in routines if r.category == "feed"]

    if len(routines) == 0:
        needs_repair = True
    elif len(walk_items) != 2 or len(feed_items) < 2:
        needs_repair = True
    else:
        for r in routines:
            if r.category == "water" or "water" in (r.title or "").lower():
                needs_repair = True
                break
            if r.category == "walk":
                sub = (r.subtitle or "").lower()
                tit = (r.title or "").lower()
                if (
                    "morning:" in sub
                    or "evening:" in sub
                    or "2 walks daily" in sub
                    or "model town park" in tit
                    or "model town park" in sub
                    or "community green" in tit
                    or "community green" in sub
                    or "|" in sub
                ):
                    needs_repair = True
                    break

        if not needs_repair:
            stmt_pet_check = select(Pet).where(Pet.id == pet_id)
            res_pet_check = await db.execute(stmt_pet_check)
            pet_chk = res_pet_check.scalar_one_or_none()
            if pet_chk and pet_chk.weight_kg:
                w_chk = float(pet_chk.weight_kg)
                expected_half = round((int(70 * (w_chk ** 0.75) * 1.6) / 3.4) / 2)
                for f in feed_items:
                    gm = re.search(r"(\d+)\s*g", f.title or "")
                    if gm:
                        g_val = int(gm.group(1))
                        if g_val < round(expected_half * 0.6) or g_val > round(expected_half * 1.8):
                            needs_repair = True
                            break

    if needs_repair:
        # Fetch pet profile
        stmt_pet = select(Pet).where(Pet.id == pet_id)
        res_pet = await db.execute(stmt_pet)
        pet = res_pet.scalar_one_or_none()

        pet_name = pet.name if pet else "your dog"
        breed = pet.breed if pet else "Dog"
        weight = float(pet.weight_kg) if pet and pet.weight_kg else 25.0

        # Fetch active or latest diet plan for pet to get custom_walks and meals
        stmt_plan = select(DietPlan).where(
            DietPlan.pet_id == pet_id
        ).order_by(DietPlan.is_active.desc(), DietPlan.created_at.desc())
        plan_res = await db.execute(stmt_plan)
        active_plan = plan_res.scalars().first()

        custom_walks = None
        food_name = f"Adult {breed} Balanced Kibble"
        cal = int(70 * (weight ** 0.75) * 1.6)
        grams = int(cal / 3.4)
        portion_desc = str(round(grams / 2))
        overview_text = f"Nutrient-dense daily meal plan formulated for {pet_name}'s daily metabolic energy."
        notes_text = "Ensure fresh, clean water is available at all times."

        if active_plan:
            plan_json = active_plan.full_plan_json or {}
            custom_walks = plan_json.get("custom_walks") or active_plan.custom_instructions
            food_name = plan_json.get("current_food") or active_plan.diet_type or f"Adult {breed} Balanced Kibble"
            overview_text = plan_json.get("overview") or active_plan.custom_instructions or overview_text
            notes_text = plan_json.get("notes") or notes_text

            # Clean notes_text of any legacy fresh water refresh lines
            notes_text = re.sub(r"(?i)provide fresh water refresh.*", "", notes_text).strip()
            notes_text = re.sub(r"(?i)fresh chilled water refresh.*", "", notes_text).strip()

            # Extract portion number
            amt_str = plan_json.get("amount_per_day") or ""
            g_match = re.search(r"(\d+(?:\.\d+)?)\s*g", amt_str)
            if g_match:
                half_g = int(round(float(g_match.group(1)) / 2))
                # Ensure half_g is clinically reasonable (at least 60% of expected portion)
                if half_g >= round(grams / 2 * 0.6):
                    portion_desc = str(half_g)
                else:
                    portion_desc = str(round(grams / 2))

        # Preserve any active medication items so they are not lost
        preserved_meds = [r for r in routines if r.category == "medication"]

        # Wipe existing walk, feed, and water routines for pet and rebuild cleanly
        del_stmt = delete(DailyRoutineItem).where(
            DailyRoutineItem.pet_id == pet_id,
            DailyRoutineItem.category != "medication"
        )
        await db.execute(del_stmt)

        new_routines = build_pet_routine_items(
            pet_id=pet_id,
            food_name=food_name,
            half_grams_or_desc=portion_desc,
            overview_text=overview_text,
            notes_text=notes_text,
            custom_walks=custom_walks
        )

        # Combine new routines with any preserved medications, sorted chronologically
        combined = []
        for nr in new_routines:
            combined.append({
                "item": nr,
                "time_minutes": time_str_to_minutes(nr.time_str)
            })
        for pm in preserved_meds:
            combined.append({
                "item": pm,
                "time_minutes": time_str_to_minutes(pm.time_str)
            })

        combined.sort(key=lambda x: x["time_minutes"])

        for idx, entry in enumerate(combined, start=1):
            it = entry["item"]
            it.order_index = idx
            db.add(it)

        await db.commit()

        # Re-fetch fresh list
        stmt_refreshed = select(DailyRoutineItem).where(
            DailyRoutineItem.pet_id == pet_id,
            DailyRoutineItem.is_active == True
        ).order_by(DailyRoutineItem.order_index.asc())
        res_refreshed = await db.execute(stmt_refreshed)
        routines = res_refreshed.scalars().all()

    return routines
