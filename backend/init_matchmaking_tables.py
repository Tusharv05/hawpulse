import asyncio
from sqlalchemy import text
from app.core.database import engine, Base
from app.models.profile import Profile
from app.models.pet import Pet
from app.models.diary import DiaryEvent
from app.models.diet import DietPlan, MealSchedule
from app.models.medical import Prescription, Vaccination
from app.models.community import CommunityEvent, EventRSVP, PetSwipe, PetMatch, DirectMessage

async def init_tables():
    print("[*] Connecting to PostgreSQL and synchronizing schema...")
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE pets ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}';"))
        # Profiles extended columns
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender VARCHAR;"))
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hobbies VARCHAR;"))
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vibe_routine VARCHAR;"))
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;"))
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS household_mode VARCHAR DEFAULT 'solo';"))
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS partner_name VARCHAR;"))
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS partner_gender VARCHAR;"))
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS partner_hobbies VARCHAR;"))
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS partner_vibe VARCHAR;"))
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url VARCHAR;"))
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS partner_avatar_url VARCHAR;"))
        await conn.run_sync(Base.metadata.create_all)
    print("[SUCCESS] PostgreSQL updated: 'pet_swipes', 'pet_matches', 'direct_messages' tables and 'profiles' extended fields are live!")

if __name__ == "__main__":
    asyncio.run(init_tables())
