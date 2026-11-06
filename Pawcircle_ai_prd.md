# Product Requirement Document (PRD): PetCare AI & Living Community Diary (v2.0)

---

## 1. Executive Summary & Core Value Proposition

This platform builds directly upon the lightweight diary architecture of **Pouncity**, transforming a minimalist pet log into an all-in-one AI health companion, custom nutrition engine, and localized social ecosystem.

It combines:

1. **Pouncity’s Signature Feature:** A dynamic, on-demand AI Diet & Grooming Generator where owners can input custom queries or tap once to generate tailored daily meal schedules, portion sizes, calorie counts, and grooming rhythms.
2. **Local Community Discovery & Pack Meetups:** A privacy-first geo-discovery layer connecting dog and cat parents within the same city or neighborhood for pack walks, playdates, and breed meetups.
3. **Medical Vault & Smart OCR:** Prescription simplification, vaccine card parsing, and proactive puppy/kitten immunization roadmaps.
4. **Adaptive Dual-Mode Meal Alerts:** Manual scheduling or AI-calculated alerts.
5. **Frictionless Onboarding:** Email-only login (Magic Link / OTP) with automated GPS and city detection.

---

## 2. Target Personas

| Persona | Core Goal | Primary Needs |
| :--- | :--- | :--- |
| **New Pet Parent** | Keep puppy/kitten safe, properly nourished, and vaccinated. | Automated vaccine schedule, simple explanation of vet prescriptions, breed-tailored meal plans. |
| **Active Dog Owner** | Socialize their pet and avoid reactive or mismatched playdates. | Discover nearby verified pet parents, filter by energy/size/temperament, join weekend pack walks. |
| **Busy Multi-Pet Owner** | Keep track of daily meals and routines without manual friction. | Push notifications with 1-tap `[Mark Fed]`, shared sitter link without requiring account creation. |

---

## 3. Comprehensive Feature Specifications

### 3.1. Authentication, Location & Experience Onboarding

* **Email-Only Passwordless Login:**
  * User submits an email address $\rightarrow$ receives a Magic Link or 6-digit OTP.
  * No Google, Apple, or social third-party login required; no passwords to store.
* **Location Setup (City & Neighborhood Detection):**
  * Auto-detect via Browser Geolocation API (`navigator.geolocation`).
  * Reverse-geocodes coordinates into City and Neighborhood/Area.
  * Fallback to a searchable city dropdown if permissions are denied.
* **Pet Profile & Experience Assessment:**
  * Inputs: Pet Name, Species (`Dog` / `Cat`), Breed, Age / DOB, Weight, Photo, Allergies/Food Sensitivities.
  * Experience Toggle: *"Are you a first-time pet parent?"* (`Yes` / `No`).
  * Vaccination Baseline: *"Is your pet vaccinated?"* (`Fully` / `Partially` / `Not Vaccinated / Unknown`).

---

### 3.2. On-Demand AI Diet & Meal Plan Generator

Pet parents can generate personalized nutritional regimens by either tapping a 1-click preset or entering custom text prompts (e.g., *"Make a high-protein raw/kibble mix plan for my 1-year-old active Golden Retriever"* or *"Sensitive stomach wet-food diet for a 3-year-old indoor Persian cat"*).

```
┌────────────────────────────────────────────────────────┐
│           AI MEAL & DIET GENERATION FLOW               │
└───────────────────────────┬────────────────────────────┘
                            │
       ┌────────────────────┴────────────────────┐
       ▼                                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  1-Tap Breed & Weight Plan   │  │  Custom Prompt / Preferences │
│  (Breed standards, age tier) │  │  (Raw, kibble, home-cooked)  │
└──────────────┬───────────────┘  └──────────────┬───────────────┘
               │                                 │
               └────────────────┬────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────┐
│                   STRUCTURED OUTPUT                    │
│ • Daily Caloric Target (RER / DER in kcal)             │
│ • Exact Portion Breakdown per meal (grams / cups)      │
│ • Ingredient & Protein Recommendations                 │
│ • Toxic Food Blacklist for that specific breed/size    │
│ • Grooming Rhythm Recommendation (brush/bath schedule) │
│ • 1-Tap Action: "Apply this to my Daily Meal Alerts"   │
└────────────────────────────────────────────────────────┘
```

#### Detailed Capabilities:
* **Custom Text Prompts:** Users can refine plans with contextual instructions:
  * *"He's allergic to chicken, suggest fish or lamb alternatives."*
  * *"She gained 2 kg after spaying, need a weight-loss cutting diet."*
* **Nutritional Calculations:**
  $$\text{RER} = 70 \times (\text{Weight in kg})^{0.75}$$
  The AI adjusts with life-stage multipliers (growth, neutered adult, active work, senior) to output exact gram weights per feeding.
* **Sync to Diary:** Users can click **"Adopt this Schedule"**, which automatically configures active daily meal alerts.

---

### 3.3. Dual-Engine Meal Alerts (Manual vs. AI-Calculated)

* **Option 1: Manual Schedule:**
  * User sets fixed reminder times (e.g., 08:30 AM and 07:30 PM) and writes custom notes.
* **Option 2: AI-Driven Schedule:**
  * Derived directly from the AI Diet Plan (split into 2, 3, or 4 intervals based on age and digestive transit times).
* **Alert Delivery:**
  * Web Push notification with actionable buttons:
    * `[ Mark Fed ]` $\rightarrow$ Logs the feed event directly to the live diary with timestamp.
    * `[ Snooze 30m ]` $\rightarrow$ Reschedules notification for 30 minutes later.

---

### 3.4. Local Pet Community & Pack Meetups (City-Wide Discovery)

A dedicated **"Explore & Meetups"** tab allows owners to connect safely within their city without exposing sensitive personal details.

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOCAL COMMUNITY MODULE                      │
├────────────────────────────────┬────────────────────────────────┤
│ 1. Neighborhood Dog/Cat Radar  │ • Filter by City & Distance    │
│                                │ • Filter by Size & Energy Level│
│                                │ • Temperament & Play Style Tags│
├────────────────────────────────┼────────────────────────────────┤
│ 2. Pack Walks & Group Meetups  │ • Create / RSVP to Events      │
│                                │ • Breed-Specific Sundays       │
│                                │ • Puppy Socialization Groups   │
├────────────────────────────────┼────────────────────────────────┤
│ 3. Verified Vaccine Badge      │ • "Vaccinated Only" Event Lock │
│                                │ • Verified via Medical Vault   │
├────────────────────────────────┼────────────────────────────────┤
│ 4. Privacy & Safety First      │ • Fuzzy location (no home pin) │
│                                │ • Double-opt-in playdate chat  │
└────────────────────────────────┴────────────────────────────────┘
```

#### Key Functional Rules:
* **Fuzzy Geolocation:** User locations are pinned to local public parks or neighborhood centers—never residential addresses.
* **Compatibility Filters:**
  * Pet Size: Toy, Small, Medium, Large, Giant.
  * Temperament: High energy, Couch potato, Vocal player, Gentle, Leash-reactive.
  * Spay/Neuter Status.
* **Event Creation:** Any user or local pet business can host an event (e.g., *"Sunday Morning Labrador Swim & Fetch at Central Park"*).
* **Vaccination Verification Gating:** Hosts can enforce a requirement that attendees must have a verified Rabies/DHPP badge in their digital diary to RSVP.

---

### 3.5. Smart Medical Vault: Prescriptions & Vaccine Roadmaps

#### A. Puppy / Kitten Vaccine Roadmap & Scanner
* **For Unvaccinated / Partially Vaccinated Pets:**
  * Generates an automated, date-anchored vaccination schedule (DHPP, Rabies, Leptospirosis, Deworming).
  * Includes a "Safe Walk Immunity Progress Bar" informing owners when it is safe to visit public dog parks.
* **Vaccine Card Scanner:**
  * Upload a photo of the physical clinic vaccination booklet.
  * Vision OCR extracts: Vaccine Name, Administration Date, Expiry/Booster Due Date, and Batch Number.
  * Automatically schedules booster alerts.

#### B. Prescription Simplifier & Vet Translator
* **Upload:** Capture photo of handwritten doctor prescription slips or clinical summaries.
* **AI Extraction & Simplification:**
  * **Plain-Language Summary:** Translates complex diagnoses (e.g., *"Bilateral Otitis Externa with secondary Malassezia"* $\rightarrow$ *"Yeast-related ear infection causing itching and redness in both ears"*).
  * **Medication Schedule:** Parses dosage, frequency, and food requirements (e.g., *"Give 1 tablet every 12 hours with a meal"*).
  * **Auto-Schedule Alarms:** Populates medicine timers in the pet's daily log.

#### C. Interactive AI Pet Health Assistant (Q&A)
* Conversational chat interface grounded in the pet's profile, logged symptoms, and medical vault history.
* **Guardrails:**
  * Non-diagnostic advisory tone with clear disclaimers.
  * Toxic food / emergency symptom triggers (e.g., bloat, chocolate poisoning, lethargy) instantly surface 24/7 emergency vet contacts in the user's city.

---

## 4. Technical Architecture & Database Schema

### Database Schema (Supabase / PostgreSQL)

```sql
-- 1. Profiles & Location
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  area_neighborhood TEXT,
  location_geom GEOGRAPHY(Point, 4326),
  is_first_time_parent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Pets & Dietary Profiles
CREATE TABLE pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT CHECK (species IN ('dog', 'cat')),
  breed TEXT,
  birth_date DATE,
  weight_kg NUMERIC(5, 2),
  allergies TEXT[],
  energy_level TEXT CHECK (energy_level IN ('low', 'moderate', 'high', 'hyper')),
  play_style TEXT,
  is_neutered BOOLEAN DEFAULT false,
  vax_status TEXT CHECK (vax_status IN ('full', 'partial', 'none', 'unknown')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. AI Generated Diet Plans
CREATE TABLE diet_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  target_calories_kcal INT NOT NULL,
  meals_per_day INT NOT NULL,
  diet_type TEXT, -- e.g. "raw", "kibble", "vet_prescription", "home_cooked"
  custom_instructions TEXT,
  full_plan_json JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Meal Schedules & Notification Timers
CREATE TABLE meal_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  diet_plan_id UUID REFERENCES diet_plans(id) ON DELETE SET NULL,
  schedule_type TEXT CHECK (schedule_type IN ('manual', 'ai')),
  meal_time TIME NOT NULL,
  portion_size TEXT,
  is_active BOOLEAN DEFAULT true
);

-- 5. Community Hubs & Group Meetup Events
CREATE TABLE community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location_name TEXT NOT NULL,
  event_geom GEOGRAPHY(Point, 4326),
  event_time TIMESTAMPTZ NOT NULL,
  max_attendees INT DEFAULT 15,
  requires_verified_vax BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES community_events(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('going', 'interested', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, pet_id)
);

-- 6. Medical Prescriptions & Vaccinations
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  parsed_diagnosis TEXT,
  simplified_explanation TEXT,
  medications_extracted JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  date_administered DATE,
  next_due_date DATE NOT NULL,
  batch_number TEXT,
  is_verified BOOLEAN DEFAULT false
);
```

---

## 5. Screen-by-Screen User Journey

```
┌────────────────────────────────────────────────────────┐
│                   BOTTOM NAVIGATION                    │
├─────────────┬─────────────┬─────────────┬──────────────┤
│ 1. DIARY    │ 2. NUTRITION│ 3. HEALTH   │ 4. MEETUPS   │
│             │    & CARE   │    VAULT    │              │
├─────────────┼─────────────┼─────────────┼──────────────┤
│ • 1-tap feed│ • AI meal   │ • Prescrip- │ • City radar │
│   & walk log│   generator │   tion OCR  │ • Pack walks │
│ • Sitter    │ • Manual vs │ • Vaccine   │ • Playdate   │
│   share link│   AI alerts │   roadmap   │   RSVPs      │
│ • Daily     │ • Grooming  │ • AI Health │ • Filter by  │
│   streak    │   cadence   │   Q&A chat  │   energy     │
└─────────────┴─────────────┴─────────────┴──────────────┘
```

---

## 6. Phased Engineering & Launch Plan

| Phase | Duration | Milestones |
| :--- | :--- | :--- |
| **Phase 1: Foundations & Auth** | Week 1 | Email magic-link auth, geolocation onboarding, pet profile creation, basic 1-tap daily diary timeline. |
| **Phase 2: AI Diet & Dual Alerts** | Week 2 | Interactive AI meal plan generator (prompt + 1-tap), caloric engine, manual vs AI meal push alert dispatcher. |
| **Phase 3: Medical Vault & OCR** | Week 3 | Vet prescription scanner (plain-language extractor), vaccine card reader, automated immunization roadmap. |
| **Phase 4: Community & Pack Meetups** | Week 4 | PostGIS city radius search, event creation & RSVP system, compatibility tags, safety verification gating. |