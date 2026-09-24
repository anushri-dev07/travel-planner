# 🌍 TravelMate — AI Travel Planner with TravelMate Edge

A full-stack travel planning platform (Node.js + Express + MongoDB Atlas + vanilla JS SPA) upgraded with **TravelMate Edge** — an on-device AI Travel Decision Engine designed for the **Snapdragon AI Lab Build & Present Challenge**.

> **TravelMate Edge** turns natural language into complete trip plans and can intelligently **replan** them around real-world conditions — rainfall forecasts, hectic schedules, travel fatigue and budgets — then explain *why* it made each recommendation.

---

## ✨ Features

### 🧭 Core Travel Planner
- Browse 22 Indian states + 17 international cities, each with its own places, hotels, food & activities
- Generate multi-day itineraries with cost estimation (hotels, food, transport, entry fees)
- Trip budget calculator, packing list generator, emergency contacts, visa info, crowd levels
- User accounts with email verification, wishlist, favourites, visited tracking, badges
- Photo uploads & reviews, live weather (OpenWeatherMap), route distance (OpenRouteService)

### 🤖 TravelMate Edge — AI Travel Decision Engine
The competition centrepiece — **one AI agent** with three abilities:

1. **Natural-language trip creation**
   > *"Plan a 3-day Ooty trip under ₹8,000 for 2 people"*
   → Destination, days, budget, travellers, interests & constraints extracted automatically.

2. **Context-aware replanning**
   > *"Day 2 is too hectic…"* · *"It's raining on Day 2, adjust the plan"* · *"Make it cheaper"*
   → Reorders activities (rain-safe indoor-first), spreads hectic days, swaps hotels to fit budget, adds/removes places.

3. **Natural-language constraints**
   > *"not too hectic"* → max 2–3 activities/day · *"avoid long drives"* → compact ≤12 km daily grouping · *"cheap hotels"* · *"mostly outdoor / nature / beaches"* → filtered recommendations.

Plus **"Why these places?"** — every plan explains its reasoning (proximity grouping, budget fit, interest match), and a **floating chat assistant** renders the live itinerary.

### 🧠 On-Device AI (Snapdragon story)
The interpretation layer (`aiAgent.js`) is **provider-agnostic and offline-first**:

| Provider | Where it runs | Config |
|---|---|---|
| `edge` **(default)** | 100% local, rule-based NLU — zero cloud calls, private by design | `AI_PROVIDER=edge` |
| `ollama` | Local LLM via Ollama (fits on-device Qualcomm inference) | `OLLAMA_URL`, `OLLAMA_MODEL` |
| `gemini` | Cloud Gemini as a higher-quality fallback | `GEMINI_API_KEY` |

Every provider falls back to the local engine if unavailable, so the app always works — even offline.

---

## 🏗️ Architecture

```
User message
   │
   ▼
┌────────────────────────  aiAgent.js  ────────────────────────┐
│  understand(message, plan)              provider: edge/ollama/gemini
│    ├─ extractDestination  (states + cities, case-insensitive)
│    ├─ extractRequest     (days, budget, travellers, interests)
│    └─ extractConstraints ("relaxed", "avoid long drives", …)
│  replan(plan, intent)    hectic · remove · add · weather · budget
│  explain(plan)           "Why these places?"
└────────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────  planner.js  ─────────────────────────┐
│  buildTripPlan({ name, budget, days, members, maxClusterKm }) │
│  Haversine clustering → per-day zones → cost model            │
└────────────────────────────────┬──────────────────────────────┘
                                 │  + live weather (server.js)
                                 ▼
                     MongoDB Atlas (places/cities/states)
```

- `server.js` — REST API + new `POST /ai/assistant` (create / replan / explain).
- `planner.js` — reusable, deterministic itinerary engine (also resolves Indian cities).
- `aiAgent.js` — the TravelMate Edge intelligence layer.
- `index.html` — SPA with the TravelMate Edge chat panel (FAB, quick chips, live itinerary preview).

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18 (developed on v22)
- A MongoDB Atlas cluster + connection string
- (Recommended) OpenWeatherMap & OpenRouteService API keys

### Setup
```bash
# 1. clone & install
git clone <your-repo-url> travel-planner
cd travel-planner
npm install

# 2. configure environment
cp .env.example .env
# fill in MONGODB_URI, EMAIL_USER/PASS (for verification mails), ORS_API_KEY, OPENWEATHER_API_KEY,
# AUTH_SECRET, ADMIN_USER, ADMIN_PASS, AI_PROVIDER

# 3. seed data (optional — if your DB is empty)
node addCoords.js   # fixes coordinates; requires a populated DB

# 4. run
npm start           # or: node server.js
# → http://localhost:5000
```

### AI configuration
```env
AI_PROVIDER=edge            # edge | ollama | gemini
GEMINI_API_KEY=             # only for gemini
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

Try the AI in the app: click the **🤖 robot FAB**, then:
- *"Plan a 3-day Ooty trip under ₹8,000 for 2 people"*
- *"It's raining on Day 2, adjust the plan"* → watch it reorder to indoor spots (uses the live forecast when the OpenWeather key is set)
- *"Day 1 is too packed — make it relaxing"*
- *"Why these places?"*

---

## 🔐 Security
- No secrets in code — everything via `.env` (`AUTH_SECRET`, `ADMIN_USER/PASS`, API keys)
- BCrypt password hashing (single-hash), HMAC-signed auth tokens (7-day expiry)
- Admin endpoints gated by `authAdmin` bearer-token middleware
- Email verification with timed OTP codes (in-memory)

## 🧪 Testing
- End-to-end script spawns the server and exercises register/login/trips/admin: `e2e_test.js`
- AI lifecycle test: create → constraints → replan (hectic/weather/budget) → explain: `ai_e2e.js`
- Local run: `node server.js`, then open the app and use the AI FAB.

---

## 📄 Competition Notes (Snapdragon AI Lab)
- **Solution type:** Mobile-first web app (vanilla SPA) delivered as a Capacitor Android APK — installable and accessible.
- **Significant AI incorporation:** the existing deterministic planner is now fronted by an AI reasoning layer (`aiAgent.js`) that understands natural language, applies soft constraints and replans — per the challenge requirement.
- **On-device readiness:** default `edge` provider runs entirely locally (no API key, private). Designed so the same interface maps to a Qualcomm-optimised local LLM (Ollama) on Snapdragon PCs via the `.env` switch.
- **Live demo path:** web (desktop/mobile) or APK — see `docs/DEMO_SCRIPT.md`.

See `docs/ARCHITECTURE.md` for the deep dive and `docs/DEMO_SCRIPT.md` for the judges' walkthrough.