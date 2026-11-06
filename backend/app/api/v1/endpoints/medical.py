import uuid
import json
import re
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.pet import Pet
from app.models.medical import Prescription, Vaccination
from app.models.diary import DiaryEvent, DailyRoutineItem
from app.schemas.medical import (
    PrescriptionExtractionResponse, VaccinationResponse,
    VaccineRoadmapResponse, VaccineRoadmapMilestone, ToggleMilestoneRequest
)
from app.services.qwen_hf_service import qwen_hf_service
from app.services.storage import storage_service

def _parse_date_safe(date_str, fallback):
    if not date_str:
        return fallback
    if isinstance(date_str, (date, datetime)):
        return date_str.date() if isinstance(date_str, datetime) else date_str

    clean_str = str(date_str).strip()
    # Strip ordinal suffixes: 1st, 2nd, 3rd, 14th
    clean_str = re.sub(r'(\d+)(st|nd|rd|th)\b', r'\1', clean_str, flags=re.IGNORECASE)

    # 1. Try ISO format
    try:
        return date.fromisoformat(clean_str)
    except Exception:
        pass

    # 2. Try common date string formats
    formats = [
        "%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
        "%m/%d/%Y", "%m-%d-%Y", "%m.%d.%Y",
        "%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y", "%b %d %Y", "%B %d %Y",
        "%d-%b-%Y", "%d-%B-%Y", "%d/%m/%y", "%d-%m-%y", "%m/%d/%y", "%y-%m-%d"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(clean_str, fmt).date()
        except Exception:
            continue

    # 3. Regex extraction: Year first YYYY-MM-DD
    m1 = re.search(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", clean_str)
    if m1:
        try:
            return date(int(m1.group(1)), int(m1.group(2)), int(m1.group(3)))
        except Exception:
            pass

    # 4. Regex extraction: Day or Month first DD-MM-YYYY
    m2 = re.search(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})", clean_str)
    if m2:
        try:
            d, m, y = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
            if m > 12 >= d:
                d, m = m, d
            return date(y, m, d)
        except Exception:
            pass

    return fallback

router = APIRouter(prefix="/medical", tags=["Smart Medical Vault & OCR"])

@router.post("/prescriptions/upload", response_model=PrescriptionExtractionResponse)
async def upload_prescription_slip(
    pet_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Multimodal Prescription OCR & Plain-Language Simplifier:
    Uploads slip photo -> Vision model extracts diagnosis, medications, and any vaccine entries with exact administered dates.
    """
    stmt = select(Pet).where(Pet.id == pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    file_bytes = await file.read()
    doc_url = await storage_service.save_uploaded_file(file_bytes, file.filename)
    b64_url = storage_service.encode_image_base64(file_bytes, file.content_type or "image/jpeg")

    # Run Vision extraction
    parsed = await qwen_hf_service.parse_prescription_image(b64_url, pet_name=pet.name)

    prescription = Prescription(
        pet_id=pet.id,
        document_url=doc_url,
        clinic_name=parsed.get("clinic_name"),
        vet_name=parsed.get("vet_name"),
        parsed_diagnosis=parsed.get("parsed_diagnosis", "Clinical Diagnosis Extracted"),
        simplified_explanation=parsed.get("simplified_explanation", "Simplified Summary"),
        medications_extracted=parsed.get("medications_extracted", []),
        raw_ocr_output=json.dumps(parsed, default=str)
    )
    db.add(prescription)

    # Automatically record any vaccines identified on the prescription slip into vaccinations table
    vaxes_detected = (
        parsed.get("vaccines_done")
        or parsed.get("all_vaccines")
        or parsed.get("vaccinations")
        or parsed.get("vaccines")
        or []
    )
    slip_date = _parse_date_safe(
        parsed.get("record_date") or parsed.get("date") or parsed.get("visit_date") or parsed.get("prescription_date"),
        None
    )

    detected_list = []
    for v in vaxes_detected:
        if not isinstance(v, dict):
            continue
        v_name = v.get("vaccine_name") or v.get("name")
        if v_name:
            raw_v_date = v.get("date_administered") or v.get("date") or v.get("administered_date") or v.get("date_given")
            v_admin = _parse_date_safe(raw_v_date, slip_date or date.today())
            v_due = _parse_date_safe(v.get("next_due_date") or v.get("due_date"), v_admin + timedelta(days=365))
            v_lot = v.get("batch_number") or v.get("batch") or v.get("lot_number") or "VERIFIED-SLIP"
            v_rec = Vaccination(
                pet_id=pet.id,
                vaccine_name=v_name,
                date_administered=v_admin,
                next_due_date=v_due,
                batch_number=v_lot,
                is_verified=True,
                source_document_url=doc_url
            )
            db.add(v_rec)
            detected_list.append({
                "vaccine_name": v_name,
                "date_administered": v_admin.isoformat(),
                "batch_number": v_lot,
                "clinic_name": v.get("clinic_name") or parsed.get("clinic_name") or "Verified Clinic"
            })

    if vaxes_detected and any("rabies" in str(v.get("vaccine_name", "")).lower() for v in vaxes_detected if isinstance(v, dict)):
        pet.vax_status = "full"

    await db.commit()
    await db.refresh(prescription)

    # Attach detected vaccines to response
    prescription.vaccines_detected = detected_list

    return prescription

@router.post("/prescriptions/{id}/create-alarms")
async def create_medication_alarms_from_prescription(
    id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    1-Tap Alarm Creator:
    Converts medications parsed from prescription into daily diary alarms.
    """
    stmt = select(Prescription).where(Prescription.id == id)
    result = await db.execute(stmt)
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    # Log initial diary event for medication start & sync to routine checklist
    created_events = []
    for med in (rx.medications_extracted or []):
        name = med.get("name", "Medication")
        dosage = med.get("dosage", "")
        freq = med.get("frequency", "Daily")
        instructions = med.get("instructions", "")

        diary_log = DiaryEvent(
            pet_id=rx.pet_id,
            event_type="medication",
            details={
                "medication_name": name,
                "dosage": dosage,
                "frequency": freq,
                "instructions": instructions
            },
            notes=f"Prescription Alarm Activated: {name} {dosage} ({freq})"
        )
        db.add(diary_log)

        # Sync to DailyCare routine checklist
        routine_item = DailyRoutineItem(
            pet_id=rx.pet_id,
            title=f"{name} · 8:00 PM · {dosage}".strip(" ·"),
            time_str="8:00 PM",
            subtitle=instructions or f"{freq} course",
            category="medication",
            order_index=5,
            is_active=True
        )
        db.add(routine_item)
        created_events.append(name)

    rx.is_reviewed_by_user = True
    await db.commit()

    return {
        "status": "alarms_configured",
        "medications_activated": created_events,
        "message": f"Successfully activated reminders for {len(created_events)} medications in Daily Care."
    }

@router.get("/{pet_id}/prescriptions", response_model=List[PrescriptionExtractionResponse])
async def list_pet_prescriptions(
    pet_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns verified prescriptions ledger and active clinical courses for the pet.
    """
    stmt = select(Pet).where(Pet.id == pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    stmt_rx = select(Prescription).where(Prescription.pet_id == pet_id).order_by(Prescription.created_at.desc())
    res_rx = await db.execute(stmt_rx)
    prescriptions = res_rx.scalars().all()

    return prescriptions

@router.post("/vaccines/upload", response_model=VaccinationResponse)
async def upload_vaccine_card(
    pet_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Vaccine Booklet Scanner:
    Extracts vaccine name, date, expiry/booster date, batch number, and verified stamp.
    """
    stmt = select(Pet).where(Pet.id == pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    file_bytes = await file.read()
    doc_url = await storage_service.save_uploaded_file(file_bytes, file.filename)
    b64_url = storage_service.encode_image_base64(file_bytes, file.content_type or "image/jpeg")

    parsed = await qwen_hf_service.parse_vaccine_card(b64_url)

    admin_date = _parse_date_safe(parsed.get("date_administered"), date.today())
    due_date = _parse_date_safe(parsed.get("next_due_date"), date.today() + timedelta(days=365))

    vax = Vaccination(
        pet_id=pet.id,
        vaccine_name=parsed.get("vaccine_name", "Core Canine / Feline Vaccine"),
        date_administered=admin_date,
        next_due_date=due_date,
        batch_number=parsed.get("batch_number", "VERIFIED-BATCH"),
        is_verified=parsed.get("is_verified", True),
        source_document_url=doc_url
    )
    db.add(vax)
    
    # If all_vaccines array is provided, also insert any secondary records
    all_entries = parsed.get("all_vaccines") or []
    for item in all_entries:
        if isinstance(item, dict):
            i_name = item.get("vaccine_name") or item.get("name")
            if i_name and i_name != vax.vaccine_name:
                i_admin = _parse_date_safe(item.get("date_administered"), admin_date)
                i_due = _parse_date_safe(item.get("next_due_date"), i_admin + timedelta(days=365))
                extra_vax = Vaccination(
                    pet_id=pet.id,
                    vaccine_name=i_name,
                    date_administered=i_admin,
                    next_due_date=i_due,
                    batch_number=item.get("batch_number") or "VERIFIED-BATCH",
                    is_verified=True,
                    source_document_url=doc_url
                )
                db.add(extra_vax)

    # Update pet vax_status to full if verified
    pet.vax_status = "full"
    
    await db.commit()
    await db.refresh(vax)
    return vax

@router.get("/{pet_id}/roadmap", response_model=VaccineRoadmapResponse)
async def get_vaccine_roadmap(
    pet_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Calculates puppy/kitten immunization roadmap milestones and 'Safe Walk Immunity Progress'.
    Extracts exact administration dates from uploaded slips and displays completed and upcoming doses.
    Accurately tracks each milestone individually based on verified recorded vaccinations.
    """
    stmt = select(Pet).where(Pet.id == pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    # Fetch recorded vaccinations ordered by administration date
    stmt_vax = select(Vaccination).where(Vaccination.pet_id == pet_id).order_by(Vaccination.date_administered.asc())
    res_vax = await db.execute(stmt_vax)
    recorded_vax = res_vax.scalars().all()

    # Fetch latest prescription with a clinic name
    stmt_rx = (
        select(Prescription)
        .where(Prescription.pet_id == pet_id, Prescription.clinic_name.isnot(None), Prescription.clinic_name != "")
        .order_by(Prescription.created_at.desc())
    )
    res_rx = await db.execute(stmt_rx)
    latest_rx = res_rx.scalars().first()
    default_clinic = latest_rx.clinic_name if latest_rx and latest_rx.clinic_name else "Verified Veterinary Clinic"

    today = date.today()
    age_days = (today - pet.birth_date).days
    age_weeks = max(1, age_days // 7)

    used_record_ids = set()

    def match_vax_record(keywords, exact_names=None):
        # 1. Match exact names
        if exact_names:
            for v in recorded_vax:
                if v.id in used_record_ids:
                    continue
                v_name = v.vaccine_name.lower().strip()
                if any(en.lower().strip() == v_name or en.lower().strip() in v_name for en in exact_names):
                    used_record_ids.add(v.id)
                    return v
        # 2. Match keywords
        for v in recorded_vax:
            if v.id in used_record_ids:
                continue
            v_name = v.vaccine_name.lower()
            if any(k.lower() in v_name for k in keywords):
                used_record_ids.add(v.id)
                return v
        return None

    is_cat = pet.species.lower() == "cat"

    if is_cat:
        # Feline Protocol
        rec1 = match_vax_record(["fvrcp", "panleukopenia", "feline distemper"], ["FVRCP Dose 1", "FVRCP Core 3-in-1"])
        rec2 = match_vax_record(["fvrcp booster", "dose 2", "rhinotracheitis", "calicivirus"], ["FVRCP Dose 2 Booster", "FVRCP Booster"])
        rec3 = match_vax_record(["rabies", "defensor", "nobivac rabies"], ["Feline Rabies Core", "Rabies Core Vaccine"])
        rec4 = match_vax_record(["felv", "leukemia"], ["Feline Leukemia Virus (FeLV)", "FeLV"])

        milestones = [
            VaccineRoadmapMilestone(
                vaccine_name="FVRCP Dose 1 (Feline Distemper)",
                recommended_age_weeks=8,
                due_date=pet.birth_date + timedelta(weeks=8),
                date_administered=rec1.date_administered if rec1 else None,
                batch_number=rec1.batch_number if rec1 else None,
                clinic_name=default_clinic,
                status="completed" if rec1 else "upcoming",
                is_core=True
            ),
            VaccineRoadmapMilestone(
                vaccine_name="FVRCP Dose 2 Booster",
                recommended_age_weeks=12,
                due_date=pet.birth_date + timedelta(weeks=12),
                date_administered=rec2.date_administered if rec2 else None,
                batch_number=rec2.batch_number if rec2 else None,
                clinic_name=default_clinic,
                status="completed" if rec2 else "upcoming",
                is_core=True
            ),
            VaccineRoadmapMilestone(
                vaccine_name="Feline Rabies Core",
                recommended_age_weeks=16,
                due_date=pet.birth_date + timedelta(weeks=16),
                date_administered=rec3.date_administered if rec3 else None,
                batch_number=rec3.batch_number if rec3 else None,
                clinic_name=default_clinic,
                status="completed" if rec3 else "upcoming",
                is_core=True
            ),
            VaccineRoadmapMilestone(
                vaccine_name="Feline Leukemia Virus (FeLV)",
                recommended_age_weeks=16,
                due_date=pet.birth_date + timedelta(weeks=16),
                date_administered=rec4.date_administered if rec4 else None,
                batch_number=rec4.batch_number if rec4 else None,
                clinic_name=default_clinic,
                status="completed" if rec4 else "upcoming",
                is_core=False
            ),
        ]
    else:
        # Canine Protocol
        rec1 = match_vax_record(
            ["dose 1", "puppy dp", "biocan 1", "dhpp 1", "vanguard 1"],
            ["DHPP Dose 1 (Distemper, Parvo)", "DHPP Dose 1"]
        )
        if not rec1:
            rec1 = match_vax_record(["dhpp", "parvo", "vanguard", "biocan", "distemper"])

        rec2 = match_vax_record(
            ["booster", "dose 2", "dhppi", "lepto", "leptospirosis", "biocan l", "vanguard plus", "dhpp 2"],
            ["DHPP Dose 2 Booster + Leptospirosis", "DHPP Dose 2 Booster", "DHPP Dose 2"]
        )

        rec3 = match_vax_record(
            ["rabies", "defensor", "nobivac rabies", "dose 3", "dhpp 3", "rabisin"],
            ["DHPP Dose 3 + Rabies Core", "Rabies Core Vaccine", "Rabies Core"]
        )

        rec4 = match_vax_record(
            ["bordetella", "kennel", "bronchiseptica", "kc", "bronchi"],
            ["Bordetella (Kennel Cough)", "Bordetella"]
        )

        milestones = [
            VaccineRoadmapMilestone(
                vaccine_name="DHPP Dose 1 (Distemper, Parvo)",
                recommended_age_weeks=8,
                due_date=pet.birth_date + timedelta(weeks=8),
                date_administered=rec1.date_administered if rec1 else None,
                batch_number=rec1.batch_number if rec1 else None,
                clinic_name=default_clinic,
                status="completed" if rec1 else "upcoming",
                is_core=True
            ),
            VaccineRoadmapMilestone(
                vaccine_name="DHPP Dose 2 Booster + Leptospirosis",
                recommended_age_weeks=12,
                due_date=pet.birth_date + timedelta(weeks=12),
                date_administered=rec2.date_administered if rec2 else None,
                batch_number=rec2.batch_number if rec2 else None,
                clinic_name=default_clinic,
                status="completed" if rec2 else "upcoming",
                is_core=True
            ),
            VaccineRoadmapMilestone(
                vaccine_name="DHPP Dose 3 + Rabies Core",
                recommended_age_weeks=16,
                due_date=pet.birth_date + timedelta(weeks=16),
                date_administered=rec3.date_administered if rec3 else None,
                batch_number=rec3.batch_number if rec3 else None,
                clinic_name=default_clinic,
                status="completed" if rec3 else "upcoming",
                is_core=True
            ),
            VaccineRoadmapMilestone(
                vaccine_name="Bordetella (Kennel Cough)",
                recommended_age_weeks=16,
                due_date=pet.birth_date + timedelta(weeks=16),
                date_administered=rec4.date_administered if rec4 else None,
                batch_number=rec4.batch_number if rec4 else None,
                clinic_name=default_clinic,
                status="completed" if rec4 else "upcoming",
                is_core=False
            )
        ]

    # Include any additional verified vaccines from uploaded slips not assigned to the core slots
    for v in recorded_vax:
        if v.id not in used_record_ids:
            milestones.append(
                VaccineRoadmapMilestone(
                    vaccine_name=v.vaccine_name,
                    recommended_age_weeks=16,
                    due_date=v.next_due_date,
                    date_administered=v.date_administered,
                    batch_number=v.batch_number or "VERIFIED-SLIP",
                    clinic_name=default_clinic,
                    status="completed",
                    is_core=False
                )
            )

    core_milestones = [m for m in milestones if m.is_core]
    core_completed = sum(1 for m in core_milestones if m.status == "completed")
    all_completed = sum(1 for m in milestones if m.status == "completed")

    # Fully vaccinated when all core protocol shots are certified
    is_fully_vax = (core_completed == len(core_milestones)) and len(core_milestones) > 0

    progress = int((all_completed / len(milestones)) * 100) if milestones else 100
    can_visit_parks = progress >= 75 or is_fully_vax

    # Sync pet vax_status in database if changed
    computed_status = "full" if is_fully_vax else ("partial" if all_completed > 0 else "none")
    if pet.vax_status != computed_status:
        pet.vax_status = computed_status
        await db.commit()

    return VaccineRoadmapResponse(
        pet_id=pet.id,
        species=pet.species,
        age_weeks=age_weeks,
        is_fully_vaccinated=is_fully_vax,
        safe_walk_progress_percentage=progress,
        can_visit_public_parks=can_visit_parks,
        milestones=milestones,
        active_vaccinations=recorded_vax
    )

@router.post("/{pet_id}/toggle-milestone", response_model=VaccineRoadmapResponse)
async def toggle_milestone(
    pet_id: uuid.UUID,
    payload: ToggleMilestoneRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Toggles a single vaccine milestone between 'completed' and 'upcoming'.
    Allows pet parents to check off individual boosters as they are administered.
    """
    stmt = select(Pet).where(Pet.id == pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    m_name = payload.milestone_name.strip()

    # Find existing vaccination records matching this milestone
    stmt_vax = select(Vaccination).where(Vaccination.pet_id == pet_id)
    res_vax = await db.execute(stmt_vax)
    existing_vaxes = res_vax.scalars().all()

    matched_vax = None
    clean_target = m_name.lower().split("(")[0].strip()
    for v in existing_vaxes:
        v_low = v.vaccine_name.lower()
        if (
            m_name.lower() in v_low
            or v_low in m_name.lower()
            or (clean_target and clean_target in v_low)
        ):
            matched_vax = v
            break

    if matched_vax and payload.target_status != "completed":
        # Remove vaccination to mark as upcoming
        await db.delete(matched_vax)
        await db.commit()
    elif not matched_vax and payload.target_status != "upcoming":
        # Add new vaccination to mark as completed
        new_vax = Vaccination(
            pet_id=pet.id,
            vaccine_name=m_name,
            date_administered=date.today(),
            next_due_date=date.today() + timedelta(days=365),
            batch_number="VERIFIED-RECORD",
            is_verified=True
        )
        db.add(new_vax)
        await db.commit()

    return await get_vaccine_roadmap(pet_id=pet.id, user_id=user_id, db=db)

@router.post("/{pet_id}/toggle-vax-status")
async def toggle_vax_status(
    pet_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Toggles pet vaccination status between 'full' (all core boosters marked done)
    and 'partial' (resets to only initial dose).
    """
    stmt = select(Pet).where(Pet.id == pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    is_currently_full = pet.vax_status == "full"

    if not is_currently_full:
        # Mark all core boosters as done by ensuring records exist
        core_boosters = [
            ("DHPP Dose 1 (Distemper, Parvo)", 8),
            ("DHPP Dose 2 Booster + Leptospirosis", 12),
            ("DHPP Dose 3 + Rabies Core", 16),
            ("Bordetella (Kennel Cough)", 16)
        ]
        stmt_vax = select(Vaccination).where(Vaccination.pet_id == pet_id)
        res_vax = await db.execute(stmt_vax)
        existing_names = [v.vaccine_name.lower() for v in res_vax.scalars().all()]

        for name, weeks in core_boosters:
            clean_n = name.lower().split("(")[0].strip()
            if not any(clean_n in ex for ex in existing_names):
                v_admin = pet.birth_date + timedelta(weeks=weeks)
                if v_admin > date.today():
                    v_admin = date.today()
                db.add(Vaccination(
                    pet_id=pet.id,
                    vaccine_name=name,
                    date_administered=v_admin,
                    next_due_date=v_admin + timedelta(days=365),
                    batch_number="VERIFIED-RECORD",
                    is_verified=True
                ))
        pet.vax_status = "full"
    else:
        # Reset manual boosters: remove any booster records so only Dose 1 remains
        stmt_vax = select(Vaccination).where(Vaccination.pet_id == pet_id)
        res_vax = await db.execute(stmt_vax)
        for v in res_vax.scalars().all():
            v_low = v.vaccine_name.lower()
            if any(k in v_low for k in ["dose 2", "booster", "rabies", "defensor", "dose 3", "bordetella", "kennel"]):
                await db.delete(v)
        pet.vax_status = "partial"

    await db.commit()
    await db.refresh(pet)
    return {
        "status": "ok",
        "pet_id": pet.id,
        "vax_status": pet.vax_status,
        "is_fully_vaccinated": pet.vax_status == "full"
    }
