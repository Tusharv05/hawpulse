from fastapi import APIRouter
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.pets import router as pets_router
from app.api.v1.endpoints.diary import router as diary_router
from app.api.v1.endpoints.diet import router as diet_router
from app.api.v1.endpoints.medical import router as medical_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.community import router as community_router
from app.api.v1.endpoints.calendar import router as calendar_router
from app.api.v1.endpoints.weather import router as weather_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(pets_router)
api_router.include_router(diary_router)
api_router.include_router(diet_router)
api_router.include_router(medical_router)
api_router.include_router(health_router)
api_router.include_router(community_router)
api_router.include_router(calendar_router)
api_router.include_router(weather_router)
