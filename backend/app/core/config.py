import os
from typing import List
try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:
    try:
        from pydantic import BaseSettings
        SettingsConfigDict = None
    except ImportError:
        from pydantic import BaseModel as BaseSettings
        SettingsConfigDict = None

class Settings(BaseSettings):
    PROJECT_NAME: str = "HawPulse AI API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database: PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://neondb_owner:YOUR_NEON_PASSWORD@ep-example-pooler.us-east-2.aws.neon.tech/neondb?ssl=require"

    # Hugging Face Inference API for Qwen/Qwen2.5-VL-7B-Instruct
    HF_TOKEN: str = ""
    HF_MODEL_ID: str = "Qwen/Qwen2.5-VL-7B-Instruct"

    # Google Gemini AI (Multimodal Vision & Intelligence)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL_ID: str = "gemini-3.1-flash-lite-preview"

    # Redis Cache & Task Queue
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    JWT_SECRET: str = "pawcircle_dev_secret_change_in_production_key_12345"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days

    # Google Calendar API (Automated Background Sync)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/calendar/callback"

    # S3 / Cloudflare R2 Storage
    S3_ENDPOINT_URL: str = ""
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    S3_BUCKET_NAME: str = "pawcircle-documents"
    S3_REGION: str = "auto"

    # Email / SMTP Settings (Real Email Dispatch for OTP & Alerts)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = ""
    EMAILS_FROM_NAME: str = "HawPulse Team"
    RESEND_API_KEY: str = ""

    # Real-Time Weather API (WeatherAPI.com)
    WEATHER_API_KEY: str = "d47d0bdda08c4acf9a3100404261309"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
        "https://*.vercel.app",
        "*"
    ]

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
