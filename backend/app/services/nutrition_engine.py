import math
from datetime import date, timedelta
from typing import Dict, Any, List, Tuple

# Comprehensive species toxic ingredient blacklists
DOG_TOXIC_FOODS = [
    "Chocolate (Theobromine)",
    "Xylitol (Artificial Sweetener)",
    "Grapes and Raisins",
    "Onions, Chives and Garlic (Allium family)",
    "Macadamia Nuts",
    "Avocado (Persin in pits/skin)",
    "Alcohol and Raw Yeast Dough",
    "Cooked Bones (Splintering hazard)",
    "Caffeine",
    "High-Sodium Processed Foods"
]

CAT_TOXIC_FOODS = [
    "Lilies (Extremely lethal to cats)",
    "Onions, Garlic, Shallots, Leeks",
    "Chocolate and Caffeine",
    "Xylitol",
    "Grapes and Raisins",
    "Raw Fish / Raw Meat (Thiamine breakdown hazard)",
    "Dairy Milk (Adult lactose intolerance)",
    "Alcohol",
    "Essential Oils (Tea tree, eucalyptus)"
]

def calculate_rer(weight_kg: float) -> float:
    """
    Calculates Resting Energy Requirement (RER) in kcal/day:
    RER = 70 * (weight_kg)^0.75
    """
    return round(70.0 * math.pow(weight_kg, 0.75), 1)

def get_der_multiplier(
    species: str,
    age_months: int,
    is_neutered: bool = False,
    is_senior: bool = False,
    is_weight_loss: bool = False,
    is_active_working: bool = False
) -> Tuple[float, str]:
    """
    Determines life-stage & physiological DER multiplier.
    Returns (multiplier, rationale).
    """
    # 1. Growing Puppies and Kittens
    if age_months < 4:
        return (3.0, "Rapid growth early life-stage (<4 months)")
    elif age_months < 12:
        return (2.0, "Juvenile growth stage (4-12 months)")
    
    # 2. Senior pets (> 8 years / 96 months)
    if is_senior or age_months >= 96:
        return (1.2, "Senior metabolic maintenance")

    # 3. Weight Management
    if is_weight_loss:
        return (1.1, "Caloric restriction for healthy weight loss")

    # 4. Active working dogs
    if is_active_working and species.lower() == "dog":
        return (2.2, "High-energy athletic activity multiplier")

    # 5. Standard Adults
    if is_neutered:
        return (1.6, "Neutered adult standard maintenance")
    else:
        return (1.8, "Intact adult standard maintenance")

def calculate_target_calories(
    species: str,
    weight_kg: float,
    birth_date: date,
    is_neutered: bool = False,
    diet_preset: str = ""
) -> Dict[str, Any]:
    if isinstance(birth_date, str):
        try:
            birth_date = date.fromisoformat(birth_date.split("T")[0])
        except Exception:
            birth_date = date.today() - timedelta(days=365 * 2)

    today = date.today()
    age_months = max(1, (today.year - birth_date.year) * 12 + (today.month - birth_date.month))
    
    is_weight_loss = "weight" in diet_preset.lower() or "cut" in diet_preset.lower()
    is_senior = age_months >= 96 or "senior" in diet_preset.lower()
    is_active = "active" in diet_preset.lower() or "athletic" in diet_preset.lower()

    rer = calculate_rer(weight_kg)
    multiplier, reason = get_der_multiplier(
        species=species,
        age_months=age_months,
        is_neutered=is_neutered,
        is_senior=is_senior,
        is_weight_loss=is_weight_loss,
        is_active_working=is_active
    )
    
    target_der = int(round(rer * multiplier))
    
    # Daily water intake guideline (approx 50-60 ml per kg body weight)
    water_ml = int(round(weight_kg * 55))
    
    # Meals per day: Puppies/kittens eat 3-4 times, adults 2 times
    meals_per_day = 3 if age_months < 6 else 2
    
    # Portion weight estimation (assuming average standard ~3.5 kcal/gram of balanced pet food)
    total_food_grams = round(target_der / 3.65, 1)
    portion_grams_per_meal = round(total_food_grams / meals_per_day, 1)
    
    return {
        "rer_kcal": rer,
        "der_multiplier": multiplier,
        "multiplier_reason": reason,
        "target_der_kcal": target_der,
        "daily_water_ml": water_ml,
        "meals_per_day": meals_per_day,
        "total_food_grams_per_day": total_food_grams,
        "portion_grams_per_meal": portion_grams_per_meal,
        "age_months": age_months
    }

def get_species_toxic_foods(species: str) -> List[str]:
    """Returns species-specific toxic food blacklist."""
    if species.lower() == "cat":
        return CAT_TOXIC_FOODS
    return DOG_TOXIC_FOODS

def get_grooming_guideline(species: str, breed: str) -> Dict[str, str]:
    """Generates breed-specific coat grooming rhythm."""
    breed_lower = breed.lower()
    if "poodle" in breed_lower or "doodle" in breed_lower or "bichon" in breed_lower:
        return {
            "brushing_frequency": "Daily (Prevents severe matting in curly wool coat)",
            "bathing_frequency": "Every 3 to 4 weeks",
            "ear_cleaning": "Weekly inspection (high ear canal hair growth)"
        }
    elif "golden" in breed_lower or "shepherd" in breed_lower or "husky" in breed_lower or "retriever" in breed_lower:
        return {
            "brushing_frequency": "Every 2 days (Dense double undercoat)",
            "bathing_frequency": "Every 6 to 8 weeks",
            "ear_cleaning": "Bi-weekly inspection"
        }
    elif "persian" in breed_lower or "ragdoll" in breed_lower or "maine coon" in breed_lower:
        return {
            "brushing_frequency": "Daily wide-tooth comb (prevents hairballs & pelt matting)",
            "bathing_frequency": "Every 8 weeks or as needed",
            "ear_cleaning": "Weekly wipe down"
        }
    else:
        return {
            "brushing_frequency": "2-3 times per week",
            "bathing_frequency": "Every 4 to 6 weeks",
            "ear_cleaning": "Bi-weekly ear check"
        }
