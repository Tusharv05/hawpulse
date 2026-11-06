import asyncio
from sqlalchemy import text
from app.core.database import engine, Base
import app.models  # Ensure all models are registered with Base.metadata

async def init_database():
    """Initializes extensions and creates all tables on PostgreSQL."""
    print("[*] Connecting to PostgreSQL...")
    async with engine.begin() as conn:
        print("[*] Enabling extensions: 'uuid-ossp' and 'postgis'...")
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS postgis;'))
        
        print("[*] Creating all application tables...")
        await conn.run_sync(Base.metadata.create_all)

        print("[*] Ensuring profiles extended columns are present...")
        for col_def in [
            "gender VARCHAR",
            "hobbies VARCHAR",
            "vibe_routine VARCHAR",
            "bio TEXT",
            "household_mode VARCHAR DEFAULT 'solo'",
            "partner_name VARCHAR",
            "partner_gender VARCHAR",
            "partner_hobbies VARCHAR",
            "partner_vibe VARCHAR",
            "avatar_url VARCHAR",
            "partner_avatar_url VARCHAR"
        ]:
            col_name = col_def.split()[0]
            await conn.execute(text(f"ALTER TABLE profiles ADD COLUMN IF NOT EXISTS {col_def};"))

        print("[SUCCESS] All tables and columns created successfully!")

if __name__ == "__main__":
    asyncio.run(init_database())
