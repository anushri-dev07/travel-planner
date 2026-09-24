# TravelMate Edge — AI Architecture Deep-Dive

How the TravelMate Edge AI Travel Decision Engine is built, and why it satisfies the *"significant AI incorporation"* + *"on-device/Qualcomm"* requirements of the Snapdragon AI Lab Challenge.

---

## 1. Design principle: one agent, three abilities

Instead of shipping separate AI features (a budget bot, a chatbot, a packing bot …), TravelMate Edge is **one reasoning layer** that sits in front of the existing deterministic trip engine:

```
Natural language ──► [aiAgent: understand] ──► planner.js (itinerary build)
                        │                              │
                        │  create / replan (constraints,
                        │  weather, budget, pace)
                        ▼                              ▼
                      intent + plan ─────────► updated trip + explanation
```

- **Ability 1 — Plan from a sentence.** Extract destination, days, budget, travellers, interests.
- **Ability 2 — Replan with context.** React to a hectic day, rain, or an over-budget plan.
- **Ability 3 — Honour natural-language constraints.** "not too hectic", "avoid long drives", "cheap hotels", "mostly outdoor".

This mirrors the competition's recommended scope (replan **the same itinerary**, don't spawn disjoint sub-tools).

---

## 2. Component map

| File | Responsibility |
|---|---|
| `aiAgent.js` | NLU (intent routing, extraction), replanning rules, constraint application, explanation generator, provider abstraction |
| `planner.js` | Reusable `buildTripPlan()` — Haversine distance clustering → per-day zones → cost model (extracted from the original `/plan`) |
| `server.js` | REST API; adds `POST /ai/assistant`; live-weather fetch for replans; token auth for saving trips |
| `index.html` | SPA + floating TravelMate chat panel (FAB, quick chips, itinerary preview) |

### 2.1 The interpretation layer (`aiAgent.js`)
- **`understand(message, plan)`** → routes to `create | replan | question`.
  - If a plan exists, keywords drive replans: `day N too hectic`, `remove X`, `add X`, `rain/weather`, `cheaper`, `crowded`, `shorter drives`.
  - Otherwise `create` detection uses plan/trip keywords or a known destination mention; a bare destination counts as a create request.
- **`buildRequest(message, known)`** → structured `{ destination, days, budget, members, interests[], hotel, transport, constraints }`.
  - Number parsing handles words/numbers, ₹/lakh/thousand, regex fallbacks.
  - Interest tags: beaches, nature, heritage, adventure, shopping, outdoor/indoor.
  - Constraints: pace (`relaxed` → max 3/day), travel (`compact` → ≤12 km), hotel tier, exclude trekking, low crowds.
- **`applyConstraints(plan, request)`** → filters by interests, caps activities/day, swaps hotel tier, reconciles budget (recompute cost, try downgrading tiers).
- **`replan(plan, intent)`** →
  - `hectic`: keep 3 closest places, spread overflow to lighter days.
  - `remove`/`add`: fuzzy place matching against the plan's place catalogue.
  - `weather`: classifies each place indoor/outdoor; rain → indoor-first ordering, clear → outdoor-first.
  - `budget`: estimates cost, downgrades hotel if needed, reports the gap.
- **`explain(plan)`** → "Why these places?" — zone/clustering rationale + cost + interest alignment.

### 2.2 Provider abstraction (the on-device story)
```
AI_PROVIDER=edge   → deterministic, local, rule-based (DEFAULT, zero deps)
AI_PROVIDER=ollama → local LLM via Ollama /api/generate (on-device friendly)
AI_PROVIDER=gemini → cloud Gemini (higher-quality fallback)
```
Each provider is wrapped in try/catch that **falls back to `edge`** on any failure. The clean interface means the same message → intent contract can later target a Qualcomm AI Hub / Snapdragon NPU model without touching downstream code.

### 2.3 The engine (`planner.js`)
- Fetches countries/states/cities/places from MongoDB Atlas.
- Resolves the destination: foreign city (by `countryId`) → international; Indian state by name; **Indian city** (new) resolved to its parent state so "Ooty" works (the original `/plan` only accepted states/international cities).
- `clusterByDistance(places, maxClusterKm)` groups places by Haversine proximity → one zone per day.
- Cost model: `costPerDay × days × members` + hotel + activity fees.
- Returns `{ destination, totalCost, places, smartItinerary, tripData, tags }`.

### 2.4 Weather-aware replanning (`server.js`)
`getDestinationWeather(dest, days)`:
- With `OPENWEATHER_API_KEY`: geocode (DB lat/lng or OpenWeather geo API) → 5-day forecast → per-day `{ temp, rain, description }` (cached).
- Without a key: deterministic local fallback (stable pseudo-random per destination) so the demo is fully offline.
- On create, weather is attached & a `weatherNote` warns about rainy days; on replan the live forecast is attached to the plan so `replan(weather)` reacts to *actual* conditions and the reply prints the live forecast.

---

## 3. Why this satisfies the competition rubric

| Judging area | How TravelMate Edge addresses it |
|---|---|
| **Technical Implementation** | Clean separation (nlu → planner → DB), fully testable via scripts, 13/13 e2e checks pass (create/constraints/replan/weather/budget/explain), typed single-provider interface |
| **Use Case & Innovation** | Solving a real pain point: itinerary rigidity. Conversational *constraint-aware replanning* (rain, pace, budget, crowds) with explanations — beyond a static itinerary |
| **Deployment & Accessibility** | Mobile-first SPA + Capacitor APK; online/offline capable (local `edge` NLU + fallback weather); `.env`-driven config; free-tier stack |
| **Presentation & Documentation** | README + ARCHITECTURE + DEMO_SCRIPT; in-app explainer ("Why these places?") doubles as a live demo script |

---

## 4. Data flow example

**User:** *"Plan a 3-day Ooty trip under ₹8,000 for 2 people, not too hectic, avoid long drives"*

1. `understand` → `create`
2. `buildRequest` → `{ destination: "Ooty", days: 3, budget: 8000, members: 2, constraints: { pace: "relaxed", maxClusterKm: 12, travel: "compact" } }`
3. `planner.buildTripPlan` → resolves Ooty → clusters=2-day zone → itinerary + cost
4. `applyConstraints` → caps activities, notes compact grouping
5. `explain` → "why these places" + cost breakdown
6. Response includes `{ smartItinerary, tripData, changes[], explanation, weather }`; chat renders it and offers follow-ups.

**User:** *"It's raining on Day 2, adjust the plan"*
1. Server attaches live `weather` to the plan
2. `understand` → `replan{kind:"weather", targetDay:2}`
3. `replan` reorders Day 2 → indoor venues first
4. Reply prints the live forecast (`📡 Live forecast: Day 2: 29°–35° 🌧️ light rain showers…`)

---

## 5. Extending to a real on-device model (next phase)
- Swap `AI_PROVIDER=ollama` and point `OLLAMA_URL` at a Snapdragon-optimised model (e.g., via Qualcomm AI Hub) — the `understand` contract is unchanged.
- Optional voice input via Whisper (on-device) → message → same pipeline (Phase 2).
- Model quantization (INT8) for NPU could replace the regex extraction with a fused intent/entity model while keeping `planner.js` output identical.