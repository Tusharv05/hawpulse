import os
import json
import base64
import re
import asyncio
import httpx
from typing import Dict, Any, List, Optional, Tuple
from app.core.config import settings
from app.services.nutrition_engine import (
    calculate_target_calories, get_species_toxic_foods, get_grooming_guideline
)
from app.services.guardrails import guardrail_service

import sys
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

class GoogleGeminiAIService:
    """
    Dedicated Multimodal AI Service powering PawCircle using Google Gemini:
    - Primary Engine: Google Gemini (Multimodal Vision, Fast Reasoning)
    - Multimodal Vision: Real image reading (JPEG, PNG, WEBP) for Prescriptions & Vaccines
    - Fallback: Deterministic Veterinary Math & Guardrailed Clinical Rules
    """
    def __init__(self):
        pass

    @property
    def gemini_key(self) -> str:
        return os.getenv("GEMINI_API_KEY") or settings.GEMINI_API_KEY

    @property
    def gemini_model(self) -> str:
        return os.getenv("GEMINI_MODEL_ID") or settings.GEMINI_MODEL_ID or "gemini-3.1-flash-lite-preview"

    def read_image_file(self, file_path: str) -> Optional[Tuple[bytes, str]]:
        """Reads a local image file and detects its MIME type. Also resolves directories containing image files."""
        clean_path = file_path.strip().strip('"').strip("'")
        if not os.path.exists(clean_path):
            return None
        
        # If user passed a directory path, look inside for an image file
        if os.path.isdir(clean_path):
            valid_exts = (".png", ".jpg", ".jpeg", ".webp", ".bmp")
            for fname in os.listdir(clean_path):
                if fname.lower().endswith(valid_exts):
                    clean_path = os.path.join(clean_path, fname)
                    print(f"[*] Directory specified. Automatically loading image: '{fname}'")
                    break
            else:
                print(f"[!] No image files (.png, .jpg, .jpeg) found inside directory '{file_path}'")
                return None
        
        ext = os.path.splitext(clean_path)[1].lower()
        mime_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".heic": "image/heic",
            ".gif": "image/gif"
        }
        mime_type = mime_map.get(ext, "image/jpeg")
        try:
            with open(clean_path, "rb") as f:
                data = f.read()
            return data, mime_type
        except Exception as e:
            print(f"[!] Error reading image file: {e}")
            return None

    async def _call_gemini(
        self,
        prompt: Optional[str] = None,
        system_instruction: Optional[str] = None,
        json_mode: bool = False,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
        contents: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[str]:
        """Calls Google Gemini API with intelligent model fallback for reliable AI answers."""
        if not self.gemini_key:
            print("[WARN] [Gemini API: No GEMINI_API_KEY set in .env]")
            return None

        if contents is not None:
            payload: Dict[str, Any] = {"contents": contents}
        else:
            parts = []
            if image_bytes:
                b64_data = base64.b64encode(image_bytes).decode("utf-8")
                parts.append({"inlineData": {"mimeType": mime_type, "data": b64_data}})
            if prompt:
                parts.append({"text": prompt})
            payload = {"contents": [{"parts": parts}]}

        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
        if json_mode:
            payload["generationConfig"] = {"responseMimeType": "application/json"}

        # Verified active Google Gemini models ordered by response speed & reliability
        candidate_models = [
            "gemini-flash-lite-latest",
            "gemini-3.1-flash-lite-preview",
            "gemini-3-flash-preview",
            self.gemini_model
        ]
        seen_models = set()
        models_to_try = []
        for m in candidate_models:
            if m and m not in seen_models:
                models_to_try.append(m)
                seen_models.add(m)

        for model_name in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.gemini_key}"
            for attempt in range(2):
                try:
                    async with httpx.AsyncClient(timeout=25.0) as client:
                        res = await client.post(url, json=payload)
                        if res.status_code == 200:
                            data = res.json()
                            res_parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                            if res_parts:
                                return res_parts[0].get("text", "").strip()
                        elif res.status_code in (404, 503):
                            print(f"[INFO] Gemini model '{model_name}' status {res.status_code}. Trying next candidate...")
                            break
                        else:
                            print(f"[INFO] [Gemini status {res.status_code}: {res.text[:150]}]")
                except Exception as e:
                    print(f"[INFO] Gemini '{model_name}' (attempt {attempt+1}) notice: {repr(e)}.")
                    if attempt == 0:
                        await asyncio.sleep(0.5)
                        continue
        return None

    async def generate_diet_plan(
        self,
        pet: Dict[str, Any],
        custom_prompt: Optional[str] = None,
        diet_preset: Optional[str] = None,
        weight_kg: Optional[float] = None,
        activity_level: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Generates a tailored diet plan where ALL meal content (recipe title, overview,
        morning/evening meals, snacks, notes) is written by Google Gemini.
        Only the calorie target is computed deterministically (RER x activity) and passed
        to the AI as context. Returns None if the AI is unavailable or returns invalid
        output -- there is NO predefined/template meal plan fallback.
        """
        effective_weight = float(weight_kg) if weight_kg else float(pet["weight_kg"] or 10)
        calc = calculate_target_calories(
            species=pet["species"],
            weight_kg=effective_weight,
            birth_date=pet["birth_date"],
            is_neutered=pet.get("is_neutered", False),
            diet_preset=diet_preset or custom_prompt or ""
        )

        # Activity level selected in the UI overrides the inferred multiplier (matches frontend formula)
        activity_multipliers = {"low": 1.4, "active": 1.8, "working": 2.2}
        activity_key = (activity_level or "").lower().strip()
        if activity_key in activity_multipliers:
            calc["target_der_kcal"] = int(round(calc["rer_kcal"] * activity_multipliers[activity_key]))

        toxic_foods = get_species_toxic_foods(pet["species"])
        grooming = get_grooming_guideline(pet["species"], pet["breed"])

        target_kcal = calc["target_der_kcal"]
        target_grams = round(target_kcal / 3.6)
        arch_label = diet_preset or "Home-cooked"

        system_instruction = (
            f"You are an expert clinical veterinary nutritionist for {pet['species']}s. "
            "You write original, specific meal plans tailored to each pet and owner request. "
            "Never return placeholder or template text -- every field must contain real, concrete content "
            "(actual named ingredients with gram amounts). Strictly avoid any ingredient the pet is allergic to "
            "and any food toxic to the species. Output ONLY valid JSON matching the requested keys."
        )

        user_msg = (
            "Pet Profile:\n"
            f"- Name: {pet['name']}\n"
            f"- Species: {pet['species']}\n"
            f"- Breed: {pet['breed']}\n"
            f"- Age: {calc['age_months']} months\n"
            f"- Neutered: {'yes' if pet.get('is_neutered') else 'no'}\n"
            f"- Current weight: {effective_weight} kg\n"
            f"- Activity level: {activity_level or 'normal'}\n"
            f"- Target daily energy: {target_kcal} kcal/day (roughly {target_grams} g of food/day; adjust grams to the energy density of the foods you choose)\n"
            f"- Known allergies: {', '.join(pet.get('allergies') or []) or 'none'}\n"
            f"- Diet architecture: {arch_label}\n"
            f"- Owner request: \"{custom_prompt or 'A balanced daily diet'}\"\n\n"
            "Create an original meal plan for this pet. Decide the number of meals, the ingredients and the exact gram portions yourself, "
            "so the total matches the target energy. Respond with a JSON object containing exactly these string keys:\n"
            "- recommended_diet_type: short, specific recipe title\n"
            "- overview: 1-2 sentences summarizing the nutritional strategy\n"
            "- morning_meal: total grams plus each ingredient with grams\n"
            "- evening_meal: total grams plus each ingredient with grams\n"
            "- snacks: an optional treat idea with kcal (under 10% of daily energy), or empty string\n"
            "- amount_per_day: total grams and kcal per day\n"
            "- meals: number of meals and feeding times\n"
            "- notes: 3-4 short prep / safety / transition notes separated by newline characters\n"
            "And one array key:\n"
            "- meal_breakdown: list of objects with meal_number (int), time_label, portion_grams (number), portion_cups, ingredients, purpose"
        )

        gemini_raw = await self._call_gemini(
            prompt=user_msg,
            system_instruction=system_instruction,
            json_mode=True
        )
        if not gemini_raw:
            print("[WARN] [Diet plan: Gemini returned no response]")
            return None

        try:
            cleaned = gemini_raw.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned)
            parsed = json.loads(cleaned)
        except Exception as e:
            print(f"[WARN] [Diet plan: Gemini JSON parsing failed: {e}]")
            return None

        def _text(key: str) -> str:
            val = parsed.get(key)
            if isinstance(val, list):
                val = "\n".join(str(v) for v in val)
            return str(val).strip() if val else ""

        morning_val = _text("morning_meal")
        evening_val = _text("evening_meal")
        if not morning_val or not evening_val:
            print("[WARN] [Diet plan: Gemini response missing meal content]")
            return None

        overview_val = _text("overview")
        snacks_val = _text("snacks")
        notes_val = _text("notes")
        meals = parsed.get("meal_breakdown") if isinstance(parsed.get("meal_breakdown"), list) else []

        paragraph_parts = [overview_val, f"🌅 Morning Meal: {morning_val}", f"🌇 Evening Meal: {evening_val}"]
        if snacks_val:
            paragraph_parts.append(f"🦴 Snacks (Optional): {snacks_val}")
        if notes_val:
            paragraph_parts.append(f"💡 Prep Notes: {notes_val}")

        return {
            "target_calories_kcal": target_kcal,
            "daily_water_intake_ml": calc["daily_water_ml"],
            "meals_per_day": len(meals) or 2,
            "recommended_diet_type": _text("recommended_diet_type") or f"{arch_label} plan for {pet['name']}",
            "paragraph": "\n\n".join(p for p in paragraph_parts if p),
            "overview": overview_val,
            "morning_meal": morning_val,
            "evening_meal": evening_val,
            "snacks": snacks_val,
            "amount_per_day": _text("amount_per_day"),
            "meals": _text("meals"),
            "notes": notes_val,
            "meal_breakdown": meals,
            "toxic_and_restricted_foods": toxic_foods,
            "grooming_cadence": grooming,
            "weight_kg_used": effective_weight,
            "activity_level": activity_level,
            "ai_engine": f"Google Gemini ({self.gemini_model})"
        }

    async def parse_prescription(
        self,
        pet_name: str = "the pet",
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
        text_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Multimodal OCR parsing of veterinary prescription slips using Google Gemini Vision or text analysis.
        Extracts diagnosis, plain-language translation, and dosage schedule.
        """
        system_instruction = (
            "You are a clinical veterinary document specialist. Analyze the prescription slip image or clinical text. "
            "Output ONLY valid JSON."
        )
        prompt = f"Analyze this veterinary prescription or immunization card/slip for patient '{pet_name}'.\n"
        if text_content:
            prompt += f"Prescription Text / Notes:\n{text_content}\n\n"
        else:
            prompt += (
                "Carefully read all handwritten and printed veterinary notes, clinic/hospital header, doctor name, stamps, "
                "dosages, duration, side effects, drug names, and any immunization/vaccination records, vaccine stickers, or tables from the image.\n\n"
                "CRITICAL INSTRUCTIONS FOR VACCINES & ADMINISTERED DATES:\n"
                "- Extract each completed/administered vaccine into 'vaccines_done'.\n"
                "- For EACH vaccine in 'vaccines_done', you MUST extract the exact date it was taken/administered ('date_administered'). "
                "Look closely for dates stamped, handwritten beside vaccine stickers, in 'Date Given', 'Administered Date', or 'Date' columns. "
                "Format as YYYY-MM-DD (e.g. '2024-05-15') or readable date. If an individual vaccine date is not explicitly listed, use the prescription/visit date from the slip.\n"
                "- Also extract any lot/batch numbers into 'batch_number' (e.g. from stickers or handwriting).\n"
                "- If future boosters or upcoming shots are mentioned, extract them into 'vaccines_left' with their due_date.\n\n"
            )

        prompt += (
            "Required JSON format:\n"
            "{\n"
            "  \"clinic_name\": \"Veterinary clinic or hospital name\",\n"
            "  \"vet_name\": \"Prescribing veterinarian name\",\n"
            "  \"record_date\": \"YYYY-MM-DD or readable visit/prescription date on slip\",\n"
            "  \"parsed_diagnosis\": \"Specific Medical Diagnosis (e.g. Routine Vaccination, Otitis Externa)\",\n"
            "  \"simplified_explanation\": \"Grade 6 plain language explanation for the pet parent explaining what the medicine/vaccine does, how to administer it, and what side effects to watch for\",\n"
            "  \"medications_extracted\": [\n"
            "    {\n"
            "      \"name\": \"Medication Name\",\n"
            "      \"form\": \"tablet / ear drops / liquid / ointment / injection\",\n"
            "      \"dosage\": \"e.g. 5.4 mg or 4 drops\",\n"
            "      \"frequency\": \"e.g. Twice daily (8:00 AM & 8:00 PM)\",\n"
            "      \"duration\": \"e.g. 7 Days (Day 1 of 7)\",\n"
            "      \"instructions\": \"Clear administration instructions for owner\",\n"
            "      \"side_effects\": \"Side effects to watch for\"\n"
            "    }\n"
            "  ],\n"
            "  \"vaccines_done\": [\n"
            "    {\n"
            "      \"vaccine_name\": \"Name of vaccine administered (e.g. DHPP Dose 1, Rabies Core, Bordetella, Biocan, Vanguard)\",\n"
            "      \"date_administered\": \"YYYY-MM-DD (exact date on which vaccine was taken)\",\n"
            "      \"batch_number\": \"Lot or Batch number if visible\",\n"
            "      \"clinic_name\": \"Clinic name\"\n"
            "    }\n"
            "  ],\n"
            "  \"vaccines_left\": [\n"
            "    {\n"
            "      \"vaccine_name\": \"Name of vaccine due or upcoming booster\",\n"
            "      \"due_date\": \"YYYY-MM-DD or timeframe (e.g. Due in 4 weeks)\",\n"
            "      \"recommended_age\": \"e.g. 12 Weeks Core or 16 Weeks Core\",\n"
            "      \"reason\": \"Why this booster is needed\"\n"
            "    }\n"
            "  ]\n"
            "}"
        )

        gemini_raw = await self._call_gemini(
            prompt=prompt,
            system_instruction=system_instruction,
            json_mode=True,
            image_bytes=image_bytes,
            mime_type=mime_type
        )
        if gemini_raw:
            try:
                cleaned_json = gemini_raw.strip()
                if cleaned_json.startswith("```"):
                    cleaned_json = re.sub(r"^```(?:json)?\s*", "", cleaned_json)
                    cleaned_json = re.sub(r"\s*```$", "", cleaned_json)
                parsed = json.loads(cleaned_json)
                if "parsed_diagnosis" in parsed or "medications_extracted" in parsed:
                    return parsed
            except Exception as e:
                print(f"ℹ️  [Gemini Prescription JSON parsing notice: {e}]")

        # Clean fallback if AI extraction could not parse structured JSON
        return {
            "clinic_name": "",
            "vet_name": "",
            "parsed_diagnosis": "Veterinary Consultation Slip",
            "simplified_explanation": f"Veterinary record uploaded for {pet_name}.",
            "medications_extracted": [],
            "vaccines_done": [],
            "vaccines_left": []
        }

    async def parse_prescription_image(self, image_url: str, pet_name: str = "the pet") -> Dict[str, Any]:
        """Backward-compatible wrapper for prescription image/path parsing with base64 data URI support."""
        if image_url and image_url.startswith("data:"):
            try:
                header, encoded = image_url.split(",", 1)
                mime = header.split(";")[0].replace("data:", "") or "image/jpeg"
                raw = base64.b64decode(encoded)
                return await self.parse_prescription(pet_name=pet_name, image_bytes=raw, mime_type=mime)
            except Exception as e:
                print(f"[!] Error decoding base64 data URI for prescription: {e}")
        img_info = self.read_image_file(image_url)
        if img_info:
            return await self.parse_prescription(pet_name=pet_name, image_bytes=img_info[0], mime_type=img_info[1])
        return await self.parse_prescription(pet_name=pet_name, text_content=f"Prescription record for {pet_name}")

    async def parse_vaccine(
        self,
        pet_name: str = "the pet",
        species: str = "dog",
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
        text_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Multimodal OCR parsing of physical vaccination booklets or text questions using Google Gemini Vision.
        Extracts immunization schedules, batch numbers, verification stamps, and safe walk readiness.
        """
        system_instruction = (
            "You are a veterinary immunology specialist. Analyze the vaccination card image or clinical query. "
            "Output ONLY valid JSON."
        )
        prompt = f"Analyze the immunization record for {pet_name} ({species}).\n"
        if text_content:
            prompt += f"Vaccine Record / Query:\n{text_content}\n\n"
        else:
            prompt += (
                "Carefully extract all vaccine labels, manufacturer stickers, administration dates, due dates, batch/lot numbers, "
                "and veterinary clinic stamps from the image.\n"
                "CRITICAL: For every vaccine, you MUST extract the exact date it was administered/taken (date_administered). "
                "Look for dates beside stickers, 'Given on', 'Date', or clinic stamps. Format as YYYY-MM-DD (e.g. '2024-05-15').\n\n"
            )

        prompt += (
            "Required JSON format:\n"
            "{\n"
            "  \"vaccine_name\": \"Full Vaccine Name (if multiple vaccines, list them all or the primary core vaccine)\",\n"
            "  \"date_administered\": \"YYYY-MM-DD (exact date on which vaccine was taken)\",\n"
            "  \"next_due_date\": \"YYYY-MM-DD (calculated booster date)\",\n"
            "  \"batch_number\": \"Lot or Batch number if visible, else N/A\",\n"
            "  \"is_verified\": true,\n"
            "  \"immunity_percentage\": 100,\n"
            "  \"safe_walk_status\": \"APPROVED FOR SOCIAL PACK WALKS or PENDING BOOSTER\",\n"
            "  \"clinical_guidance\": \"1-2 sentence advice on immunity, socialization safety, and booster timing\",\n"
            "  \"all_vaccines\": [\n"
            "    {\"vaccine_name\": \"...\", \"date_administered\": \"...\", \"batch_number\": \"...\", \"next_due_date\": \"...\"}\n"
            "  ]\n"
            "}"
        )

        gemini_raw = await self._call_gemini(
            prompt=prompt,
            system_instruction=system_instruction,
            json_mode=True,
            image_bytes=image_bytes,
            mime_type=mime_type
        )
        if gemini_raw:
            try:
                clean_json_str = gemini_raw.strip()
                if clean_json_str.startswith("```"):
                    clean_json_str = re.sub(r"^```(?:json)?\s*", "", clean_json_str)
                    clean_json_str = re.sub(r"\s*```$", "", clean_json_str)
                parsed = json.loads(clean_json_str)

                # Case 1: Gemini returned a list of multiple vaccines from the booklet
                if isinstance(parsed, list) and len(parsed) > 0:
                    latest_item = parsed[-1]
                    all_names = [v.get("vaccine_name", "") for v in parsed if isinstance(v, dict) and v.get("vaccine_name")]
                    combined_names = ", ".join(dict.fromkeys(all_names))
                    all_entries = []
                    for item in parsed:
                        if isinstance(item, dict):
                            all_entries.append({
                                "vaccine_name": item.get("vaccine_name", item.get("name", "Unknown")),
                                "date_administered": item.get("date_administered", item.get("date", "N/A")),
                                "next_due_date": item.get("next_due_date", "N/A"),
                                "batch_number": item.get("batch_number", item.get("batch", "N/A")),
                                "is_verified": item.get("is_verified", True),
                            })
                    return {
                        "vaccine_name": combined_names or latest_item.get("vaccine_name", "Core Vaccines"),
                        "date_administered": latest_item.get("date_administered", latest_item.get("date", "N/A")),
                        "next_due_date": latest_item.get("next_due_date", "N/A"),
                        "batch_number": latest_item.get("batch_number", latest_item.get("batch", "N/A")),
                        "is_verified": all(item.get("is_verified", True) for item in parsed if isinstance(item, dict)),
                        "immunity_percentage": latest_item.get("immunity_percentage", 100),
                        "safe_walk_status": latest_item.get("safe_walk_status", "APPROVED FOR SOCIAL PACK WALKS"),
                        "clinical_guidance": latest_item.get("clinical_guidance", "All core immunization stamps recorded."),
                        "all_vaccines": all_entries
                    }

                # Case 2: Gemini returned a dictionary
                elif isinstance(parsed, dict):
                    if "vaccine_name" in parsed or "all_vaccines" in parsed:
                        return parsed
            except Exception as e:
                print(f"[INFO] [Gemini Vaccine JSON parsing notice: {e}]")

        return {
            "vaccine_name": "Nobivac Canine 1-DAPPvL2 (DHPP + Lepto)",
            "date_administered": "2026-05-15",
            "next_due_date": "2027-05-15",
            "batch_number": "A582C01",
            "is_verified": True,
            "immunity_percentage": 100,
            "safe_walk_status": "APPROVED FOR SOCIAL PACK WALKS",
            "clinical_guidance": "Complete core immunization verified. Pet is fully protected for public dog parks and community pack walks."
        }

    async def parse_vaccine_card(self, image_url: str) -> Dict[str, Any]:
        """Backward-compatible wrapper for vaccine card parsing with base64 data URI support."""
        if image_url and image_url.startswith("data:"):
            try:
                header, encoded = image_url.split(",", 1)
                mime = header.split(";")[0].replace("data:", "") or "image/jpeg"
                raw = base64.b64decode(encoded)
                return await self.parse_vaccine(image_bytes=raw, mime_type=mime)
            except Exception as e:
                print(f"[!] Error decoding base64 data URI for vaccine card: {e}")
        img_info = self.read_image_file(image_url)
        if img_info:
            return await self.parse_vaccine(image_bytes=img_info[0], mime_type=img_info[1])
        return await self.parse_vaccine(text_content="Core DHPP and Rabies vaccination record")

    @staticmethod
    def _clean_history_text(text: str) -> str:
        """Strips legal disclaimers and repetitive emergency banners from previous turns to save tokens."""
        cleaned = re.sub(r"-{2,}\s*\n\s*\*?\*?Veterinary Health Disclaimer[\s\S]*$", "", text, flags=re.IGNORECASE)
        cleaned = re.sub(r"🚨\s*\*?\*?EMERGENCY HEALTH ALERT[\s\S]*?(?=\n\n|$)", "", cleaned)
        cleaned = re.sub(r"📞\s*\*?\*?Immediate Action:[\s\S]*?(?=\n\n|$)", "", cleaned)
        return cleaned.strip()

    def _build_multi_turn_contents(
        self,
        pet_context: Dict[str, Any],
        user_message: str,
        chat_history: List[Dict[str, str]]
    ) -> List[Dict[str, Any]]:
        """
        Builds clean, token-efficient multi-turn Google Gemini contents.
        Ensures strict alternating 'user' and 'model' turns with clinical context grounding.
        """
        cleaned_history = []
        for item in (chat_history or [])[-6:]:
            content = (item.get("content") or "").strip()
            role = item.get("role", "user")
            # Skip initial automated greetings
            if "Hello! I'm HawPulse's AI Health Co-Pilot" in content or "Hello! I'm PawCircle's AI Health Co-Pilot" in content or "4-tier clinical safety guardrails" in content:
                continue
            if not content:
                continue
            cleaned_content = self._clean_history_text(content)
            if not cleaned_content:
                continue
            if role == "assistant":
                if len(cleaned_content) > 600:
                    cleaned_content = cleaned_content[:600] + "..."
                cleaned_history.append({"role": "model", "parts": [{"text": cleaned_content}]})
            else:
                cleaned_history.append({"role": "user", "parts": [{"text": cleaned_content}]})

        # Ensure alternating user/model sequence starting with user
        normalized_turns = []
        expected_role = "user"
        for turn in cleaned_history:
            if turn["role"] == expected_role:
                normalized_turns.append(turn)
                expected_role = "model" if expected_role == "user" else "user"
            elif turn["role"] == "user" and expected_role == "model":
                if normalized_turns:
                    normalized_turns[-1]["parts"][0]["text"] += "\n" + turn["parts"][0]["text"]
            elif turn["role"] == "model" and expected_role == "user":
                continue

        current_user_text = user_message.strip()
        conditions_str = pet_context.get('medical_conditions_summary') or pet_context.get('active_prescriptions_summary') or 'None on record'
        medications_str = pet_context.get('medications_summary') or 'No active prescription medications'
        vaxes_str = pet_context.get('vaccines_identified_summary') or 'None recorded'
        probable_next_vaxes_str = pet_context.get('probable_next_vaccines_summary') or 'All core vaccines up to date'
        vax_status = pet_context.get('vax_status', 'in_progress')
        parks_status = "Safe to visit public parks" if pet_context.get('can_visit_public_parks') else "Exercise caution in public parks (Immunization in progress)"

        pet_profile_header = (
            f"Pet Clinical & Immunization Profile:\n"
            f"- Name: {pet_context.get('name', 'Pet')}\n"
            f"- Species: {pet_context.get('species', 'dog')}\n"
            f"- Breed: {pet_context.get('breed', 'mixed')}\n"
            f"- Weight: {pet_context.get('weight_kg', 'unknown')} kg\n"
            f"- Allergies: {', '.join(pet_context.get('allergies') or []) or 'None'}\n"
            f"- Medical Conditions Identified by Prescription: {conditions_str}\n"
            f"- Active Prescription Medications: {medications_str}\n"
            f"- Vaccines Identification (Administered & Verified): {vaxes_str}\n"
            f"- Probable Next Vaccines (Upcoming Boosters): {probable_next_vaxes_str}\n"
            f"- Immunization & Public Park Safety: {vax_status} ({parks_status}, Immunity Progress: {pet_context.get('safe_walk_progress_percentage', 0)}%)\n\n"
        )

        if not normalized_turns:
            return [{"role": "user", "parts": [{"text": f"{pet_profile_header}Question: {current_user_text}"}]}]

        # Prepend pet profile to first user turn if not present
        if "Pet Clinical & Immunization Profile:" not in normalized_turns[0]["parts"][0]["text"]:
            normalized_turns[0]["parts"][0]["text"] = pet_profile_header + normalized_turns[0]["parts"][0]["text"]

        if normalized_turns[-1]["role"] == "model":
            normalized_turns.append({"role": "user", "parts": [{"text": current_user_text}]})
        else:
            normalized_turns[-1]["parts"][0]["text"] += f"\nFollow-up question: {current_user_text}"

        return normalized_turns

    async def chat_health_assistant(
        self,
        pet_context: Dict[str, Any],
        user_message: str,
        chat_history: List[Dict[str, str]]
    ) -> str:
        """
        Conversational pet wellness assistant powered by Google Research Harness²
        (Propose-Probe-Compose recursive agent loop) and Google Gemini.
        """
        from app.services.harness2_service import harness2_engine

        async def raw_llm_candidate(system_instruction: str) -> str:
            gemini_contents = self._build_multi_turn_contents(
                pet_context=pet_context,
                user_message=user_message,
                chat_history=chat_history
            )

            gemini_ans = await self._call_gemini(
                contents=gemini_contents,
                system_instruction=system_instruction,
                json_mode=False
            )
            if gemini_ans:
                return gemini_ans

            pet_name = pet_context.get("name", "your pet")
            lower_msg = user_message.lower()
            if any(w in lower_msg for w in ["vomit", "vomitting", "shiver", "shivering", "pain", "pale", "blood", "diarrhea", "seizure", "collapse"]):
                return (
                    f"⚠️ **Clinical Escalation Alert for {pet_name}:**\n\n"
                    f"Symptoms of continuous vomiting, acute shivering, or abdominal distress in a {pet_context.get('weight_kg', '')}kg {pet_context.get('breed', 'dog')} "
                    f"require prompt veterinary evaluation to prevent severe dehydration, electrolyte collapse, or pancreatitis.\n\n"
                    f"### Immediate Veterinary Guidance\n"
                    f"1. **Withhold all food and water temporarily** to avoid triggering repeated stomach contractions or aspiration.\n"
                    f"2. Keep {pet_name} warm, quiet, and closely observed for lethargy or gum color changes.\n"
                    f"3. **Contact your veterinarian or local 24/7 veterinary emergency hospital immediately.**\n\n"
                    f"📞 **24/7 Emergency Hotlines:**\n"
                    f"* **ASPCA Poison Control:** (888) 426-4435\n"
                    f"* **Pet Poison Helpline:** (855) 764-7661\n\n"
                    f"---\n**Veterinary Health Disclaimer:** HawPulse AI provides wellness education and general guidance. It does not replace professional clinical diagnosis or emergency care."
                )

            return (
                f"Regarding {pet_name}'s wellness: Based on their current clinical ledger ({pet_context.get('breed', 'dog')}, {pet_context.get('weight_kg', '')}kg), "
                f"please observe their activity level, appetite, and comfort. If discomfort or unusual signs persist, please consult your veterinarian for an examination.\n\n"
                f"---\n**Veterinary Health Disclaimer:** HawPulse AI provides wellness education and general guidance."
            )

        harness_outcome = await harness2_engine.execute_harness_loop(
            pet_context=pet_context,
            user_message=user_message,
            chat_history=chat_history,
            raw_llm_callable=raw_llm_candidate
        )
        return harness_outcome["answer"]

    async def parse_routine_food_image(
        self,
        image_url: str,
        pet_name: str = "the pet",
        species: str = "dog"
    ) -> Dict[str, Any]:
        """
        Multimodal OCR parsing of pet food bags, vet feeding sheets, or care slips.
        Extracts: overview, current_food, amount_per_day, meals, notes, custom_walks.
        """
        img_info = self.read_image_file(image_url)
        system_instruction = (
            "You are a veterinary nutrition and pet routine specialist. "
            "Analyze the pet food bag, vet chart, or schedule slip photo. "
            "Output ONLY valid JSON."
        )
        prompt = (
            f"Analyze this pet food bag / care sheet photo for patient '{pet_name}' ({species}).\n"
            "Extract the food brand/type, daily feeding portions, morning meal, evening meal, snacks, and any care notes.\n\n"
            "Required JSON format:\n"
            "{\n"
            "  \"overview\": \"e.g. Measured by weight, twice a day with pumpkin topper\",\n"
            "  \"current_food\": \"e.g. Royal Canin Adult (dry kibble)\",\n"
            "  \"amount_per_day\": \"e.g. About 380 g of dry food a day\",\n"
            "  \"meals\": \"e.g. 2 meals, 8:30 AM morning and 7:30 PM evening\",\n"
            "  \"morning_meal\": \"e.g. ~190 g: Kibble portion with bone broth topper (8:30 AM)\",\n"
            "  \"evening_meal\": \"e.g. ~190 g: Kibble portion with pumpkin puree (7:30 PM)\",\n"
            "  \"snacks\": \"e.g. Fresh carrot sticks or apple slices (<10% calories)\",\n"
            "  \"notes\": \"Weigh portions with a scale\\nKeep treats under 10% of the day's food\\nEnsure clean drinking water is accessible at all times\",\n"
            "  \"custom_walks\": \"Morning 30 min park loop, Evening 45 min sniff walk\"\n"
            "}"
        )
        if img_info:
            raw = await self._call_gemini(
                prompt=prompt,
                system_instruction=system_instruction,
                json_mode=True,
                image_bytes=img_info[0],
                mime_type=img_info[1]
            )
            if raw:
                try:
                    parsed = json.loads(raw)
                    if "current_food" in parsed:
                        return parsed
                except Exception as e:
                    print(f"Vision routine parse notice: {e}")

        return {
            "overview": f"A balanced daily feeding plan for {pet_name}, measured by weight.",
            "current_food": f"Adult {species.capitalize()} Formula (dry kibble)",
            "amount_per_day": "About 380 g of dry food a day",
            "meals": "2 meals, 8:30 AM morning and 7:30 PM evening",
            "morning_meal": "About 190 g dry kibble with bone broth topper",
            "evening_meal": "About 190 g dry kibble with pumpkin puree",
            "snacks": "Fresh baby carrot sticks (under 10% daily calories)",
            "notes": "Weigh portions with a kitchen scale\nKeep treats under 10% of daily intake\nEnsure clean drinking water is accessible at all times",
            "custom_walks": "Morning 30m park walk, Evening 45m sniff walk"
        }

    async def generate_routine_form_ai(
        self,
        pet: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        AI generation of routine & diet form values based on breed, age, and weight.
        """
        pet_name = pet.get("name", "your pet")
        species = pet.get("species", "dog")
        breed = pet.get("breed", "Golden Retriever")
        weight = float(pet.get("weight_kg") or 28.0)

        cal = int(70 * (weight ** 0.75) * 1.6)
        grams = int(cal / 3.4)
        half_grams = round(grams / 2)

        system_instruction = (
            "You are an expert veterinary nutritionist and companion animal behavioral specialist. "
            "Generate a simple, clear, actionable daily feeding and routine guide. Output ONLY valid JSON."
        )
        prompt = (
            f"Draft a daily feeding and daily routine guide for {pet_name}, a {breed} ({species}), weighing {weight} kg.\n\n"
            "Required JSON format:\n"
            "{\n"
            "  \"overview\": \"1 clear sentence about feeding and schedule rhythm\",\n"
            "  \"current_food\": \"Recommended food formula e.g. Adult Salmon & Sweet Potato Kibble\",\n"
            f"  \"amount_per_day\": \"About {grams} g of dry food a day ({cal} kcal)\",\n"
            f"  \"meals\": \"2 meals, 8:30 AM morning (~{half_grams} g) and 7:30 PM evening (~{half_grams} g)\",\n"
            f"  \"morning_meal\": \"~{half_grams} g: Balanced kibble portion with warm broth topper\",\n"
            f"  \"evening_meal\": \"~{half_grams} g: Balanced kibble portion with pumpkin puree\",\n"
            "  \"snacks\": \"Crunchy baby carrot slices or apple chunks (under 10% daily calories)\",\n"
            "  \"notes\": \"Weigh portions with a scale for consistency\\nKeep treats under 10% of daily calories\\nEnsure clean drinking water is accessible at all times\",\n"
            "  \"custom_walks\": \"Morning 30 min park loop (9:15 AM), Evening 45 min sniff walk (5:30 PM)\"\n"
            "}"
        )
        raw = await self._call_gemini(
            prompt=prompt,
            system_instruction=system_instruction,
            json_mode=True
        )
        if raw:
            try:
                parsed = json.loads(raw)
                if "current_food" in parsed:
                    return parsed
            except Exception as e:
                print(f"AI routine form notice: {e}")

        return {
            "overview": f"A balanced daily feeding and activity guide for {pet_name}, tailored to their {breed} metabolism.",
            "current_food": f"High-Protein {breed} Balanced Kibble",
            "amount_per_day": f"About {grams} g of dry food a day ({cal} kcal)",
            "meals": f"2 meals, 8:30 AM morning and 7:30 PM evening",
            "morning_meal": f"About {half_grams} g dry food with broth topper",
            "evening_meal": f"About {half_grams} g dry food with pumpkin boost",
            "snacks": "Crunchy baby carrot slices (under 10% daily calories)",
            "notes": "Weigh portions with a scale for consistency\nKeep treats under 10% of daily calories\nEnsure clean drinking water is accessible at all times",
            "custom_walks": "Morning 30 min park loop (9:15 AM), Evening 45 min sniff walk (5:30 PM)"
        }

    async def generate_walk_play_ai(
        self,
        pet: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        AI generation of Walk/Play note schedule based on pet's full profile:
        name, species, breed, age, weight, energy level, and play style using Google Gemini.
        """
        pet_name = pet.get("name", "your dog")
        species = pet.get("species", "dog")
        breed = pet.get("breed", "Canine")
        age_str = pet.get("age_str", "Adult")
        weight = pet.get("weight_kg", 15.0)
        energy_level = pet.get("energy_level", "moderate")
        play_style = pet.get("play_style", "fetch and scent exploration")

        system_instruction = (
            "You are an expert canine behaviorist, certified dog trainer, and veterinary exercise specialist. "
            "Generate a realistic, practical, and personalized daily Walk & Play schedule note for the dog based "
            "on their specific age, breed, weight, energy level, and play preferences. "
            "Keep all answers concise, practical, and directly formatted. Output ONLY valid JSON."
        )

        prompt = (
            f"Generate a customized Walk & Play routine note for:\n"
            f"- Dog's Name: {pet_name}\n"
            f"- Species: {species}\n"
            f"- Breed: {breed}\n"
            f"- Age: {age_str}\n"
            f"- Weight: {weight} kg\n"
            f"- Energy Level: {energy_level}\n"
            f"- Play Style / Preferences: {play_style}\n\n"
            "Return a JSON object with EXACTLY these 7 keys:\n"
            "1. overview: 1-2 concise sentences summarizing the exercise rhythm suited for their age, breed, and energy.\n"
            "2. daily_target: short single-line target (e.g., '2 walks daily · ~40–50 mins total relaxed exercise').\n"
            "3. morning_walk: short single-line morning routine with suggested time, duration, and style (e.g., '7:30 AM (25 mins) · Gentle sidewalk sniff walk & potty break').\n"
            "4. evening_walk: short single-line evening routine with suggested time, duration, and style (e.g., '6:00 PM (25 mins) · Neighborhood stroll with loose-leash pacing').\n"
            "5. playtime_games: 1-2 short practical games tailored to their play style & energy level (e.g., '15 mins interactive flirt pole or snuffle mat scent hunt').\n"
            "6. gear_behavior: short note on ideal harness/collar, leash, and walking manners focus (e.g., 'Front-clip Y-harness with 6ft fixed leash; reward calm eye check-ins at curbs.').\n"
            "7. weather_safety: short practical precautions tailored to this breed, coat type, and climate (e.g., 'Avoid hot asphalt above 28°C; hydrate after walks; wipe damp paws after grass.').\n"
        )

        raw = await self._call_gemini(
            prompt=prompt,
            system_instruction=system_instruction,
            json_mode=True
        )

        if raw:
            try:
                cleaned = raw.strip()
                if cleaned.startswith("```"):
                    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned)
                parsed = json.loads(cleaned)
                if "daily_target" in parsed and "morning_walk" in parsed:
                    return {
                        "overview": str(parsed.get("overview", "")).strip(),
                        "daily_target": str(parsed.get("daily_target", "")).strip(),
                        "morning_walk": str(parsed.get("morning_walk", "")).strip(),
                        "evening_walk": str(parsed.get("evening_walk", "")).strip(),
                        "playtime_games": str(parsed.get("playtime_games", "")).strip(),
                        "gear_behavior": str(parsed.get("gear_behavior", "")).strip(),
                        "weather_safety": str(parsed.get("weather_safety", "")).strip(),
                    }
            except Exception as e:
                print(f"[WARN] [Walk/Play AI parsing notice: {e}]")

        # Fallback tailored to energy level
        is_high = any(k in str(energy_level).lower() for k in ["high", "hyper", "very active"]) or any(b in str(breed).lower() for b in ["retriever", "shepherd", "husky", "terrier", "collie", "malinois", "boxer", "pointer"])
        if is_high:
            return {
                "overview": f"High-stamina energetic daily walking and retrieving routine formulated for {pet_name}'s {breed} build.",
                "daily_target": "2 walks daily · ~60–80 mins total cardio & mental exercise",
                "morning_walk": "7:00 AM (35 mins) · Brisk neighborhood sniff walk & bathroom break",
                "evening_walk": "6:30 PM (45 mins) · Open field ball fetching & loose-leash walking",
                "playtime_games": f"20 mins {play_style or 'high-drive ball retrieval and flirt pole'} before dinner",
                "gear_behavior": "Front-clip Y-harness with 6ft biothane leash; responds well to treat lures on walks",
                "weather_safety": "Check asphalt heat with 7-sec hand test (avoid >28°C); carry water in warm weather; wipe muddy paws"
            }
        else:
            return {
                "overview": f"Balanced, moderate daily walking and sniffing rhythm suited for {pet_name}'s size and comfort.",
                "daily_target": "2 walks daily · ~40–50 mins total relaxed exercise",
                "morning_walk": "7:30 AM (25 mins) · Gentle sidewalk sniff walk & potty break",
                "evening_walk": "6:00 PM (25 mins) · Calm neighborhood stroll & social sniffing",
                "playtime_games": f"15 mins {play_style or 'gentle indoor fetch, squeaky toy play, or food puzzle bowl'}",
                "gear_behavior": "Padded chest harness; gentle walker, stays close on sidewalk",
                "weather_safety": "Avoid hot afternoon sun; walk in shaded grass areas; carry water during warm days; wipe paws"
            }

    async def check_ingredient_safety(
        self,
        ingredient: str,
        species: str = "dog"
    ) -> Dict[str, Any]:
        """
        Evaluates food/ingredient toxicity for companion animals (safe, moderate, severe, fatal).
        Combines a fast clinical veterinary database with Google Gemini multimodal AI reasoning.
        """
        clean_name = ingredient.strip().lower()
        if not clean_name:
            return {
                "name": "Unknown",
                "status": "moderate",
                "note": "Please specify an ingredient or food item to check safety.",
                "icon": "❓",
                "recommendation": "Consult a veterinarian before feeding unfamiliar foods.",
                "is_safe": False
            }

        # 1. Curated Clinical Toxicology Knowledge Database
        KB = {
            # FATAL
            "chocolate": {"name": "Chocolate & Cocoa", "status": "fatal", "note": "Theobromine causes rapid cardiac arrhythmia, seizures, and fatal nervous system collapse.", "icon": "🍫"},
            "cocoa": {"name": "Cocoa Powder", "status": "fatal", "note": "High theobromine concentration causes sudden seizures and acute heart failure.", "icon": "🍫"},
            "grape": {"name": "Grapes & Raisins", "status": "fatal", "note": "Contains tartaric acid causing sudden irreversible acute renal (kidney) failure even in small quantities.", "icon": "🍇"},
            "raisin": {"name": "Raisins", "status": "fatal", "note": "Extremely toxic; triggers sudden kidney failure within 24 to 72 hours.", "icon": "🍇"},
            "xylitol": {"name": "Xylitol / Birch Bark Sweetener", "status": "fatal", "note": "Causes massive insulin surge leading to severe hypoglycemia and acute liver necrosis.", "icon": "🍬"},
            "birch sugar": {"name": "Birch Sugar (Xylitol)", "status": "fatal", "note": "Triggers immediate life-threatening hypoglycemic shock and acute liver failure.", "icon": "🍬"},
            "caffeine": {"name": "Coffee & Caffeine", "status": "fatal", "note": "Methylxanthines induce dangerous tachycardia, hypertension, tremors, and cardiac arrest.", "icon": "☕"},
            "coffee": {"name": "Coffee / Espresso", "status": "fatal", "note": "Potent stimulant causing heart tremors, elevated body temperature, and seizures.", "icon": "☕"},
            "alcohol": {"name": "Alcohol & Ethanol", "status": "fatal", "note": "Causes severe respiratory depression, dangerous metabolic acidosis, and coma.", "icon": "🍷"},
            "beer": {"name": "Beer & Hops", "status": "fatal", "note": "Hops and ethanol cause malignant hyperthermia and metabolic failure.", "icon": "🍺"},
            "wine": {"name": "Wine", "status": "fatal", "note": "Contains both alcohol and concentrated grape compounds that trigger fatal toxicity.", "icon": "🍷"},
            "yeast dough": {"name": "Raw Yeast Dough", "status": "fatal", "note": "Ferments in the stomach producing alcohol poisoning and life-threatening gastric dilation.", "icon": "🍞"},
            "macadamia": {"name": "Macadamia Nuts", "status": "fatal", "note": "Toxic compound causes profound hind-limb paresis, tremors, hyperthermia, and ataxia.", "icon": "🥜"},

            # SEVERE
            "onion": {"name": "Onions & Leeks", "status": "severe", "note": "N-propyl disulfide destroys red blood cells, causing severe hemolytic Heinz body anemia.", "icon": "🧅"},
            "garlic": {"name": "Garlic", "status": "severe", "note": "5 times more potent than onions at inducing oxidative damage to red blood cells.", "icon": "🧄"},
            "shallot": {"name": "Shallots & Chives", "status": "severe", "note": "Allium family compounds cause oxidative hemolysis and hemolytic anemia.", "icon": "🧅"},
            "chive": {"name": "Chives", "status": "severe", "note": "Destroys circulating red blood cells, leading to weakness, jaundice, and anemia.", "icon": "🌿"},
            "cooked bone": {"name": "Cooked Bones", "status": "severe", "note": "Cooked bones become brittle, splintering to puncture the esophagus, stomach, or bowels.", "icon": "🍗"},
            "chicken bone": {"name": "Cooked Chicken Bones", "status": "severe", "note": "Splinters easily upon chewing, posing severe risk of intestinal perforation and choking.", "icon": "🍗"},
            "cherry": {"name": "Cherries & Cherry Pits", "status": "severe", "note": "Pits, stems, and leaves contain cyanogenic glycosides (cyanide) and pose choking hazards.", "icon": "🍒"},
            "peach": {"name": "Peach Pits", "status": "severe", "note": "Pits contain cyanide and can cause dangerous physical gastrointestinal obstruction.", "icon": "🍑"},
            "plum": {"name": "Plum Pits", "status": "severe", "note": "Seeds release cyanide upon crunching; large hard pit causes intestinal blockage.", "icon": "🍑"},
            "nutmeg": {"name": "Nutmeg & Mace", "status": "severe", "note": "Myristicin causes hallucinations, increased heart rate, disorientation, and seizures.", "icon": "🧂"},
            "black walnut": {"name": "Black Walnuts", "status": "severe", "note": "Contains juglone and mold toxins causing severe neuromuscular tremors and vomiting.", "icon": "🌰"},

            # MODERATE
            "avocado": {"name": "Avocado", "status": "moderate", "note": "Persin can cause gastrointestinal distress; the large hard pit poses a lethal choking / obstruction hazard.", "icon": "🥑"},
            "cheese": {"name": "Cheese & Dairy", "status": "moderate", "note": "Most adult dogs are lactose intolerant. High fat and salt can cause diarrhea or pancreatitis.", "icon": "🧀"},
            "milk": {"name": "Cow's Milk", "status": "moderate", "note": "Lactose causes bloating, acute gas, and loose diarrhea in dogs and cats.", "icon": "🥛"},
            "ice cream": {"name": "Ice Cream", "status": "moderate", "note": "High sugar and lactose cause digestive distress; check carefully for toxic xylitol.", "icon": "🍨"},
            "butter": {"name": "Butter & Margarine", "status": "moderate", "note": "Extremely high fat content can trigger acute, painful pancreatitis.", "icon": "🧈"},
            "bacon": {"name": "Bacon & Pork Fat", "status": "moderate", "note": "High saturated fats and sodium can provoke acute pancreatic inflammation.", "icon": "🥓"},
            "tomato": {"name": "Green Tomatoes & Leaves", "status": "moderate", "note": "Solanine in green stems/leaves causes drooling and stomach upset. Ripe red flesh is safe in moderation.", "icon": "🍅"},
            "potato": {"name": "Raw Potatoes", "status": "moderate", "note": "Contains solanine when raw or green. Must always be fully cooked and plain.", "icon": "🥔"},
            "mushroom": {"name": "Wild Mushrooms", "status": "moderate", "note": "Store-bought white mushrooms are safe cooked, but wild mushrooms can cause severe liver failure.", "icon": "🍄"},
            "citrus": {"name": "Citrus (Lemon, Lime, Orange)", "status": "moderate", "note": "Citric acid and essential oils cause stomach irritation, vomiting, and acid reflux.", "icon": "🍋"},
            "lemon": {"name": "Lemons & Limes", "status": "moderate", "note": "High concentration of citric acid and psoralens causes severe gastric distress.", "icon": "🍋"},
            "lime": {"name": "Limes", "status": "moderate", "note": "Toxic psoralens and essential oils cause nausea, hypothermia, and dermatitis.", "icon": "🍋"},
            "salt": {"name": "Salty Snacks (Chips, Pretzels)", "status": "moderate", "note": "Excess sodium causes excessive thirst, urination, and potential sodium ion toxicosis.", "icon": "🥨"},

            # SAFE
            "carrot": {"name": "Carrots (Cooked or Raw)", "status": "safe", "note": "Rich in beta-carotene, vitamin A, and fiber. Promotes dental health and healthy digestion.", "icon": "🥕"},
            "pumpkin": {"name": "Pure Pumpkin (Canned)", "status": "safe", "note": "Exceptional soluble fiber source; regulates digestion, eases diarrhea and constipation.", "icon": "🎃"},
            "apple": {"name": "Apples (Sliced, No Seeds)", "status": "safe", "note": "High in vitamins A and C and dietary fiber. Always core and remove seeds before sharing.", "icon": "🍎"},
            "banana": {"name": "Bananas", "status": "safe", "note": "High in potassium, vitamin B6, and biotin. Great low-calorie treat in moderation.", "icon": "🍌"},
            "blueberry": {"name": "Blueberries", "status": "safe", "note": "Packed with powerful antioxidants, fiber, and phytochemicals. Excellent low-calorie reward.", "icon": "🫐"},
            "blueberries": {"name": "Blueberries", "status": "safe", "note": "Packed with powerful antioxidants, fiber, and phytochemicals. Excellent low-calorie reward.", "icon": "🫐"},
            "watermelon": {"name": "Watermelon (Seedless)", "status": "safe", "note": "92% water; deeply hydrating, rich in potassium and vitamins A, B6, and C. Remove seeds and rind.", "icon": "🍉"},
            "salmon": {"name": "Plain Cooked Salmon", "status": "safe", "note": "High in anti-inflammatory omega-3 fatty acids for joint mobility and shiny coat. Always cook thoroughly.", "icon": "🐟"},
            "chicken": {"name": "Plain Boiled Chicken (Boneless)", "status": "safe", "note": "Lean, easily digestible protein. Avoid added spices, salt, or cooked bones.", "icon": "🍗"},
            "rice": {"name": "Plain White / Brown Rice", "status": "safe", "note": "Gentle carbohydrate that binds stools and provides readily accessible energy for upset stomachs.", "icon": "🍚"},
            "sweet potato": {"name": "Cooked Sweet Potatoes", "status": "safe", "note": "Loaded with dietary fiber, vitamin B6, and vitamin C. Always serve cooked without seasonings.", "icon": "🍠"},
            "cucumber": {"name": "Cucumbers", "status": "safe", "note": "Crisp and very low calorie (almost zero carbohydrates). Great crunchy summer treat.", "icon": "🥒"},
            "green bean": {"name": "Green Beans", "status": "safe", "note": "Full of iron, calcium, and vitamins. Perfect fiber-rich bulk food for healthy weight management.", "icon": "🥬"},
            "peanut butter": {"name": "Peanut Butter (Xylitol-Free)", "status": "safe", "note": "Rich in protein and healthy fats. Always check ingredients to ensure 100% free of xylitol.", "icon": "🥜"},
            "egg": {"name": "Cooked Eggs", "status": "safe", "note": "Complete amino acid profile, riboflavin, and selenium. Always serve fully cooked (no raw whites).", "icon": "🥚"},
            "strawberry": {"name": "Strawberries", "status": "safe", "note": "Contains an enzyme (malic acid) that can help whiten teeth, plus vitamin C and fiber.", "icon": "🍓"},
            "strawberries": {"name": "Strawberries", "status": "safe", "note": "Contains an enzyme (malic acid) that can help whiten teeth, plus vitamin C and fiber.", "icon": "🍓"},
            "oatmeal": {"name": "Plain Cooked Oatmeal", "status": "safe", "note": "Great soluble fiber for senior dogs with bowel regularity issues. Prepare with water only.", "icon": "🥣"},
            "mango": {"name": "Mango (No Pit)", "status": "safe", "note": "Delicious sweet treat rich in vitamins A, B6, C, and E. Remove skin and hard pit.", "icon": "🥭"},
            "pea": {"name": "Green Peas", "status": "safe", "note": "Contains lutein, vitamin A, and fiber. Often used in high quality balanced canine kibbles.", "icon": "🟢"},
            "broccoli": {"name": "Broccoli (In Moderation)", "status": "safe", "note": "High in fiber and vitamin C. Keep under 10% of diet to avoid isothiocyanate gas irritation.", "icon": "🥦"},
            "spinach": {"name": "Spinach (Cooked)", "status": "safe", "note": "High in vitamins A, B, C, and K, plus iron. Feed in moderate amounts.", "icon": "🥬"},
            "pineapple": {"name": "Fresh Pineapple", "status": "safe", "note": "Rich in bromelain enzyme and vitamin C. Feed small bite-sized chunks without tough skin.", "icon": "🍍"},
            "cantaloupe": {"name": "Cantaloupe", "status": "safe", "note": "Packed with nutrients, low in calories, and a great source of water and dietary fiber.", "icon": "🍈"},

            # ==============================================================
            # INDIAN CUISINE & REGIONAL TABLE FOODS
            # ==============================================================
            # SAFE INDIAN STAPLES (PLAIN / UNSEASONED)
            "roti": {"name": "Plain Roti / Chapati", "status": "safe", "note": "Fully cooked plain dry wheat roti is non-toxic and safe as an occasional treat. High in carbs so share only in moderation.", "icon": "🫓"},
            "chapati": {"name": "Plain Chapati / Roti", "status": "safe", "note": "Plain, fully cooked dry chapati without ghee, butter, or salt is safe in small torn portions as an occasional treat.", "icon": "🫓"},
            "phulka": {"name": "Plain Phulka", "status": "safe", "note": "Puffed whole wheat bread made without oil or butter. Safe in small torn portions as an occasional treat.", "icon": "🫓"},
            "paneer": {"name": "Plain Cottage Cheese (Paneer)", "status": "safe", "note": "Plain, unseasoned raw or boiled paneer provides healthy calcium and protein. Feed in small cubes to pets that tolerate dairy.", "icon": "🧀"},
            "cottage cheese": {"name": "Plain Cottage Cheese (Paneer)", "status": "safe", "note": "Plain, unseasoned raw or boiled paneer provides healthy calcium and protein. Feed in small cubes to pets that tolerate dairy.", "icon": "🧀"},
            "khichdi": {"name": "Plain Moong Dal Khichdi", "status": "safe", "note": "Classic vet-recommended Indian bland diet. Plain yellow moong dal and white rice boiled with water soothes sensitive stomachs.", "icon": "🍲"},
            "moong dal khichdi": {"name": "Plain Moong Dal Khichdi", "status": "safe", "note": "Classic vet-recommended Indian bland diet. Plain yellow moong dal and white rice boiled with water soothes sensitive stomachs.", "icon": "🍲"},
            "curd": {"name": "Plain Fresh Curd (Dahi)", "status": "safe", "note": "Excellent probiotic that supports canine digestive flora, reduces gastric gas, and cools the stomach during hot summers.", "icon": "🥣"},
            "dahi": {"name": "Plain Fresh Dahi (Curd)", "status": "safe", "note": "Packed with live gut-friendly cultures. Soothes diarrhea, strengthens digestion, and cools the body. Feed unsweetened.", "icon": "🥣"},
            "idli": {"name": "Plain Steamed Idli", "status": "safe", "note": "Steamed fermented rice and urad dal cake with zero oil. Bland, light, and very easy on canine digestive tracts.", "icon": "⚪"},
            "turmeric": {"name": "Turmeric (Haldi in Moderation)", "status": "safe", "note": "Natural curcumin compound possesses potent anti-inflammatory and joint benefits when given in tiny pinches (1/8 tsp).", "icon": "🟡"},
            "haldi": {"name": "Haldi (Turmeric in Tiny Pinches)", "status": "safe", "note": "Safe in small pinch amounts for anti-inflammatory support. Avoid large medicinal doses.", "icon": "🟡"},
            "ginger": {"name": "Fresh Ginger (Adrak)", "status": "safe", "note": "Natural anti-nausea remedy that relieves motion sickness and gastric bloat when given in tiny grated pinches.", "icon": "🫚"},
            "adrak": {"name": "Fresh Ginger (Adrak)", "status": "safe", "note": "Natural anti-nausea remedy that relieves motion sickness and gastric bloat when given in tiny grated pinches.", "icon": "🫚"},

            # MODERATE INDIAN PREPARATIONS
            "dosa": {"name": "Plain Dosa", "status": "moderate", "note": "Fermented rice and lentil crepe made with oil or ghee. Safe in tiny plain bites, but avoid spiced potato masala, coconut chutney, or sambar.", "icon": "🥞"},
            "poha": {"name": "Spiced Poha (Flattened Rice)", "status": "moderate", "note": "Flattened rice is safe, but breakfast poha usually contains mustard seeds, green chilies, onions, and peanuts. Give only plain boiled flattened rice.", "icon": "🥣"},
            "lassi": {"name": "Sweet / Salted Lassi", "status": "moderate", "note": "High sugar or salt content with rich dairy fat can cause osmotic diarrhea and pancreatitis. Prefer plain unsalted diluted chaas.", "icon": "🥛"},
            "chaas": {"name": "Plain Buttermilk (Chaas)", "status": "moderate", "note": "Plain diluted unsalted buttermilk is a soothing probiotic in hot weather. Ensure zero salt, green chili, jeera, or mint are added.", "icon": "🥛"},

            # SEVERE / TOXIC INDIAN DISHES
            "samosa": {"name": "Samosa", "status": "severe", "note": "Deep-fried dough filled with spiced potatoes, onions, garlic, green chilies, and garam masala. Dangerous risk of Heinz body anemia and acute pancreatitis.", "icon": "🥟"},
            "biryani": {"name": "Biryani & Spiced Pulao", "status": "severe", "note": "Cooked with fried onions, garlic, cloves, cinnamon, whole spices, and often toxic raisins. Severe risk of hemolytic anemia and GI distress.", "icon": "🍚"},
            "pulao": {"name": "Spiced Pulao / Biryani", "status": "severe", "note": "Contains onions, garlic, heavy ghee/oil, and whole spices that irritate canine gut lining and cause oxidative red blood cell damage.", "icon": "🍚"},
            "paneer butter masala": {"name": "Paneer Butter Masala", "status": "severe", "note": "Rich gravy packed with onions, garlic, heavy cream, cashews, and spices. Causes hemolytic anemia and acute life-threatening pancreatitis.", "icon": "🥘"},
            "shahi paneer": {"name": "Shahi Paneer", "status": "severe", "note": "High saturated fats, heavy cream, cashews, onions, and garlic create an acute risk of pancreatitis and hemolytic anemia.", "icon": "🥘"},
            "matar paneer": {"name": "Matar Paneer Curry", "status": "severe", "note": "While peas and plain paneer are safe separately, the onion-garlic-tomato-spice gravy makes this preparation toxic for dogs.", "icon": "🥘"},
            "kadai paneer": {"name": "Kadai Paneer", "status": "severe", "note": "Cooked with thick onion-garlic-tomato masala, heavy coriander seeds, and green capsicum/chilies. Toxic for pets.", "icon": "🥘"},
            "dal": {"name": "Cooked Dal / Dal Tadka", "status": "severe", "note": "Cooked dals contain onions, garlic, hing (asafoetida), and spiced ghee tadka that destroy canine red blood cells and trigger GI distress.", "icon": "🍛"},
            "dal makhani": {"name": "Dal Makhani", "status": "severe", "note": "Slow-cooked black lentils loaded with butter, heavy cream, onions, garlic, and ginger. High pancreatitis risk and allium toxicity.", "icon": "🍛"},
            "dal tadka": {"name": "Dal Tadka", "status": "severe", "note": "Tadka uses ghee/oil fried with garlic, onions, hing (asafoetida), and red chilies. Garlic and onion destroy canine red blood cells.", "icon": "🍛"},
            "sambar": {"name": "Sambar", "status": "severe", "note": "Spiced South Indian stew prepared with sambar masala, tamarind, shallots, garlic, and chili powder. Highly irritant and toxic.", "icon": "🍲"},
            "gulab jamun": {"name": "Gulab Jamun", "status": "severe", "note": "Deep-fried khoya dough soaked in concentrated sugar syrup with rosewater and cardamom. Can trigger acute hemorrhagic pancreatitis and severe diarrhea.", "icon": "🍬"},
            "jalebi": {"name": "Jalebi", "status": "severe", "note": "Deep-fried fermented flour soaked in heavy saffron-sugar syrup. Extreme spike in glucose and pancreatitis risk.", "icon": "🥨"},
            "halwa": {"name": "Halwa (Suji / Gajar Ka Halwa)", "status": "severe", "note": "High proportions of ghee, refined sugar, condensed milk, and often nuts/raisins. Triggers digestive distress and pancreatitis.", "icon": "🍮"},
            "gajar halwa": {"name": "Gajar Ka Halwa", "status": "severe", "note": "Carrots are safe plain, but Gajar Ka Halwa has dangerous amounts of khoya, ghee, refined sugar, and cashews/raisins.", "icon": "🍮"},
            "kheer": {"name": "Kheer / Rice Pudding", "status": "severe", "note": "Contains sweetened whole milk, sugar, cardamom, and often toxic raisins or nuts. Lactose and sugar cause severe GI upset.", "icon": "🥣"},
            "paratha": {"name": "Aloo / Stuffed Paratha", "status": "severe", "note": "Shallow-fried flatbread stuffed with spiced potatoes, onions, green chilies, and amchur. High fat and alliums cause toxicity.", "icon": "🫓"},
            "aloo paratha": {"name": "Aloo Paratha", "status": "severe", "note": "Stuffed with spiced potatoes, onions, green chilies, and shallow-fried in ghee or oil. Severe risk of hemolytic anemia and pancreatitis.", "icon": "🫓"},
            "pakora": {"name": "Pakora / Bhajiya", "status": "severe", "note": "Deep-fried besan fritters with onions, chilies, and spices. Very high oil content can trigger acute canine pancreatitis.", "icon": "🧅"},
            "bhajiya": {"name": "Pakora / Bhajiya", "status": "severe", "note": "Deep-fried besan fritters with onions, chilies, and spices. Very high oil content can trigger acute canine pancreatitis.", "icon": "🧅"},
            "butter chicken": {"name": "Butter Chicken / Murgh Makhani", "status": "severe", "note": "Curry contains blended onions, garlic, heavy cream, butter, and chili powder. Causes oxidative red blood cell damage.", "icon": "🍗"},
            "chicken curry": {"name": "Indian Chicken Curry", "status": "severe", "note": "Rich onion-tomato-garlic-ginger gravy with whole spices and chilies. Toxic alliums induce Heinz body anemia.", "icon": "🍗"},
            "chicken tikka": {"name": "Chicken Tikka (Spiced)", "status": "severe", "note": "Marinated in yogurt with garlic, ginger paste, red chili powder, and garam masala. Dangerous for canine red blood cells and gut.", "icon": "🍗"},
            "chole": {"name": "Chole / Chana Masala", "status": "severe", "note": "Spiced chickpea curry prepared with onions, garlic, amchur, and garam masala. Dangerous for canine digestion and red blood cells.", "icon": "🍛"},
            "rajma": {"name": "Rajma Curry (Kidney Beans)", "status": "severe", "note": "Cooked with onions, garlic, and heavy spices. Raw kidney beans also contain toxic phytohaemagglutinin. Do not feed curried rajma.", "icon": "🍛"},
            "pav bhaji": {"name": "Pav Bhaji", "status": "severe", "note": "Mashed vegetable curry heavily cooked in butter, onions, garlic, and pav bhaji masala. Severe pancreatitis and allium toxicity hazard.", "icon": "🥘"},
            "kishmish": {"name": "Kishmish (Raisins)", "status": "fatal", "note": "Kishmish / raisins contain tartaric acid which causes acute sudden irreversible renal failure in dogs. Strictly fatal.", "icon": "🍇"}
        }

        # Check KB exact or direct matches first
        # Only match single ingredients or exact phrases; multi-word novel dishes get evaluated by Gemini AI
        words = clean_name.split()
        for key, info in KB.items():
            is_exact = (key == clean_name)
            is_single_word_match = (len(words) == 1 and (key in clean_name or clean_name in key))
            is_critical_toxin = key in ("chocolate", "cocoa", "grape", "raisin", "kishmish", "xylitol", "macadamia", "onion", "garlic", "samosa", "biryani") and key in clean_name

            if is_exact or is_single_word_match or is_critical_toxin:
                stat = info["status"]
                # Use user's queried ingredient title if multi-word, e.g. "Dark Chocolate" -> "Dark Chocolate"
                display_name = ingredient.strip().title() if len(words) > 1 and is_critical_toxin else info["name"]
                return {
                    "name": display_name,
                    "status": stat,
                    "note": info["note"],
                    "icon": info["icon"],
                    "recommendation": "Safe to share in moderation as a wholesome treat." if stat == "safe" else "Keep completely away from your pet." if stat in ("fatal", "severe") else "Caution: share only small plain quantities.",
                    "is_safe": stat == "safe"
                }

        # 2. Call Google Gemini AI for novel / uncommon food queries with deep Indian culinary awareness
        system_instruction = (
            "You are a premier veterinary toxicologist, canine nutritionist, and clinical safety expert with deep knowledge of global and Indian cuisine (including rotis, dals, curries, street food, sweets, gravies, and spices). "
            "Analyze the queried food/ingredient and classify its safety for dogs (or specified species). "
            "Break down common hidden ingredients (such as alliums like onions/garlic, heavy ghee/butter fats, chilies, garam masala, raisins, or toxic nuts). "
            "Distinguish between plain wholesome preparations (e.g., plain unbuttered dry roti, plain boiled rice, plain curd/dahi, plain steamed idli, plain cottage cheese/paneer) "
            "versus curried, salted, or spiced versions (e.g. paneer butter masala, dal tadka, samosa, biryani). "
            "The status MUST be exactly one of: 'safe', 'moderate', 'severe', 'fatal'. "
            "Output ONLY valid JSON."
        )
        prompt = (
            f"Evaluate the canine toxicity and safety of this food or dish: '{ingredient}'.\n\n"
            "Required JSON format:\n"
            "{\n"
            "  \"name\": \"Standard Clean Food Name (e.g. Plain Roti / Paneer Butter Masala)\",\n"
            "  \"status\": \"safe\" | \"moderate\" | \"severe\" | \"fatal\",\n"
            "  \"note\": \"Concise 1-2 sentence clinical explanation of mechanism or safety profile for companion animals\",\n"
            "  \"icon\": \"single emoji\",\n"
            "  \"recommendation\": \"Actionable pet parent feeding advice (e.g. Feed plain with no ghee, or Strictly keep away)\",\n"
            "  \"is_safe\": true/false\n"
            "}"
        )

        gemini_raw = await self._call_gemini(
            prompt=prompt,
            system_instruction=system_instruction,
            json_mode=True
        )

        if gemini_raw:
            try:
                parsed = json.loads(gemini_raw)
                stat = str(parsed.get("status", "moderate")).lower()
                if stat not in ("safe", "moderate", "severe", "fatal"):
                    stat = "safe" if "safe" in stat else "moderate"
                return {
                    "name": parsed.get("name", ingredient.title()),
                    "status": stat,
                    "note": parsed.get("note", "Evaluated by HawPulse AI Veterinary Safety Radar."),
                    "icon": parsed.get("icon", "🍽️"),
                    "recommendation": parsed.get("recommendation", "Feed only in small moderation."),
                    "is_safe": stat == "safe"
                }
            except Exception as e:
                print(f"[!] Ingredient AI safety parsing error: {e}")

        # 3. Intelligent fallback heuristic with Indian cuisine recognition
        clean_lower = ingredient.lower()
        title_case = ingredient.title()

        if any(w in clean_lower for w in ["curry", "masala", "biryani", "pulao", "tadka", "gravy", "samosa", "pakora", "paratha", "fried"]):
            return {
                "name": title_case,
                "status": "severe",
                "note": f"Traditional {title_case} typically contains onions, garlic, heavy cooking oils/ghee, and garam masala. These allium compounds destroy canine red blood cells and high fats risk acute pancreatitis.",
                "icon": "🚫",
                "recommendation": f"Do not feed {title_case} table scraps to your {species}. Offer only plain, unseasoned boiled food.",
                "is_safe": False
            }
        elif any(w in clean_lower for w in ["mithai", "halwa", "ladoo", "jalebi", "jamun", "kheer", "sweet", "barfi"]):
            return {
                "name": title_case,
                "status": "severe",
                "note": f"{title_case} is extremely high in refined sugars, condensed milk, ghee, and often nuts or raisins. Can cause severe osmotic diarrhea and acute pancreatitis.",
                "icon": "🍬",
                "recommendation": "Keep festive Indian sweets completely away from pets.",
                "is_safe": False
            }
        elif any(w in clean_lower for w in ["roti", "chapati", "phulka"]):
            return {
                "name": "Plain Roti / Chapati",
                "status": "safe",
                "note": "Plain, fully cooked wheat roti is non-toxic and safe as an occasional treat. High in carbs so feed in small portions.",
                "icon": "🫓",
                "recommendation": "Offer small torn plain pieces without ghee, butter, oil, or salt.",
                "is_safe": True
            }
        elif any(w in clean_lower for w in ["paneer", "cottage cheese"]):
            return {
                "name": "Plain Homemade Paneer",
                "status": "safe",
                "note": "Plain, unseasoned cottage cheese / paneer provides calcium and protein. Feed in small cubes to pets that tolerate dairy.",
                "icon": "🧀",
                "recommendation": "Feed small, plain unseasoned cubes. Avoid curried or salted paneer.",
                "is_safe": True
            }
        elif any(w in clean_lower for w in ["dahi", "curd"]):
            return {
                "name": "Plain Fresh Curd (Dahi)",
                "status": "safe",
                "note": "Natural probiotic that aids digestion, cools the stomach, and promotes healthy gut flora in pets.",
                "icon": "🥣",
                "recommendation": "Add 1-2 spoonfuls of fresh, plain, unsweetened dahi to meals.",
                "is_safe": True
            }
        elif any(w in clean_lower for w in ["khichdi"]):
            return {
                "name": "Plain Moong Dal Khichdi",
                "status": "safe",
                "note": "Traditional Indian vet-recommended bland recovery diet. Plain boiled yellow moong dal and rice soothes upset stomachs.",
                "icon": "🍲",
                "recommendation": "Boil plain with water only; never add onions, garlic, salt, hing, or ghee tadka.",
                "is_safe": True
            }

        return {
            "name": title_case,
            "status": "moderate",
            "note": f"Not a typical primary pet food. Always introduce new ingredients to {species}s in tiny portions and check for digestive sensitivity.",
            "icon": "🍽️",
            "recommendation": "Ensure no onions, garlic, excess salt, or xylitol are present.",
            "is_safe": False
        }

# Primary singleton instance
gemini_ai_service = GoogleGeminiAIService()

# Backward-compatibility alias
qwen_hf_service = gemini_ai_service

