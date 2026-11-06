import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
try:
    from geoalchemy2 import Geography  # type: ignore
except (ImportError, ModuleNotFoundError):
    from sqlalchemy.types import UserDefinedType
    class Geography(UserDefinedType):  # type: ignore
        def __init__(self, *args, **kwargs):
            pass

from app.core.database import Base

class CommunityEvent(Base):
    __tablename__ = "community_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    city = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    location_name = Column(String, nullable=False)
    event_geom = Column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    event_time = Column(DateTime(timezone=True), nullable=False)
    max_attendees = Column(Integer, default=15)
    requires_verified_vax = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class EventRSVP(Base):
    __tablename__ = "event_rsvps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("community_events.id", ondelete="CASCADE"), nullable=False)
    pet_id = Column(UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False, default="going")  # 'going', 'interested', 'cancelled'
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("event_id", "pet_id", name="uq_event_pet_rsvp"),
    )

class PetSwipe(Base):
    __tablename__ = "pet_swipes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_pet_id = Column(UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    target_pet_id = Column(UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String, nullable=False)  # 'like' or 'pass'
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("sender_pet_id", "target_pet_id", name="uq_pet_swipe"),
    )

class PetMatch(Base):
    __tablename__ = "pet_matches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet1_id = Column(UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    pet2_id = Column(UUID(as_uuid=True), ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    user1_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    user2_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("pet1_id", "pet2_id", name="uq_pet_match"),
    )

class DirectMessage(Base):
    __tablename__ = "direct_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id = Column(UUID(as_uuid=True), ForeignKey("pet_matches.id", ondelete="CASCADE"), nullable=True, index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
