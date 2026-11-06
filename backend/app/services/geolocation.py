import math
import random
import httpx
from typing import Tuple, Dict, Any, Optional

# Free OpenStreetMap Nominatim endpoint
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"

async def reverse_geocode(latitude: float, longitude: float) -> Dict[str, Any]:
    """
    Reverse-geocodes coordinates into City and Neighborhood using OpenStreetMap Nominatim.
    Completely free, open standard, requires zero API keys.
    """
    params = {
        "lat": latitude,
        "lon": longitude,
        "format": "json",
        "addressdetails": 1
    }
    headers = {
        "User-Agent": "HawPulse-App/2.0 (contact: supporthawpulse@gmail.com)"
    }
    
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.get(NOMINATIM_REVERSE_URL, params=params, headers=headers)
            if response.status_code == 200:
                data = response.json()
                address = data.get("address", {})
                
                # Extract city (with fallbacks for town, village, county)
                city = (
                    address.get("city") or
                    address.get("town") or
                    address.get("village") or
                    address.get("municipality") or
                    address.get("county") or
                    "Local City"
                )
                
                # Extract neighborhood / suburb
                neighborhood = (
                    address.get("suburb") or
                    address.get("neighbourhood") or
                    address.get("quarter") or
                    address.get("district") or
                    address.get("residential") or
                    city
                )
                
                return {
                    "city": city,
                    "area_neighborhood": neighborhood,
                    "display_name": data.get("display_name", "")
                }
    except Exception as e:
        print(f"[!] Reverse geocode warning: {e}. Falling back to default locality.")

    return {
        "city": "Nearby City",
        "area_neighborhood": "Central Neighborhood",
        "display_name": ""
    }

def sanitize_fuzzy_location(latitude: float, longitude: float, fuzz_radius_meters: float = 350.0) -> Tuple[float, float]:
    """
    Privacy Sanitizer: Snaps coordinates to a local public radius (~300-500m)
    so exact residential home addresses are never persisted or exposed.
    """
    # Deterministic or slight pseudo-random displacement within fuzz radius
    radius_in_degrees = fuzz_radius_meters / 111320.0
    u = random.random()
    v = random.random()
    w = radius_in_degrees * math.sqrt(u)
    t = 2 * math.pi * v
    delta_lat = w * math.cos(t)
    delta_lon = (w * math.sin(t)) / math.cos(math.radians(latitude))
    
    fuzzy_lat = round(latitude + delta_lat, 5)
    fuzzy_lon = round(longitude + delta_lon, 5)
    return fuzzy_lat, fuzzy_lon
