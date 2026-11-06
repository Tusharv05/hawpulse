import re
from typing import Dict, Any, List, Tuple, Optional
from app.schemas.health import EmergencyTriageAlert

# Tier 1: Emergency Red-Flag Lexicon & Toxins
EMERGENCY_KEYWORDS = {
    "chocolate": ("Chocolate / Theobromine toxicity", "critical"),
    "cocoa": ("Chocolate / Theobromine toxicity", "critical"),
    "xylitol": ("Xylitol artificial sweetener (severe hypoglycemia & liver failure)", "critical"),
    "birch bark": ("Xylitol toxicity", "critical"),
    "lilies": ("Lily toxicity (causes acute kidney failure in felines)", "critical"),
    "lily": ("Lily toxicity (causes acute kidney failure in felines)", "critical"),
    "antifreeze": ("Ethylene glycol poisoning", "critical"),
    "rat poison": ("Rodenticide anticoagulant toxicity", "critical"),
    "rodenticide": ("Rodenticide anticoagulant toxicity", "critical"),
    "paracetamol": ("Acetaminophen / Tylenol toxicity (lethal to cats)", "critical"),
    "tylenol": ("Acetaminophen / Tylenol toxicity", "critical"),
    "ibuprofen": ("NSAID severe toxicity", "critical"),
    "advil": ("NSAID severe toxicity", "critical"),
    "bloat": ("Possible Gastric Dilatation-Volvulus (GDV/Bloat)", "critical"),
    "twisted stomach": ("Possible Gastric Dilatation-Volvulus (GDV)", "critical"),
    "seizure": ("Acute neurologic seizure episode", "urgent"),
    "unconscious": ("Loss of consciousness / collapse", "critical"),
    "difficulty breathing": ("Dyspnea / Respiratory distress", "critical"),
    "choking": ("Airway obstruction", "critical"),
    "hit by car": ("Acute vehicular trauma", "critical"),
}

STANDARD_EMERGENCY_HOTLINES = [
    {
        "name": "ASPCA Animal Poison Control Center",
        "phone": "(888) 426-4435",
        "availability": "24/7/365 US & International"
    },
    {
        "name": "Pet Poison Helpline",
        "phone": "(855) 764-7661",
        "availability": "24/7 Veterinary Toxicologist"
    }
]

MANDATORY_DISCLAIMER = (
    "\n\n---\n**Veterinary Health Disclaimer:** HawPulse AI provides wellness education and general nutritional guidance. "
    "It is not a substitute for clinical veterinary examination, diagnosis, or emergency care."
)

OUT_OF_SCOPE_REFUSAL = (
    "🐾 **HawPulse Scope Notice:** I am your dedicated Pet Health, Nutrition & Wellness Assistant.\n\n"
    "I can only help with questions related to dogs, cats, pet care, animal nutrition, behavior, "
    "and veterinary wellness. I cannot assist with topics outside of pet care (such as programming, "
    "finance, politics, homework, or general inquiries).\n\n"
    "👉 *Please feel free to ask anything about your pet's diet, symptoms, daily routine, or wellness!*"
)

# Common explicit non-pet indicators (checked when pet context is absent)
OUT_OF_SCOPE_PATTERNS = [
    r"\b(write|create|generate|debug|explain)\s+(?:python|javascript|typescript|c\+\+|java|html|css|sql|rust|code|script|regex|function|class|api|docker)\b",
    r"\b(stock|crypto|bitcoin|ethereum|btc|eth|forex|invest|trading|portfolio|dividends?|wall street)\b",
    r"\b(president|prime minister|election|parliament|congress|democrat|republican|political party|geopolitics)\b",
    r"\b(solve|calculate|equation|calculus|derivative|integral|algebra|pythagorean|quantum physics)\b",
    r"\b(human dosage|dating advice|tinder pickup|best car to buy|hotel in|flight booking|recipe for lasagna)\b",
]

# Words that indicate pet/animal context
PET_INTENT_KEYWORDS = {
    "pet", "dog", "puppy", "pup", "cat", "kitten", "kitty", "canine", "feline",
    "bark", "meow", "purr", "leash", "collar", "vet", "veterinarian", "veterinary",
    "paw", "tail", "fur", "coat", "kibble", "walk", "walking", "groom", "grooming",
    "flea", "tick", "deworm", "vaccine", "vaccination", "rabies", "parvo",
    "breed", "golden retriever", "labrador", "poodle", "husky", "german shepherd", "beagle",
    "scratch", "scratching", "vomit", "vomiting", "diarrhea", "stool", "poop",
    "appetite", "eating", "food", "diet", "nutrition", "neuter", "spayed", "spay",
    "litter", "crate", "whiskers", "snout", "ear infection", "limping", "pant", "panting"
}

class HealthGuardrailService:
    @staticmethod
    def check_domain_scope(user_message: str) -> Tuple[bool, Optional[str]]:
        """
        TIER 0 GUARDRAIL: Domain Scope & Intent Boundary.
        Detects out-of-scope non-pet queries (coding, finance, politics, etc.)
        and deflects them politely before unnecessary LLM tokens or hallucinations.
        """
        msg_lower = user_message.lower().strip()
        
        # Friendly chitchat / greetings are always allowed
        greetings = {"hi", "hello", "hey", "good morning", "good evening", "thanks", "thank you", "who are you", "what can you do", "help"}
        if msg_lower in greetings or any(msg_lower.startswith(g) for g in ["hi ", "hello ", "hey "]):
            return False, None

        # Check if message contains explicit pet context keywords
        has_pet_intent = any(re.search(rf"\b{re.escape(kw)}\b", msg_lower) for kw in PET_INTENT_KEYWORDS)

        # Check for explicit out-of-scope patterns
        for pattern in OUT_OF_SCOPE_PATTERNS:
            if re.search(pattern, msg_lower):
                # If it matches an out-of-scope pattern and doesn't mention pets, block it immediately
                if not has_pet_intent:
                    return True, OUT_OF_SCOPE_REFUSAL

        # If the user query is reasonably long (>5 words) and contains zero pet/health terms
        tokens = [w for w in re.findall(r"\w+", msg_lower) if len(w) > 2]
        if len(tokens) >= 5 and not has_pet_intent:
            # Check if it looks completely unrelated to biology, wellness, food, behavior
            general_unrelated = ["code", "car", "movie", "song", "actor", "game", "nba", "fifa", "crypto", "stock", "flight", "hotel", "javascript", "python"]
            if any(term in tokens for term in general_unrelated):
                return True, OUT_OF_SCOPE_REFUSAL

        return False, None

    @staticmethod
    def pre_retrieval_emergency_triage(user_message: str, species: str = "dog") -> Tuple[bool, EmergencyTriageAlert]:
        """
        TIER 1 GUARDRAIL: Scans message for toxic substances or emergency symptoms.
        Bypasses LLM wait times if an emergency is detected.
        """
        msg_lower = user_message.lower()
        
        for keyword, (toxin_label, severity) in EMERGENCY_KEYWORDS.items():
            # Match whole words or clean tokens
            pattern = rf"\b{re.escape(keyword)}\b"
            if re.search(pattern, msg_lower):
                alert = EmergencyTriageAlert(
                    is_emergency=True,
                    toxin_detected=toxin_label,
                    severity=severity,
                    immediate_action=(
                        f"CRITICAL HEALTH WARNING: Ingestion or signs of '{toxin_label}' detected. "
                        "Do not wait for symptoms to worsen. Contact an emergency veterinary hospital immediately."
                    ),
                    hotlines=STANDARD_EMERGENCY_HOTLINES,
                    nearby_er_clinics=[
                        {
                            "name": "Local 24/7 Emergency Veterinary Hospital",
                            "address": "Nearest Metro Emergency Hospital",
                            "status": "Open 24 Hours",
                            "action": "Immediate Transport"
                        }
                    ]
                )
                return True, alert

        return False, EmergencyTriageAlert(is_emergency=False)

    @staticmethod
    def build_grounded_system_prompt(pet_context: Dict[str, Any]) -> str:
        """
        TIER 2 & 3 GUARDRAIL: Injects grounding data and enforces non-diagnostic persona.
        """
        pet_name = pet_context.get("name", "the pet")
        species = pet_context.get("species", "pet")
        breed = pet_context.get("breed", "unknown breed")
        weight = pet_context.get("weight_kg", "unknown")
        allergies = ", ".join(pet_context.get("allergies", [])) or "None reported"
        prescriptions = pet_context.get("active_prescriptions_summary", "None")
        conditions = pet_context.get("medical_conditions_summary") or prescriptions
        medications = pet_context.get("medications_summary", "No active prescription medications")
        vaxes = pet_context.get("vaccines_identified_summary", "None recorded")
        probable_vaxes = pet_context.get("probable_next_vaccines_summary", "All core vaccines up to date")
        vax_status = pet_context.get("vax_status", "in_progress")

        system_prompt = (
            f"You are HawPulse's certified pet health educator and wellness companion.\n"
            f"You are advising an owner about their {species} named '{pet_name}' ({breed}, {weight} kg).\n"
            f"Known Allergies: {allergies}\n"
            f"Medical Conditions Identified by Prescription: {conditions}\n"
            f"Active Prescription Medications: {medications}\n"
            f"Vaccines Identification (Administered & Verified): {vaxes}\n"
            f"Upcoming Vaccine Boosters: {probable_vaxes}\n"
            f"Immunization Status: {vax_status}\n\n"
            "STRICT GUARDRAIL RULES:\n"
            "1. NEVER give a definitive medical diagnosis. (Do NOT say 'Your pet has parvovirus/otitis').\n"
            "   Instead, phrase it: 'These symptoms could be related to X, but a vet exam is required'.\n"
            "2. NEVER prescribe drug dosages or recommend human medicines.\n"
            "3. If symptoms sound urgent, advise immediate veterinary consultation.\n"
            "4. Keep explanations empathetic, clear, and focused on wellness care.\n"
            "5. OUT-OF-SCOPE DEFLECTION: You are strictly a Pet Health & Wellness assistant. "
            "If the user asks questions unrelated to pets, dogs, cats, animal health, nutrition, or wellness "
            "(such as coding, math, finance, politics, or general non-pet knowledge), politely decline and state "
            "that you are exclusively designed to assist with pet health and wellness."
        )
        return system_prompt

    @staticmethod
    def post_generation_output_guardrail(raw_answer: str) -> str:
        """
        TIER 4 GUARDRAIL: Suppresses definitive diagnostic statements and enforces disclaimers.
        """
        cleaned = raw_answer
        
        # Suppress definitive diagnosis patterns
        cleaned = re.sub(
            r"(your (?:dog|cat|pet) has|i diagnose (?:your pet with)?)",
            "these signs may indicate",
            cleaned,
            flags=re.IGNORECASE
        )
        cleaned = re.sub(
            r"(give (?:him|her|your dog|your cat) \d+\s*(?:mg|tablets|pills) of [a-zA-Z]+)",
            "consult your vet for specific dosage of medication",
            cleaned,
            flags=re.IGNORECASE
        )
        
        # Ensure mandatory disclaimer is attached
        if "Veterinary Health Disclaimer:" not in cleaned:
            cleaned = cleaned.strip() + MANDATORY_DISCLAIMER
            
        return cleaned

guardrail_service = HealthGuardrailService()
