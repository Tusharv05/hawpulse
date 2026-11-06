import httpx
from typing import Optional, Dict, Any
from app.core.config import settings

class WeatherService:
    BASE_URL = "https://api.weatherapi.com/v1"

    async def get_paw_forecast(
        self,
        location_query: Optional[str] = None,
        pet_name: Optional[str] = "your pet"
    ) -> Dict[str, Any]:
        """
        Fetches real-time weather from WeatherAPI.com and derives
        smart veterinary paw-care & walking advisories.
        """
        api_key = (settings.WEATHER_API_KEY or "d47d0bdda08c4acf9a3100404261309").strip()
        pet = pet_name.strip() if pet_name and pet_name.strip() else "your pet"
        if pet.islower():
            pet = pet.capitalize()
        
        # Sanitize query: fallback to auto:ip if not provided or placeholder
        q = location_query.strip() if location_query and location_query.strip() else ""
        if not q or q.lower() in ["detecting city...", "default city", "unknown", "none", "null"]:
            q = "auto:ip"

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/forecast.json",
                    params={"key": api_key, "q": q, "days": 1}
                )
                if resp.status_code != 200:
                    # Retry with auto:ip if specific city query failed (e.g. invalid neighborhood)
                    if q != "auto:ip":
                        resp = await client.get(
                            f"{self.BASE_URL}/forecast.json",
                            params={"key": api_key, "q": "auto:ip", "days": 1}
                        )
                
                if resp.status_code == 200:
                    data = resp.json()
                    return self._build_paw_advisory(data, pet)
        except Exception as e:
            print("[WeatherAPI Note]:", e)

        # Fallback graceful response
        return {
            "city": "Local Area",
            "region": "",
            "country": "",
            "temp_c": 29,
            "temp_f": 84,
            "condition": "Warm & Sunny",
            "condition_icon": "https://cdn.weatherapi.com/weather/64x64/day/113.png",
            "icon_name": "sunny",
            "title": "Warm day ahead (29°C)",
            "advisory": f"Walk {pet} before 10 AM or after 5 PM to prevent hot pavement burns.",
            "level": "warning",
            "humidity": 45,
            "uv": 5.0,
            "feelslike_c": 29,
            "is_day": 1,
            "is_realtime": False
        }

    def _build_paw_advisory(self, data: Dict[str, Any], pet: str) -> Dict[str, Any]:
        current = data.get("current", {})
        location = data.get("location", {})
        forecast_days = data.get("forecast", {}).get("forecastday", [])
        forecast_day = forecast_days[0].get("day", {}) if forecast_days else {}

        temp_c = round(current.get("temp_c") if current.get("temp_c") is not None else 25)
        temp_f = round(current.get("temp_f") if current.get("temp_f") is not None else 77)
        feelslike_c = round(current.get("feelslike_c") if current.get("feelslike_c") is not None else temp_c)
        is_day = current.get("is_day", 1)

        condition_data = current.get("condition", {})
        condition_text = condition_data.get("text", "Clear")
        condition_icon = condition_data.get("icon", "")
        if condition_icon and condition_icon.startswith("//"):
            condition_icon = f"https:{condition_icon}"

        city = location.get("name", "Local Area")
        region = location.get("region", "")
        country = location.get("country", "")
        max_temp_c = round(forecast_day.get("maxtemp_c") if forecast_day.get("maxtemp_c") is not None else temp_c)
        min_temp_c = round(forecast_day.get("mintemp_c") if forecast_day.get("mintemp_c") is not None else temp_c)
        uv = current.get("uv", 3.0)
        humidity = current.get("humidity", 50)
        wind_kph = current.get("wind_kph", 0)

        cond_lower = condition_text.lower()

        # Clinical pet walking safety advice
        if temp_c >= 33 or (is_day and max_temp_c >= 35):
            title = f"Extreme heat advisory ({temp_c}°C)"
            advisory = f"High pavement burn risk! Walk {pet} on grass only before 9 AM or after 7 PM. Keep water accessible."
            icon_name = "wb_sunny"
            level = "danger"
        elif any(w in cond_lower for w in ["thunder", "heavy rain", "torrential", "storm"]):
            title = f"Storm alert ({temp_c}°C)"
            advisory = f"Severe conditions outside! Keep walks brief for {pet} and dry paws immediately after returning."
            icon_name = "thunderstorm"
            level = "danger"
        elif any(w in cond_lower for w in ["rain", "drizzle", "shower"]):
            title = f"{condition_text} ({temp_c}°C)"
            advisory = f"Wet paws alert! Dry {pet}'s paws thoroughly after outdoor walks to prevent moisture irritation."
            icon_name = "rainy"
            level = "info"
        elif any(w in cond_lower for w in ["smoke", "haze", "smog", "dust"]):
            title = f"{condition_text} ({temp_c}°C)"
            advisory = f"Air quality notice: Keep outdoor cardio gentle for {pet}. Opt for indoor sniff enrichment."
            icon_name = "foggy"
            level = "warning"
        elif temp_c < 7 or any(w in cond_lower for w in ["snow", "blizzard", "ice", "frost"]):
            title = f"Cold weather advisory ({temp_c}°C)"
            advisory = f"Brisk cold! Keep walks short for {pet} and check paw pads for ice or road salt."
            icon_name = "ac_unit"
            level = "warning"
        elif temp_c >= 28 or (is_day and max_temp_c >= 30):
            title = f"Warm day ahead ({temp_c}°C)"
            advisory = f"Walk {pet} before 10 AM or after 5 PM to prevent hot pavement burns."
            icon_name = "sunny"
            level = "warning"
        elif 16 <= temp_c < 28:
            if is_day == 0:
                title = f"Pleasant evening ({temp_c}°C)"
                advisory = f"Cool pavements and calm breeze. Great time for a relaxing walk with {pet}."
                icon_name = "nights_stay"
                level = "good"
            else:
                title = f"Pleasant day ahead ({temp_c}°C)"
                advisory = f"Ideal walking weather for {pet}! Great time for a longer park walk, frisbee, or pack playdate."
                icon_name = "park"
                level = "good"
        else:
            title = f"{condition_text} ({temp_c}°C)"
            advisory = f"Good conditions for {pet}'s daily routine. Enjoy your walks together!"
            icon_name = "routine"
            level = "good"

        return {
            "city": city,
            "region": region,
            "country": country,
            "temp_c": temp_c,
            "temp_f": temp_f,
            "feelslike_c": feelslike_c,
            "max_temp_c": max_temp_c,
            "min_temp_c": min_temp_c,
            "is_day": is_day,
            "condition": condition_text,
            "condition_icon": condition_icon,
            "icon_name": icon_name,
            "title": title,
            "advisory": advisory,
            "level": level,
            "humidity": humidity,
            "uv": uv,
            "wind_kph": wind_kph,
            "is_realtime": True
        }

weather_service = WeatherService()
