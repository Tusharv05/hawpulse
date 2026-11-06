# 🐾 HawPulse

> **Your Pet’s Whole World, in One Circle.**  
> An intelligent clinical companion and lifestyle operating system for modern pet parents, powered by multimodal AI, veterinary triage guardrails, and automated schedule sync.

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.111-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_19_+_Vite-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/Database-Neon_PostgreSQL_+_PostGIS-4169E1?logo=postgresql&logoColor=white)](https://neon.tech)
[![AI](https://img.shields.io/badge/AI-Google_Gemini_+_Qwen--VL-8E75C2?logo=google&logoColor=white)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)

---

## 🌟 Core Highlights

HawPulse eliminates fragmented pet care by uniting medical records, AI nutrition engineering, automated calendar sync, and localized pet community matchmaking into a single zero-friction platform.

```
                  ┌──────────────────────────────────────────────┐
                  │                 HAWPULSE                     │
                  │   Modern Clinical & Lifestyle Operating System│
                  └───────┬──────────────┬──────────────┬────────┘
                          │              │              │
         ┌────────────────┴───┐   ┌──────┴──────┐   ┌───┴────────────────┐
         │  AI Health Vault   │   │  Diet Lab   │   │  Community Radar   │
         │  • Vision OCR Slip │   │  • RER/DER  │   │  • PostGIS Proxim. │
         │  • Vaccine Roadmap │   │  • GCal Sync│   │  • Pack Walk RSVP  │
         │  • Safe Walk Score │   │  • Meal Logs│   │  • Pet Matchmaking │
         └────────────────────┘   └─────────────┘   └────────────────────┘
```

---

## 🚀 Key Modules & Capabilities

### 🩺 1. Medical Vault & AI Health Co-Pilot
* **Prescription Vision OCR**: Snap a photo of any handwritten or printed veterinary clinic slip. Multimodal vision models automatically extract medication names, exact dosages, frequencies, and course durations.
* **1-Tap Alarm Conversion**: Instantly converts extracted medications into active daily reminders with zero manual typing.
* **Immunization Roadmap**: Comprehensive canine vaccination protocols (DHPP, Rabies, Leptospirosis, Bordetella) with automated booster tracking and date calculation.
* **Safe Walk Score**: Dynamically scores puppy immunity based on completed milestone vaccines to advise safe public park socialization.

### 🥗 2. Diet Lab & Precision Nutrition Engine
* **Clinical Caloric Profiling**: Calculates accurate Resting Energy Requirement (RER) and Daily Energy Requirement (DER) calibrated to breed, weight, life-stage, and neutered status:
  $$\text{RER} = 70 \times (\text{weight}_{\text{kg}})^{0.75}$$
* **Google Calendar Automated Sync**: Connects with Google Calendar via OAuth2 to schedule recurring daily meal alarms (`RRULE:FREQ=DAILY`) for breakfast and dinner directly on your Google Calendar.
* **Portion Optimization**: Formulates feeding guides across kibble, fresh whole food blends, and rotational toppers.

### 📅 3. Daily Care & Sitter Pass
* **1-Tap Quick Logging**: Log meals, outdoor walks, potty breaks, hydration, and medication in one tap.
* **Up Next Widget**: Always shows the upcoming routine item with one-click completion.
* **Real-time Paw Weather Advisory**: Integrated with WeatherAPI to calculate ambient pavement heat risk and surface safety before cardio walks.
* **Shareable Sitter Pass**: Generates a secure, temporary, public read-only link for dog sitters and boarders. Sitters can check off routines without creating an account or downloading an app.

### 🐶 4. Community Radar, Pack Walks & Matchmaking
* **Geospatial Radar**: Powered by PostgreSQL PostGIS spatial indexing with privacy-fuzzed coordinates (protects home address confidentiality).
* **Tinder-Style Pet Matchmaking**: Swipe deck displaying nearby verified dog profiles filtered by play style, energy level, and size compatibility.
* **Pack Walk Events**: Host and RSVP to neighborhood group pack walks, with optional vaccine-verification gating for puppy safety.
* **Direct Messaging**: In-app private communication thread between matched pet parents.

### 🔐 5. Authentication & Account Security
* **Passwordless Email OTP**: Secure 6-digit one-time password dispatch via high-deliverability Gmail SMTP.
* **1-Click Google Sign-In**: RFC-compliant OAuth 2.0 exchange that provisions the user account, generates signed JWT session tokens, and links Google Calendar in a single unified flow.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS, Material Symbols, Canvas Confetti |
| **Backend API** | FastAPI, Python 3.11, Uvicorn, Pydantic v2, Pydantic-Settings |
| **Database & ORM** | PostgreSQL (Neon Serverless), SQLAlchemy 2.0 (Async), AsyncPG, PostGIS, GeoAlchemy2 |
| **AI / Machine Learning** | Google Gemini 1.5 / 2.0 Flash Vision, Hugging Face Qwen2.5-VL-7B |
| **Integrations** | Google Calendar REST API v3, WeatherAPI.com, Gmail SMTP |
| **Deployment** | Railway, Vercel, Docker / Nixpacks |

---

## 💻 Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Tusharv05/hawpulse.git
cd hawpulse
```

### 2. Backend Setup
```bash
# Create and activate virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\activate

# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your credentials:
```env
DATABASE_URL=postgresql+asyncpg://<username>:<password>@<ep-pooler-id>.neon.tech/neondb?ssl=require
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/calendar/callback
SMTP_USER=supporthawpulse@gmail.com
SMTP_PASSWORD=your_gmail_app_password
WEATHER_API_KEY=your_weatherapi_key
```

Run the backend development server:
```bash
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be live at: `http://127.0.0.1:8000/docs`

---

### 3. Frontend Setup
Open a second terminal window:
```bash
cd frontend

# Install Node packages
npm install

# Start Vite dev server
npm run dev
```
Open your browser at: **`http://localhost:5175`**

---

## ☁️ Deployment Guide

### Deploying Backend to Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** ➔ **Deploy from GitHub repo** ➔ Select `hawpulse`.
3. In **Settings**:
   - **Root Directory**: leave as `/` (or set `/backend`)
   - **Start Command**: `uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT`
4. In **Variables**, add all keys from `backend/.env.example`.
5. Under **Networking**, click **Generate Domain** (e.g. `https://hawpulse-backend.up.railway.app`).

### Deploying Frontend to Vercel or Railway

1. In Railway or Vercel, select the same repository.
2. Set **Root Directory**: `frontend`.
3. Build Command: `npm run build` | Output Directory: `dist`.
4. Environment Variable:
   ```env
   VITE_API_URL=https://<your-backend-railway-domain>/api/v1
   ```
5. Deploy!

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Crafted with care for every wag, purr, and healthy heartbeat. 🐾<br/>
  <b>HawPulse Team</b> &bull; <a href="https://www.instagram.com/hawpulse">Instagram @hawpulse</a>
</p>
