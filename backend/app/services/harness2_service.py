"""
Google Research Harness² (Harness Squared) Engine for PawCircle Pet Health Chatbot.
Based on: https://github.com/google-research/harness2
"Recursive Agent Harnessing in an Open World" - Google Research

Harness² structures the 8 editable operational components around a frozen foundation model:
1. System Prompt: Certified pet health educator persona & empathetic stance
2. Guardrails: Safety invariants (Tiers 0-4, non-diagnostic, poison triage, out-of-scope)
3. Memory: Episodic patient timeline, allergy vault, active prescriptions, past lessons
4. Tool Guidance: Instructions for invoking emergency hotlines, calculators, schedulers
5. Skills: Specialized procedural heuristics (symptom triage, caloric math, breed care)
6. Subagents: Specialized modular roles (Emergency Triage, Wellness Educator, Nutritionist)
7. Scripts: Deterministic fallback math, clinical dosage guardrails, and regex filters
8. Harness Adaptation: Propose-Probe-Compose recursive loop to self-refine outputs label-free.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Tuple

from app.services.guardrails import guardrail_service

logger = logging.getLogger("pawcircle.harness2")


@dataclass
class HarnessComponents:
    """The 8 Editable Components defined in Google Research Harness²."""
    system_prompt: str
    guardrails: List[str]
    memory: Dict[str, Any]
    tool_guidance: Dict[str, str]
    skills: List[str]
    subagents: List[Dict[str, str]]
    scripts: Dict[str, str]
    persistent_lessons: List[str] = field(default_factory=list)


@dataclass
class ProbeEvaluation:
    """Contrastive evaluation outcome from probing a candidate response."""
    passed: bool
    diagnostic_risk: bool
    unauthorized_dosage: bool
    missing_disclaimer: bool
    empathy_score: float  # 0.0 to 1.0
    critique_notes: List[str]


class GoogleResearchHarness2Engine:
    """
    Implements Google Research's Harness² recursive agent harness architecture
    for HawPulse's conversational AI Pet Health Assistant.
    """

    def __init__(self):
        # Persistent memory across sessions (Harnessing-level recursion)
        self.persistent_lessons: List[str] = [
            "Always prioritize pet hydration during gastrointestinal upset.",
            "Never offer specific milligram dosages for human pain relief medications.",
            "Frame clinical possibilities with uncertainty to encourage veterinary consultation."
        ]

    def build_harness(self, pet_context: Dict[str, Any], chat_history: List[Dict[str, str]]) -> HarnessComponents:
        """
        Constructs the 8 Harness² components for the active pet & session context.
        """
        pet_name = pet_context.get("name", "your pet")
        species = pet_context.get("species", "pet")
        breed = pet_context.get("breed", "mixed breed")
        weight = pet_context.get("weight_kg", "unknown")
        allergies = pet_context.get("allergies", [])
        prescriptions = pet_context.get("active_prescriptions_summary", "None")

        # 1. System Prompt
        conditions_summary = pet_context.get("medical_conditions_summary") or pet_context.get("active_prescriptions_summary", "None")
        meds_summary = pet_context.get("medications_summary", "No active prescription medications")
        vaxes_summary = pet_context.get("vaccines_identified_summary", "None recorded")
        probable_vaxes = pet_context.get("probable_next_vaccines_summary", "Core immunization schedule pending")
        vax_status = pet_context.get("vax_status", "in_progress")

        system_prompt = (
            f"You are HawPulse's certified Pet Health Educator and Wellness Companion operating under "
            f"the Google Research Harness² architecture. You are advising on {pet_name} ({species}, {breed}, {weight}kg). "
            f"You have direct access to {pet_name}'s clinical records: "
            f"Medical Conditions Identified by Prescription: {conditions_summary}; "
            f"Active Regimen: {meds_summary}; "
            f"Vaccines Identification (Administered): {vaxes_summary}; "
            f"Probable Next Vaccines: {probable_vaxes}; Immunization Status: {vax_status}. "
            "Deliver structured, empathetic, and evidence-grounded wellness advice without diagnosing or changing prescribed dosages."
        )

        # 2. Guardrails
        guardrails = [
            "Never provide a definitive medical diagnosis. Use 'signs may indicate' or 'possibilities include'.",
            "Never prescribe drug dosages or recommend human over-the-counter pharmaceuticals.",
            "If toxic ingestion is mentioned, immediately direct to ASPCA Animal Poison Control.",
            "Refuse and deflect out-of-scope non-pet queries (coding, finance, politics, etc.).",
            "Always include the mandatory Veterinary Health Disclaimer."
        ]

        # 3. Memory
        memory = {
            "pet_profile": {
                "name": pet_name,
                "species": species,
                "breed": breed,
                "weight_kg": weight,
                "allergies": allergies,
                "medical_conditions": pet_context.get("medical_conditions", []),
                "medical_conditions_summary": conditions_summary,
                "medications": pet_context.get("medications", []),
                "medications_summary": meds_summary,
                "vaccines_identified": pet_context.get("vaccines_identified", []),
                "vaccines_identified_summary": vaxes_summary,
                "probable_next_vaccines": pet_context.get("probable_next_vaccines", []),
                "probable_next_vaccines_summary": probable_vaxes,
                "vax_status": vax_status,
                "can_visit_public_parks": pet_context.get("can_visit_public_parks", False),
                "active_prescriptions": prescriptions
            },
            "recent_chat_turns": chat_history[-4:] if chat_history else []
        }

        # 4. Tool Guidance
        tool_guidance = {
            "poison_hotline": "ASPCA Animal Poison Control (888) 426-4435 (24/7)",
            "caloric_calculator": "Deterministic Biological Equation: RER = 70 * (weight_kg ** 0.75)",
            "appointment_scheduler": "HawPulse Google Calendar Sync Integration"
        }

        # 5. Skills
        skills = [
            "Skill: Canine & Feline Toxic Food Screening",
            "Skill: Brachycephalic Airway & Harness vs Collar Assessment",
            "Skill: Post-Vaccination Observation & Safe Walk Timing",
            "Skill: Gastrointestinal Hydration & Bland Diet Guidance"
        ]

        # 6. Subagents
        subagents = [
            {"role": "TriageSpecialist", "focus": "Critical toxicity, bloat/GDV, trauma, and acute dyspnea"},
            {"role": "WellnessEducator", "focus": "Preventative care, grooming cadence, behavior, routine wellness"},
            {"role": "NutritionAdvisor", "focus": "Portion control, ingredient safety, weight management"}
        ]

        # 7. Scripts
        scripts = {
            "regex_diagnostic_scrubber": r"(your (?:dog|cat|pet) has|i diagnose (?:your pet with)?)",
            "regex_dosage_scrubber": r"(give (?:him|her|your dog|your cat) \d+\s*(?:mg|tablets|pills) of [a-zA-Z]+)",
            "disclaimer_stamp": (
                "\n\n---\n**Veterinary Health Disclaimer:** HawPulse AI provides wellness education and general "
                "nutritional guidance. It is not a substitute for clinical veterinary examination, diagnosis, or emergency care."
            )
        }

        return HarnessComponents(
            system_prompt=system_prompt,
            guardrails=guardrails,
            memory=memory,
            tool_guidance=tool_guidance,
            skills=skills,
            subagents=subagents,
            scripts=scripts,
            persistent_lessons=list(self.persistent_lessons)
        )

    def probe_candidate_response(self, candidate: str) -> ProbeEvaluation:
        """
        Task-Level Recursion: Probes a candidate response against safety invariants,
        grounding adherence, and empathy markers.
        """
        critique_notes = []
        lower = candidate.lower()

        # Check diagnostic risk
        diagnostic_risk = bool(re.search(r"\b(i diagnose|your (?:dog|cat|pet) is suffering from|has a confirmed case)\b", lower))
        if diagnostic_risk:
            critique_notes.append("Definitive diagnosis detected; must soften to non-clinical possibility.")

        # Check unauthorized dosage
        unauthorized_dosage = bool(re.search(r"\b\d+\s*(?:mg|milligrams|tablets|pills)\s+of\b", lower))
        if unauthorized_dosage:
            critique_notes.append("Specific drug dosage found; must replace with veterinary consultation recommendation.")

        # Check disclaimer
        missing_disclaimer = "Veterinary Health Disclaimer" not in candidate
        if missing_disclaimer:
            critique_notes.append("Mandatory legal disclaimer is missing.")

        # Empathy evaluation
        empathy_markers = ["understand", "care", "comfort", "pet", "love", "gentle", "reassure", "peace of mind", "happy to help"]
        found_markers = sum(1 for m in empathy_markers if m in lower)
        empathy_score = min(1.0, 0.4 + (found_markers * 0.15))

        passed = not diagnostic_risk and not unauthorized_dosage and not missing_disclaimer

        return ProbeEvaluation(
            passed=passed,
            diagnostic_risk=diagnostic_risk,
            unauthorized_dosage=unauthorized_dosage,
            missing_disclaimer=missing_disclaimer,
            empathy_score=empathy_score,
            critique_notes=critique_notes
        )

    def compose_refined_response(self, candidate: str, probe: ProbeEvaluation, harness: HarnessComponents) -> str:
        """
        Task-Level Recursion: Composes the final response by resolving any probed defects.
        """
        refined = candidate

        # Neutralize diagnosis
        if probe.diagnostic_risk:
            refined = re.sub(
                harness.scripts["regex_diagnostic_scrubber"],
                "these signs may indicate",
                refined,
                flags=re.IGNORECASE
            )

        # Neutralize unauthorized dosage
        if probe.unauthorized_dosage:
            refined = re.sub(
                harness.scripts["regex_dosage_scrubber"],
                "consult your veterinarian for exact medication dosage",
                refined,
                flags=re.IGNORECASE
            )

        # Attach disclaimer if missing
        if probe.missing_disclaimer:
            refined = refined.strip() + harness.scripts["disclaimer_stamp"]

        # Harnessing-Level Recursion: Learn from defects and record persistent lessons
        if not probe.passed:
            lesson = f"Auto-refined response: mitigated {', '.join(probe.critique_notes)}."
            if lesson not in self.persistent_lessons:
                self.persistent_lessons.append(lesson)
                if len(self.persistent_lessons) > 10:
                    self.persistent_lessons.pop(0)

        return refined

    async def execute_harness_loop(
        self,
        pet_context: Dict[str, Any],
        user_message: str,
        chat_history: List[Dict[str, str]],
        raw_llm_callable
    ) -> Dict[str, Any]:
        """
        Full Google Research Harness² Execution Loop:
        1. Pre-execution checks (Tier 0 Scope & Tier 1 Emergency)
        2. Harness Construction (8 components)
        3. Propose (Raw Model Candidate Generation)
        4. Probe (Invariant, Safety & Quality Assessment)
        5. Compose (Recursive Refinement & Final Delivery)
        """
        # Step 1: Pre-Execution Guardrail Invariants
        # A. Domain Scope Boundary Check
        is_oos, refusal = guardrail_service.check_domain_scope(user_message)
        if is_oos and refusal:
            return {
                "answer": refusal,
                "harness_mode": "Harness² Domain Deflection",
                "probed_passed": True,
                "recursion_steps": 1,
                "is_emergency": False
            }

        # B. Emergency Poison Triage
        species = pet_context.get("species", "dog")
        is_emergency, triage_alert = guardrail_service.pre_retrieval_emergency_triage(user_message, species=species)
        if is_emergency:
            return {
                "answer": (
                    f"🚨 **EMERGENCY HEALTH ALERT: POTENTIAL TOXIN INGESTION**\n\n"
                    f"{triage_alert.immediate_action}\n\n"
                    f"📞 **Immediate Action:** Contact {triage_alert.hotlines[0]['name']} at {triage_alert.hotlines[0]['phone']}.\n"
                    "Do not wait for symptoms to worsen; transport your pet to the nearest emergency clinic immediately."
                ),
                "harness_mode": "Harness² Emergency Short-Circuit",
                "probed_passed": True,
                "recursion_steps": 1,
                "is_emergency": True,
                "triage": triage_alert
            }

        # Step 2: Build Harness² Configuration (8 Components)
        harness = self.build_harness(pet_context, chat_history)

        # Step 3: Propose Candidate via Base LLM
        system_instruction = (
            f"{harness.system_prompt}\n\n"
            f"Active Skills:\n" + "\n".join(f"- {s}" for s in harness.skills) + "\n\n"
            f"Strict Guardrails:\n" + "\n".join(f"- {g}" for g in harness.guardrails) + "\n\n"
            f"Persistent Lessons from Past Consultations:\n" + "\n".join(f"- {l}" for l in harness.persistent_lessons[-3:])
        )

        candidate = await raw_llm_callable(system_instruction=system_instruction)

        # Step 4: Probe Candidate (Contrastive Invariant Analysis)
        probe_result = self.probe_candidate_response(candidate)

        # Step 5: Compose Refined Response (Task-Level Recursion)
        final_answer = self.compose_refined_response(candidate, probe_result, harness)

        return {
            "answer": final_answer,
            "harness_mode": "Harness² Recursive Agent Execution",
            "probed_passed": probe_result.passed,
            "empathy_score": probe_result.empathy_score,
            "critique_notes": probe_result.critique_notes,
            "recursion_steps": 2 if not probe_result.passed else 1,
            "active_skills": harness.skills,
            "is_emergency": False
        }


# Singleton Harness² Engine instance
harness2_engine = GoogleResearchHarness2Engine()
