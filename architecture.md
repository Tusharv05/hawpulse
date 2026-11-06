# PawCircle: Technical Architecture Document

## 1. System Overview & Architectural Vision

PawCircle is an intelligent pet care companion and localized community ecosystem. The system bridges daily pet diary logs, precision AI-driven nutrition, multimodal veterinary document intelligence, and privacy-preserving neighborhood community discovery.

The architecture is designed around a modern, cloud-native decoupled stack optimized for rapid deployment and serverless autoscaling:
- **Frontend:** Hosted on **Vercel** (ReactJS PWA) with an optional companion interactive app on **Streamlit** (for rapid testing, admin controls, and vet triage demos).
- **Backend API & Background Dispatcher:** Hosted on **Railway** (Python FastAPI container + Celery/ARQ with Redis for real-time Web Push alerts).
- **Database:** **Neon Serverless PostgreSQL** with **PostGIS** extension enabled (`GEOGRAPHY(Point, 4326)`), autoscaling storage, and pooled connection strings.
- **AI & Multimodal Vision-Language Engine:** **`Qwen/Qwen2.5-VL-7B-Instruct`** accessed directly from **Hugging Face** (Hugging Face Inference Endpoints / Serverless Inference API via `huggingface_hub` `InferenceClient`).

---

## 2. Technology Stack & Deployment Topology

| Layer | Technology | Provider / Host | Purpose & Justification |
| :--- | :--- | :--- | :--- |
| **Frontend SPA / PWA** | React 18+ (TypeScript, Vite) | **Vercel** | Instant edge CDN deployment, zero-config CI/CD, PWA Service Worker for offline diary & Web Push alerts. |
| **Interactive Companion / Admin** | Streamlit | **Streamlit Community Cloud** or **Railway** | Rapid testing hub for pet owners/vets to demo Qwen2.5-VL diet generation, prescription OCR, and vaccine analysis. |
| **Backend API** | Python 3.11+, FastAPI | **Railway** | High-concurrency asynchronous endpoints, automated container builds via GitHub integration, native Pydantic v2 validation. |
| **Serverless Database** | PostgreSQL 16+ with PostGIS | **Neon (`neon.tech`)** | True serverless database with automated branching, pgBouncer connection pooling (`sslmode=require`), and spatial indexing (`ST_DWithin`). |
| **Vector Engine (Optional/Ext)** | pgvector | **Neon** | Extension enabled in Neon for semantic indexing over clinical veterinary FAQs and symptoms. |
| **Vision-Language Model (VLM)** | `Qwen/Qwen2.5-VL-7B-Instruct` | **Hugging Face** | SOTA 7B multimodal open model handling high-resolution prescription/vaccine card OCR, structured diet reasoning, and health Q&A. |
| **Model Inference SDK** | `huggingface_hub.InferenceClient` | Hugging Face API / Dedicated Endpoint | Direct serverless or dedicated endpoint calling via OpenAI-compatible API or Hugging Face multimodal chat completion API. |
| **Task Queue & Caching** | Celery / ARQ + Redis | **Railway Redis** or **Upstash** | Background scheduler for dual-mode meal alerts, one-shot snooze alarms, and asynchronous document parsing. |
| **Object Storage** | Cloudflare R2 / AWS S3 | Cloudflare / AWS | Secure, S3-compatible asset store for prescription scans, vaccine booklet photos, and pet avatars with presigned URLs. |

---

## 3. High-Level Component & Deployment Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT TIER                                          │
│                                                                                        │
│   ┌─────────────────────────────────────────┐   ┌──────────────────────────────────┐   │
│   │   Primary ReactJS PWA (Vercel)          │   │  Companion Testing App           │   │
│   │   • 1-Tap Daily Diary Feed              │   │  (Streamlit Cloud / Railway)     │   │
│   │   • AI Nutrition Generator              │   │  • Interactive AI Playground     │   │
│   │   • Medical Vault (Camera & OCR)        │   │  • Vet Prescription Reviewer     │   │
│   │   • PostGIS Radar & Meetup RSVPs        │   │  • Model Diagnostics             │   │
│   │   • Service Worker (Web Push Alarms)    │   │                                  │   │
│   └────────────────────┬────────────────────┘   └─────────────────┬────────────────┘   │
└────────────────────────┼──────────────────────────────────────────┼────────────────────┘
                         │ HTTPS / REST / SSE                       │ Direct API / HF
                         ▼                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND API TIER (Railway)                                │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │  FastAPI Gateway (Railway Container)                                           │   │
│   │  • Passwordless Magic Link / OTP Auth Controller (JWT)                         │   │
│   │  • Pet Profile & Experience Assessment                                         │   │
│   │  • Deterministic Caloric Formula Engine (RER/DER Math)                         │   │
│   │  • Community Radar Controller (PostGIS spatial queries)                        │   │
│   │  • Emergency Poison / Red-Flag Triage Guardrail                                │   │
│   └──────────────────────┬───────────────────────────────────┬─────────────────────┘   │
│                          │                                   │                         │
│                          ▼                                   ▼                         │
│   ┌──────────────────────────────────────┐   ┌─────────────────────────────────────┐   │
│   │ Background Worker (Celery / ARQ)     │   │ Hugging Face AI Client Module       │   │
│   │ • Scheduled Meal Alert Cron          │   │ • `huggingface_hub.InferenceClient` │   │
│   │ • Web Push Notification Dispatcher   │   │ • Model: Qwen/Qwen2.5-VL-7B-Instruct│   │
│   │ • Asynchronous Heavy OCR Worker      │   │ • Vision Prompts & JSON Validation  │   │
│   └──────────────────────┬───────────────┘   └───────────────┬─────────────────────┘   │
└──────────────────────────┼───────────────────────────────────┼─────────────────────────┘
                           │                                   │
                           ▼                                   ▼
┌──────────────────────────────────────────────┐   ┌─────────────────────────────────────┐
│          CACHE & QUEUE (Railway / Upstash)   │   │  AI CLOUD (Hugging Face)            │
│  • Redis 7.x Instance                        │   │  • Qwen/Qwen2.5-VL-7B-Instruct      │
│  • Session Tokens & Rate Limiting            │   │  • Multimodal Document Vision API   │
│  • Meal Alert Schedule Queue                 │   │  • Structured Text Generation       │
└──────────────────────────────────────────────┘   └─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA PERSISTENCE TIER (Neon)                              │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │  Neon Serverless PostgreSQL (PostgreSQL 16 + PostGIS)                          │   │
│   │  • Connection Pooling via PgBouncer (`?sslmode=require&pooler=true`)           │   │
│   │  • Tables: `profiles`, `pets`, `diet_plans`, `meal_schedules`, `diary_events`, │   │
│   │            `prescriptions`, `vaccinations`, `community_events`, `event_rsvps`  │   │
│   │  • Spatial Indexing (`GEOGRAPHY(Point, 4326)` & `ST_DWithin`)                  │   │
│   │  • Autoscaling compute & storage with instant development branching            │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │  Cloudflare R2 / AWS S3: Presigned Object Storage for Rx & Vaccine Photos      │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed AI Subsystems & Data Flow

PawCircle leverages **`Qwen/Qwen2.5-VL-7B-Instruct`** hosted on **Hugging Face** across four core functional modules. The Python backend communicates with Hugging Face using the official `huggingface_hub` SDK or the Hugging Face OpenAI-compatible endpoint.

### 4.1. Subsystem 1: AI Diet & Meal Plan Generator

A hybrid engine combining deterministic veterinary math with Hugging Face's Qwen2.5-VL for ingredient selection, allergy compliance, and coat-specific grooming rhythm.

#### Nutritional Formula:
1. **Resting Energy Requirement (RER):**
   $$\text{RER} = 70 \times (\text{weight}_{\text{kg}})^{0.75}$$
2. **Daily Energy Requirement (DER):**
   $$\text{DER} = \text{RER} \times \text{LifeStageMultiplier}$$

#### Data Flow:
```
[User Input in React (Vercel) / Streamlit]
       │
       ▼
[POST /api/v1/diet/generate -> FastAPI on Railway]
       │
       ▼
[Fetch Pet Profile from Neon Postgres: Breed, Age, Weight, Allergies, Neutered]
       │
       ▼
[Compute RER and DER in Python] ──> Inject calculated kcal into prompt context
       │
       ▼
[Call Hugging Face Inference API]
  - Client: `InferenceClient(model="Qwen/Qwen2.5-VL-7B-Instruct", token=HF_TOKEN)`
  - Endpoint: `chat.completions.create(messages=[...], response_format={"type": "json_object"})`
  - Enforces allergen exclusion, portion grams split over 2-4 meals, grooming frequency.
       │
       ▼
[Pydantic Validation in FastAPI]
       │
       ▼
[Store structured JSON in Neon `diet_plans` table]
       │
       ▼
[Optional: User clicks "Adopt Schedule"] ──> Insert records into Neon `meal_schedules`
```

---

### 4.2. Subsystem 2: Smart Medical Vault - Prescription Simplifier

Veterinary slips often feature handwritten instructions, pharmaceutical trade names, and abbreviations (`BID`, `q12h`, `SID`, `PO`).

#### Data Flow:
```
[User captures photo of prescription in React UI]
       │
       ▼
[Upload to FastAPI (Railway) -> Persist image in Cloudflare R2 / S3]
       │
       ▼
[Encode image to Base64 or pass secure presigned public URL]
       │
       ▼
[Call Hugging Face Qwen2.5-VL-7B-Instruct Multimodal API]
  - Payload:
    messages=[
      {
        "role": "user",
        "content": [
          {"type": "image_url", "image_url": {"url": "https://r2.../rx.webp"}},
          {"type": "text", "text": "Extract diagnosis, medications, dosages, and translate into Grade 6 plain language in JSON."}
        ]
      }
    ]
       │
       ▼
[FastAPI receives structured output from Hugging Face]
  - Parsed diagnosis (e.g., "Otitis Externa")
  - Plain-language explanation ("Bacterial ear infection causing redness and itching")
  - Structured medications (Drug name, form, dose, frequency, with meals)
       │
       ▼
[Save record to Neon `prescriptions` table]
       │
       ▼
[1-Tap "Add Medication Alarms" populates reminders in Redis / Railway worker]
```

---

### 4.3. Subsystem 3: Vaccine Booklet Scanner & Immunization Roadmap

#### Data Flow:
```
[Photo of physical vaccine booklet uploaded]
       │
       ▼
[Hugging Face Qwen2.5-VL-7B-Instruct Vision OCR]
  - Scans label stickers, handwritten batch numbers, and clinic stamps.
  - Extracts: Vaccine Name, Administration Date, Batch Number, Next Due Date.
       │
       ▼
[FastAPI Immunization Engine]
  - Validates against canine/feline vaccination protocols (DHPP, Rabies, Lepto).
  - Flags `is_verified = true` if clinic stamp / sticker is confirmed.
  - Stores records in Neon `vaccinations` table.
       │
       ▼
[Calculate Safe Walk Immunity Progress]
  - Evaluates core puppy/kitten series completion.
  - Returns protection percentage (e.g., 75% protected) and grants "Verified Vaccine Badge" for community meetups.
```

---

### 4.4. Subsystem 4: AI Pet Health Assistant with Emergency Triage

A conversational wellness assistant grounded in the pet's profile, recent diary logs, and medical records.

#### Safety & Triage Architecture:
```
[User Chat Message: "My puppy ate chocolate and is lethargic"]
       │
       ▼
[FastAPI Emergency Pre-Filter (Regex & Toxic Token Classifier)]
       │
       ├── TOXIC / RED-FLAG MATCH FOUND ─────────────────────────────────────────┐
       │                                                                         │
       ▼                                                                         ▼
[Normal Grounded Chat Branch]                                     [Emergency Immediate Override]
  - Assemble Context:                                              - Bypasses model queue
    * Pet Name, Breed, Weight, Allergies from Neon                 - Returns high-priority alert:
    * Active prescriptions & vaccinations                             "CRITICAL: Chocolate is toxic to dogs.
  - Call Hugging Face Qwen2.5-VL-7B-Instruct                          Seek immediate emergency vet care."
  - Stream tokens back to React / Streamlit client                 - Queries nearest 24/7 ER Vet contacts
  - Mandates clear non-diagnostic advisory disclaimers.               based on user's Neon profile city.
```

---

## 5. Query Flow Text Diagrams

### 5.1. End-to-End Query Flow: Diet Generation

```
User (Vercel React / Streamlit)          FastAPI (Railway)            Neon Database (Postgres)         Hugging Face (Qwen2.5-VL)
             │                                   │                               │                                 │
             │── 1. POST /api/v1/diet/generate ─>│                               │                                 │
             │      (Pet ID + Prompt/Preset)     │── 2. Fetch Pet Profile ──────>│                                 │
             │                                   │<─ Pet Data (Weight, Age, etc)─│                                 │
             │                                   │                               │                                 │
             │                                   │── 3. Calculate RER & DER Math │                                 │
             │                                   │      Build JSON Prompt Context│                                 │
             │                                   │                               │                                 │
             │                                   │── 4. Chat Completion Request ──────────────────────────────────>│
             │                                   │      (Model: Qwen2.5-VL-7B-Instruct)                            │
             │                                   │                               │                                 │
             │                                   │                               │                 ┌───────────────┴───────────────┐
             │                                   │                               │                 │ Hugging Face Inference Engine │
             │                                   │                               │                 │ Calculates portions & foods   │
             │                                   │                               │                 └───────────────┬───────────────┘
             │                                   │<─ 5. Return Structured JSON ────────────────────────────────────│
             │                                   │                               │                                 │
             │                                   │── 6. Pydantic Schema Check    │                                 │
             │                                   │── 7. Save to `diet_plans` ───>│                                 │
             │                                   │<─ DB Insert Acknowledged ─────│                                 │
             │                                   │                               │                                 │
             │<─ 8. HTTP 200 (Diet Plan JSON) ───│                               │                                 │
             │                                   │                               │                                 │
             │── 9. User clicks "Adopt Schedule" │                               │                                 │
             │      POST /api/v1/diet/adopt ────>│── 10. Insert `meal_schedules`>│                                 │
             │                                   │── 11. Schedule WebPush Alerts │                                 │
             │<─ 12. Schedule Activated ─────────│       in Redis/Railway Worker │                                 │
```

### 5.2. Multimodal OCR Query Flow: Prescription Simplifier

```
User Camera (React / Streamlit)          FastAPI (Railway)              Cloudflare R2 / S3             Hugging Face (Qwen2.5-VL)         Neon Postgres
             │                                   │                               │                                 │                    │
             │── 1. Upload Rx Image ────────────>│                               │                                 │                    │
             │                                   │── 2. Write image buffer ─────>│                                 │                    │
             │                                   │<─ Public / Presigned URL ─────│                                 │                    │
             │                                   │                                                                 │                    │
             │                                   │── 3. Multimodal Inference Request ─────────────────────────────>│                    │
             │                                   │      (Image URL + Plain Language Extraction Prompt)             │                    │
             │                                   │                                                                 │                    │
             │                                   │<─ 4. Structured JSON (Diagnosis, Plain Translation, Meds) ──────│                    │
             │                                   │                                                                                      │
             │                                   │── 5. Insert row into `prescriptions` table ─────────────────────────────────────────>│
             │                                   │<─ Record Created ────────────────────────────────────────────────────────────────────│
             │                                   │                                                                                      │
             │<─ 6. Return Rx Breakdown Card ────│                                                                                      │
             │   with "Add Alarms" CTA           │                                                                                      │
```

---

## 6. Neon Serverless PostgreSQL Database Configuration

### 6.1. Connection Setup & Async Engine Configuration
Neon provides serverless PostgreSQL with pooled endpoints (via PgBouncer). When configuring SQLAlchemy with `asyncpg` on Railway, the pooled connection string with SSL is used:

```python
# backend/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

# Neon connection string example:
# postgresql+asyncpg://user:password@ep-cool-butterfly-123456-pooler.us-east-2.aws.neon.tech/neondb?ssl=require
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_recycle=300,
    pool_pre_ping=True,
    connect_args={"ssl": True}
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)
```

### 6.2. Neon Database Schema (PostgreSQL 16 + PostGIS)

```sql
-- Run inside Neon SQL Editor or via Alembic migration
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Profiles & Location
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    city TEXT NOT NULL,
    area_neighborhood TEXT,
    location_geom GEOGRAPHY(Point, 4326),
    is_first_time_parent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_location ON profiles USING GIST(location_geom);

-- 2. Pets & Dietary Profiles
CREATE TABLE pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    species TEXT NOT NULL CHECK (species IN ('dog', 'cat')),
    breed TEXT NOT NULL,
    birth_date DATE NOT NULL,
    weight_kg NUMERIC(5, 2) NOT NULL,
    allergies TEXT[] DEFAULT '{}',
    energy_level TEXT CHECK (energy_level IN ('low', 'moderate', 'high', 'hyper')),
    play_style TEXT,
    is_neutered BOOLEAN DEFAULT false,
    vax_status TEXT DEFAULT 'unknown' CHECK (vax_status IN ('full', 'partial', 'none', 'unknown')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pets_owner_id ON pets(owner_id);

-- 3. AI Generated Diet Plans
CREATE TABLE diet_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    target_calories_kcal INT NOT NULL,
    meals_per_day INT NOT NULL,
    diet_type TEXT NOT NULL,
    custom_instructions TEXT,
    full_plan_json JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_diet_plans_pet_active ON diet_plans(pet_id, is_active);

-- 4. Meal Schedules & Notification Timers
CREATE TABLE meal_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    diet_plan_id UUID REFERENCES diet_plans(id) ON DELETE SET NULL,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('manual', 'ai')),
    meal_time TIME NOT NULL,
    portion_size TEXT NOT NULL,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Daily Diary Timeline Events
CREATE TABLE diary_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('feed', 'walk', 'medication', 'poop', 'water', 'grooming', 'note')),
    logged_at TIMESTAMPTZ DEFAULT now(),
    details JSONB DEFAULT '{}',
    notes TEXT,
    logged_by_sitter BOOLEAN DEFAULT false
);

CREATE INDEX idx_diary_pet_date ON diary_events(pet_id, logged_at DESC);

-- 6. Medical Prescriptions & Extracted OCR
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    document_url TEXT NOT NULL,
    parsed_diagnosis TEXT,
    simplified_explanation TEXT,
    medications_extracted JSONB NOT NULL DEFAULT '[]',
    raw_ocr_output TEXT,
    is_reviewed_by_user BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Vaccinations & Immunization Records
CREATE TABLE vaccinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    vaccine_name TEXT NOT NULL,
    date_administered DATE NOT NULL,
    next_due_date DATE NOT NULL,
    batch_number TEXT,
    is_verified BOOLEAN DEFAULT false,
    source_document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vaccinations_pet_due ON vaccinations(pet_id, next_due_date);

-- 8. Community Hubs & Group Meetup Events
CREATE TABLE community_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    city TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location_name TEXT NOT NULL,
    event_geom GEOGRAPHY(Point, 4326) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    max_attendees INT DEFAULT 15,
    requires_verified_vax BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_community_events_geom ON community_events USING GIST(event_geom);

-- 9. Event RSVPs
CREATE TABLE event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('going', 'interested', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id, pet_id)
);
```

---

## 7. Hugging Face Qwen2.5-VL-7B-Instruct Integration Service

### 7.1. Python Integration Module (`backend/app/services/qwen_hf_service.py`)

```python
import json
from typing import Dict, Any, List
from huggingface_hub import InferenceClient
from app.core.config import settings

class QwenHuggingFaceService:
    def __init__(self):
        # Uses Hugging Face API Token (HF_TOKEN)
        self.client = InferenceClient(
            model="Qwen/Qwen2.5-VL-7B-Instruct",
            token=settings.HF_TOKEN
        )

    async def generate_diet_plan(self, prompt_text: str) -> Dict[str, Any]:
        """Generates structured nutritional regimen adhering to JSON schema."""
        messages = [
            {
                "role": "system",
                "content": (
                    "You are PawCircle's certified pet clinical nutrition assistant. "
                    "Output ONLY valid JSON adhering strictly to the required schema."
                )
            },
            {"role": "user", "content": prompt_text}
        ]
        
        response = self.client.chat.completions.create(
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=1500,
            temperature=0.2
        )
        content = response.choices[0].message.content
        return json.loads(content)

    async def parse_prescription_image(self, image_url: str) -> Dict[str, Any]:
        """Multimodal OCR extraction for handwritten/printed veterinary slips."""
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a veterinary clinical document assistant. Analyze the prescription image. "
                    "Extract diagnosis, plain-language translation, and medications in valid JSON."
                )
            },
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_url}},
                    {
                        "type": "text", 
                        "text": (
                            "Extract: 1. parsed_diagnosis, 2. simplified_explanation, "
                            "3. medications_extracted: list of {name, form, dosage, frequency, instructions}. "
                            "Output pure JSON only."
                        )
                    }
                ]
            }
        ]

        response = self.client.chat.completions.create(
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=2048,
            temperature=0.1
        )
        return json.loads(response.choices[0].message.content)

    async def parse_vaccine_card(self, image_url: str) -> Dict[str, Any]:
        """Multimodal extraction of vaccine labels, batch numbers, and dates."""
        messages = [
            {
                "role": "system",
                "content": "Extract veterinary vaccine booklet data. Output valid JSON only."
            },
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_url}},
                    {
                        "type": "text",
                        "text": (
                            "Extract: vaccine_name, date_administered (YYYY-MM-DD), "
                            "next_due_date (YYYY-MM-DD), batch_number, and has_clinic_stamp (boolean)."
                        )
                    }
                ]
            }
        ]

        response = self.client.chat.completions.create(
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=1024,
            temperature=0.1
        )
        return json.loads(response.choices[0].message.content)

qwen_hf_service = QwenHuggingFaceService()
```

---

## 8. Complete Folder Structure (Supporting Vercel, Streamlit, Railway & Neon)

```
PawCircle/
│
├── .env.example
├── .gitignore
├── README.md
├── Pawcircle_ai_prd.md             # PRD
├── architecture.md                 # Technical Architecture (This File)
│
├── docs/
│   └── implementation.md           # Phased Engineering Roadmap
│
├── backend/                        # Python / FastAPI Service (Deployed to Railway)
│   ├── Dockerfile                  # Railway Container Build
│   ├── railway.toml                # Railway deployment config & healthcheck
│   ├── Procfile                    # Web & Worker process definitions
│   ├── pyproject.toml              # Dependencies (fastapi, uvicorn, pydantic, sqlalchemy, asyncpg, huggingface-hub, etc.)
│   ├── alembic.ini                 # Neon DB migration config
│   │
│   ├── migrations/                 # Alembic Database Migrations
│   │   ├── env.py                  # Configured with Neon SSL & asyncpg
│   │   └── versions/
│   │
│   └── app/
│       ├── __init__.py
│       ├── main.py                 # FastAPI Factory & CORS
│       ├── core/
│       │   ├── config.py           # Loads NEON_DATABASE_URL, HF_TOKEN, REDIS_URL
│       │   ├── security.py         # JWT & OTP generator
│       │   └── database.py         # Neon Async SQLAlchemy Session
│       │
│       ├── models/                 # SQLAlchemy 2.0 ORM Models
│       │   ├── profile.py
│       │   ├── pet.py
│       │   ├── diet.py
│       │   ├── medical.py
│       │   ├── diary.py
│       │   └── community.py
│       │
│       ├── schemas/                # Pydantic v2 Schemas
│       │   ├── auth.py
│       │   ├── pet.py
│       │   ├── diet.py
│       │   ├── medical.py
│       │   └── community.py
│       │
│       ├── api/                    # REST Endpoints (v1)
│       │   ├── v1/
│       │   │   ├── api.py
│       │   │   ├── endpoints/
│       │   │   │   ├── auth.py     # Passwordless OTP
│       │   │   │   ├── pets.py     # Pet profiles
│       │   │   │   ├── diet.py     # AI Diet generator & adopt
│       │   │   │   ├── medical.py  # OCR upload & Health chat
│       │   │   │   ├── diary.py    # 1-Tap quick logs
│       │   │   │   └── community.py# PostGIS Radar & Meetups
│       │
│       ├── services/
│       │   ├── nutrition_engine.py # Deterministic RER/DER math
│       │   ├── qwen_hf_service.py  # Hugging Face Qwen2.5-VL Client
│       │   ├── prompts.py          # Curated system prompts
│       │   ├── storage.py          # R2 / S3 Presigned URL helper
│       │   └── push_service.py     # WebPush dispatcher
│       │
│       └── workers/                # Celery / ARQ Background Workers
│           ├── worker.py
│           └── alert_scheduler.py  # Meal reminder dispatcher cron
│
├── frontend/                       # React Client (Deployed to Vercel)
│   ├── vercel.json                 # Vercel SPA routing & security headers
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   │   ├── manifest.json           # PWA Web App Manifest
│   │   └── sw.js                   # Web Push Service Worker
│   │
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css               # Design tokens & micro-animations
│       ├── components/
│       │   ├── diary/QuickLogBar.tsx
│       │   ├── nutrition/DietGenerator.tsx
│       │   ├── medical/DocumentScanner.tsx
│       │   ├── medical/HealthChat.tsx
│       │   └── community/RadarMap.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── usePets.ts
│       │   └── useWebPush.ts
│       └── services/apiClient.ts
│
└── streamlit_app/                  # Interactive Companion / Admin Portal (Streamlit Cloud / Railway)
    ├── requirements.txt            # streamlit, requests, pillow, huggingface-hub
    ├── app.py                      # Multi-tab Streamlit dashboard:
    │                               # 1. AI Diet Lab (Test Qwen2.5-VL text prompts)
    │                               # 2. Vision OCR Inspector (Upload Rx/Vaccine cards)
    │                               # 3. Community Radar Debugger (Query Neon PostGIS)
    └── .streamlit/
        └── config.toml             # Theme & port settings
```

---

## 9. Platform Deployment Configurations

### 9.1. Frontend on Vercel (`frontend/vercel.json`)
```json
{
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    }
  ]
}
```

### 9.2. Backend on Railway (`backend/railway.toml` & `backend/Procfile`)

#### `backend/railway.toml`:
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/api/v1/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
```

#### `backend/Procfile`:
```procfile
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
worker: arq app.workers.worker.WorkerSettings
```

### 9.3. Streamlit App Deployment (`streamlit_app/app.py`)
Deployable directly to **Streamlit Community Cloud** (connected to GitHub) or on **Railway** as an internal admin service:
- Provides immediate visual inspection of Hugging Face `Qwen/Qwen2.5-VL-7B-Instruct` responses.
- Allows upload and real-time bounding box / text extraction verification for prescription and vaccine cards.
- Directly queries Neon database for pet profiles and active schedules.

---

## 10. Security, Privacy & Operational Guardrails

1. **Neon Connection Safety:** All connections to Neon must specify `sslmode=require`. The PgBouncer pooler connection string is mandatory for high-concurrency serverless executions.
2. **Hugging Face Token Security:** `HF_TOKEN` is maintained strictly as an encrypted server-side environment variable on Railway / Streamlit secrets; it is never exposed to client-side code.
3. **Fuzzy Geolocation Privacy:** User GPS coordinates are converted to neighborhood park centroids before writing to Neon spatial columns.
4. **Medical Disclaimers:** All AI-derived diet recommendations, prescription summaries, and health assistant replies carry a mandatory disclaimer that they are informational and do not substitute professional veterinary examination.
5. **Poison Control Triage:** Toxic food or symptom queries bypass LLM response latency and immediately output emergency phone numbers and local 24/7 emergency clinic locations.
