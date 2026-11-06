import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
try:
    from geoalchemy2 import Geography  # type: ignore
except (ImportError, ModuleNotFoundError):
    from sqlalchemy.types import UserDefinedType
    class Geography(UserDefinedType):  # type: ignore
        def __init__(self, *args, **kwargs):
            pass

from app.core.database import Base

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=True)
    city = Column(String, nullable=False, default="Default City")
    area_neighborhood = Column(String, nullable=True)
    location_geom = Column(Geography(geometry_type="POINT", srid=4326), nullable=True)
    is_first_time_parent = Column(Boolean, default=False)
    gender = Column(String, nullable=True)
    hobbies = Column(String, nullable=True)
    vibe_routine = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    household_mode = Column(String, nullable=True, default="solo")
    partner_name = Column(String, nullable=True)
    partner_gender = Column(String, nullable=True)
    partner_hobbies = Column(String, nullable=True)
    partner_vibe = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    partner_avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
