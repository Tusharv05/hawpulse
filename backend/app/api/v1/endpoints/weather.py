from typing import Optional, Dict, Any
from fastapi import APIRouter, Query
from app.services.weather_service import weather_service

router = APIRouter(prefix="/weather", tags=["Weather & Paw Safety"])

@router.get("/paw-forecast", response_model=Dict[str, Any])
async def get_paw_forecast(
    location: Optional[str] = Query(None, description="City name, postal code, or 'auto:ip'"),
    pet_name: Optional[str] = Query("your pet", description="Name of pet to personalize walking advisory")
):
    """
    Get real-time weather and smart pet walking & paw-burn safety advisories
    using WeatherAPI.com.
    """
    return await weather_service.get_paw_forecast(
        location_query=location,
        pet_name=pet_name
    )
