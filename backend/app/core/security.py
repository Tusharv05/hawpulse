import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import jwt, JWTError
from fastapi import HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

security_bearer = HTTPBearer()

# In-memory store for OTPs
_otp_store: Dict[str, Dict[str, Any]] = {}

def generate_otp() -> str:
    """Generates a secure 6-digit numerical OTP."""
    return f"{secrets.randbelow(900000) + 100000}"

def store_otp(email: str, otp: str, ttl_minutes: int = 10) -> None:
    """Stores OTP with expiry timestamp (default 10 minutes)."""
    _otp_store[email.strip().lower()] = {
        "otp": otp.strip(),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    }

def verify_otp(email: str, otp: str) -> bool:
    """Verifies submitted OTP against cached entry."""
    entry = _otp_store.get(email.strip().lower())
    if not entry:
        return False
    if datetime.now(timezone.utc) > entry["expires_at"]:
        del _otp_store[email.strip().lower()]
        return False
    if entry["otp"] == otp.strip():
        del _otp_store[email.strip().lower()]
        return True
    return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    """Decodes and validates a JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Security(security_bearer)) -> str:
    """FastAPI dependency to extract current authenticated user UUID."""
    payload = decode_token(credentials.credentials)
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing subject identifier"
        )
    return user_id

security_bearer_optional = HTTPBearer(auto_error=False)

async def get_current_user_id_optional(credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer_optional)) -> Optional[str]:
    """FastAPI dependency to optionally extract current authenticated user UUID without throwing 401."""
    if not credentials or not credentials.credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except Exception:
        return None

