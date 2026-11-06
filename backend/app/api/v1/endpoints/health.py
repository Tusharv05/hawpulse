import uuid
import json
import asyncio
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.pet import Pet
from app.models.medical import Prescription, Vaccination
from app.schemas.health import HealthChatRequest, HealthChatResponse, EmergencyTriageAlert
from app.services.guardrails import guardrail_service
from app.services.qwen_hf_service import qwen_hf_service

router = APIRouter(prefix="/health-chat", tags=["AI Pet Health Assistant & Guardrails"])

async def assemble_pet_clinical_context(
    pet: Optional[Pet],
    db: AsyncSession,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Tier 2 Grounding Context Assembly:
    Extracts medical conditions identified by prescription and vaccines identification
    directly from verified clinical records in the database.
    """
    if pet:
        pet_species = pet.species or "dog"
        pet_name = pet.name or "your pet"
        pet_breed = pet.breed or "mixed breed"
        pet_weight = float(pet.weight_kg) if pet.weight_kg is not None else 10.0
        pet_allergies = pet.allergies or []
        pet_id_val = pet.id
        pet_vax_status = pet.vax_status or "in_progress"
        owner_id_str = str(pet.owner_id) if getattr(pet, "owner_id", None) else (user_id or "")
    else:
        pet_species = "dog"
        pet_name = "your pet"
        pet_breed = "mixed breed"
        pet_weight = 10.0
        pet_allergies = []
        pet_id_val = None
        pet_vax_status = "in_progress"
        owner_id_str = user_id or ""

    conditions: List[str] = []
    medications: List[str] = []
    all_diagnoses: List[str] = []
    administered_vaxes: List[str] = []
    probable_next: List[str] = []
    can_visit_parks = False
    progress_pct = 0

    if pet_id_val:
        # 1. Prescriptions & Medical Conditions Identified by Prescription
        stmt_rx = select(Prescription).where(Prescription.pet_id == pet_id_val).order_by(Prescription.created_at.desc())
        res_rx = await db.execute(stmt_rx)
        rxs = res_rx.scalars().all()

        for rx in rxs:
            diag = (rx.parsed_diagnosis or "").strip()
            if diag and diag not in all_diagnoses:
                all_diagnoses.append(diag)
            # Filter specifically for diagnosed clinical medical conditions
            if diag and diag not in ["Routine Vaccination", "Routine Vaccination Schedule", "Prescription & Immunization Health Slip"] and diag not in conditions:
                conditions.append(diag)

            for m in (rx.medications_extracted or []):
                if isinstance(m, dict):
                    m_name = m.get("name", "").strip()
                    m_dose = m.get("dosage", "").strip()
                    m_freq = m.get("frequency", "").strip()
                    m_inst = m.get("instructions", "").strip()
                    parts = [p for p in [m_dose, m_freq] if p]
                    dose_info = f" ({', '.join(parts)})" if parts else ""
                    med_summary = f"{m_name}{dose_info}".strip()
                    if m_inst:
                        med_summary += f" - {m_inst}"
                    if med_summary and med_summary not in medications:
                        medications.append(med_summary)

        # 2. Vaccines Identification (Administered & Verified)
        stmt_vax = select(Vaccination).where(Vaccination.pet_id == pet_id_val).order_by(Vaccination.date_administered.asc())
        res_vax = await db.execute(stmt_vax)
        vaxes = res_vax.scalars().all()

        for v in vaxes:
            v_date = v.date_administered.isoformat() if hasattr(v.date_administered, "isoformat") else str(v.date_administered)
            v_due = v.next_due_date.isoformat() if hasattr(v.next_due_date, "isoformat") else str(v.next_due_date)
            administered_vaxes.append(f"{v.vaccine_name} (Administered: {v_date}, Due: {v_due})")

        # 3. Vaccine Roadmap & Upcoming Boosters
        try:
            from app.api.v1.endpoints.medical import get_vaccine_roadmap
            roadmap = await get_vaccine_roadmap(pet_id=pet_id_val, user_id=owner_id_str, db=db)
            for m in roadmap.milestones:
                if m.status != "completed":
                    due_str = f"Due: {m.due_date}" if m.due_date else f"Target: ~Week {m.recommended_age_weeks}"
                    probable_next.append(f"{m.vaccine_name} ({due_str}, Status: {m.status})")
            can_visit_parks = roadmap.can_visit_public_parks
            progress_pct = roadmap.safe_walk_progress_percentage
            if roadmap.is_fully_vaccinated:
                pet_vax_status = "full"
            elif administered_vaxes:
                pet_vax_status = "partial"
        except Exception:
            can_visit_parks = (pet_vax_status == "full")
            progress_pct = 100 if pet_vax_status == "full" else (50 if pet_vax_status == "partial" else 0)

    # If specific conditions weren't isolated, fall back to any parsed diagnosis
    active_conditions = conditions if conditions else all_diagnoses
    conditions_summary = ", ".join(active_conditions) if active_conditions else "None on record"
    medications_summary = "; ".join(medications[:5]) if medications else "No active prescription medications"
    active_rx_summary = ", ".join(all_diagnoses) if all_diagnoses else "None"
    vaxes_summary = ", ".join(administered_vaxes) if administered_vaxes else "None recorded"
    probable_vaxes_summary = ", ".join(probable_next) if probable_next else "All core immunization milestones completed"

    return {
        "name": pet_name,
        "species": pet_species,
        "breed": pet_breed,
        "weight_kg": pet_weight,
        "allergies": pet_allergies,
        "medical_conditions": active_conditions,
        "medical_conditions_summary": conditions_summary,
        "medications": medications,
        "medications_summary": medications_summary,
        "active_prescriptions_summary": active_rx_summary,
        "vaccines_identified": administered_vaxes,
        "vaccines_identified_summary": vaxes_summary,
        "probable_next_vaccines": probable_next,
        "probable_next_vaccines_summary": probable_vaxes_summary,
        "vax_status": pet_vax_status,
        "can_visit_public_parks": can_visit_parks,
        "safe_walk_progress_percentage": progress_pct
    }

@router.post("", response_model=HealthChatResponse)
async def chat_with_health_assistant(
    payload: HealthChatRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Conversational Pet Health Assistant with 4-Tier Guardrails:
    1. Pre-Retrieval Poison/Emergency Triage
    2. Context Grounding with Medical Conditions (Prescriptions) & Vaccines Identification
    3. Google Research Harness² + Gemini Inference
    4. Post-Generation Output Guardrails (Anti-hallucination, Disclaimers)
    """
    # Resolve pet details robustly
    pet = None
    target_uuid = None
    if payload.pet_id:
        try:
            target_uuid = uuid.UUID(str(payload.pet_id))
        except (ValueError, TypeError):
            pass

    if target_uuid:
        # First check if user owns this pet
        stmt = select(Pet).where(Pet.id == target_uuid, Pet.owner_id == uuid.UUID(user_id))
        pet = (await db.execute(stmt)).scalar_one_or_none()

        # If not, check if pet exists by ID alone
        if not pet:
            stmt_id = select(Pet).where(Pet.id == target_uuid)
            pet = (await db.execute(stmt_id)).scalar_one_or_none()

    # Fallback to user's first registered pet
    if not pet:
        stmt_user = select(Pet).where(Pet.owner_id == uuid.UUID(user_id))
        pet = (await db.execute(stmt_user)).scalars().first()

    pet_species = pet.species if pet and pet.species else "dog"

    # TIER 1 GUARDRAIL: Pre-retrieval emergency toxicity triage
    is_emergency, triage_alert = guardrail_service.pre_retrieval_emergency_triage(
        payload.message, species=pet_species
    )
    if is_emergency:
        return HealthChatResponse(
            answer=(
                f"🚨 **EMERGENCY HEALTH ALERT: POTENTIAL TOXIN INGESTION**\n\n"
                f"{triage_alert.immediate_action}\n\n"
                f"📞 **Immediate Action:** Contact {triage_alert.hotlines[0]['name']} at {triage_alert.hotlines[0]['phone']} or proceed to your nearest 24/7 veterinary emergency hospital immediately."
            ),
            triage=triage_alert,
            grounded_context_summary=None
        )

    # TIER 0 GUARDRAIL: Domain scope deflection (detect out-of-scope non-pet queries)
    is_out_of_scope, refusal_message = guardrail_service.check_domain_scope(payload.message)
    if is_out_of_scope and refusal_message:
        return HealthChatResponse(
            answer=refusal_message,
            triage=EmergencyTriageAlert(is_emergency=False),
            grounded_context_summary=None
        )

    # TIER 2 GUARDRAIL: Context assembly from both medical conditions (prescriptions) and vaccines identification
    pet_context = await assemble_pet_clinical_context(pet=pet, db=db, user_id=user_id)

    # TIER 3 & 4 GUARDRAIL: Harness² + Gemini execution + post-generation filtering
    history_dicts = [{"role": m.role, "content": m.content} for m in payload.chat_history]
    answer = await qwen_hf_service.chat_health_assistant(
        pet_context=pet_context,
        user_message=payload.message,
        chat_history=history_dicts
    )

    return HealthChatResponse(
        answer=answer,
        triage=triage_alert,
        grounded_context_summary=None
    )

@router.post("/stream")
async def stream_health_chat(
    payload: HealthChatRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Server-Sent Events (SSE) streaming endpoint for conversational health chat.
    """
    stmt = select(Pet).where(Pet.id == payload.pet_id, Pet.owner_id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    # Check emergency triage first
    is_emergency, triage_alert = guardrail_service.pre_retrieval_emergency_triage(
        payload.message, species=pet.species
    )

    async def event_generator():
        if is_emergency:
            emergency_chunk = {
                "chunk": (
                    f"🚨 **CRITICAL HEALTH ALERT**: {triage_alert.immediate_action}\n\n"
                    f"Hotline: {triage_alert.hotlines[0]['name']} - {triage_alert.hotlines[0]['phone']}"
                ),
                "is_emergency": True
            }
            yield f"data: {json.dumps(emergency_chunk)}\n\n"
            return

        pet_context = await assemble_pet_clinical_context(pet=pet, db=db, user_id=user_id)
        
        full_answer = await qwen_hf_service.chat_health_assistant(
            pet_context=pet_context,
            user_message=payload.message,
            chat_history=[{"role": m.role, "content": m.content} for m in payload.chat_history]
        )

        # Stream words smoothly
        words = full_answer.split(" ")
        for i in range(0, len(words), 3):
            chunk = " ".join(words[i:i+3]) + " "
            yield f"data: {json.dumps({'chunk': chunk, 'is_emergency': False})}\n\n"
            await asyncio.sleep(0.04)

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
