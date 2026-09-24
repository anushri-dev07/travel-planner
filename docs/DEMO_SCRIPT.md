# TravelMate Edge — Demo Script (Snapdragon AI Lab Challenge)

A 3–5 minute judges' walkthrough. Scripted story: **"3 days • Ooty • ₹8,000 • family • relaxed"** — the exact flow the AI was designed for.

---

## Setup before the demo (1 minute)

1. Open `http://localhost:5000` (or the deployed URL / installed APK).
2. Make sure the server console shows `MongoDB Connected`.
3. Keep the **🤖 robot button** (bottom-right) visible. Have an account logged in (optional — plan saving).

> 💡 Tip: if the OpenWeather key is empty, the app uses the deterministic local forecast — the demo works fully offline.

---

## Scene 1 — Plan from a sentence  (90 sec)

**Presenter:** *"TravelMate Edge is a travel planner you can just talk to. Let's plan a trip to Ooty for two people on a ₹8,000 budget."*

Click the FAB → type / tap chip:
> **"Plan a 3-day Ooty trip under ₹8,000 for 2 people"**

**Expected:**
- Chat card: "🗺️ Ooty — 3 day trip · ₹29,400 estimated · 2 travellers"
- Itinerary: Day 1 = Avalanche Lake, Emerald Lake, Doddabetta Peak; Days 2–3 local exploration
- **Weather note** (new): "Heads up: rain expected on Day 2…" (if the forecast says so)
- Buttons appear: **Preview itinerary / Too hectic? / Rain forecast / Cheaper? / Why these places?**

**Say:** *"Notice it picked the three closest sights for Day 1 — the planner groups places by distance so you don't waste time driving."* → tap **Preview itinerary** to render it in the main UI.

---

## Scene 2 — Constraint-aware replanning  (60 sec)

**Presenter:** *"But we're a relaxed family — Day 1 has three stops. Let's tell the AI about the weather instead."*

Type / tap:
> **"It's raining on Day 2, adjust the plan"**

**Expected:**
- Message: rain expected on Day 2 — indoor spots moved up, outdoor sights later if it clears.
- Reply includes the **live forecast line** (`📡 Live forecast: Day 2: 29°–35° 🌧️ light rain showers…`).
- Itinerary card re-renders with the weather-smart order.

**Say:** *"The engine pulled the actual forecast (or the on-device fallback) and reordered the day so you stay dry — a hard-coded itinerary can't do that."*

---

## Scene 3 — Budget intelligence  (60 sec)

**Presenter:** *"₹29,400 is over our ₹8,000 family budget. Let's see what TravelMate says."*

Type / tap:
> **"Make it cheaper"**

**Expected:**
- Reply shows the estimate and the gap (~₹21,400 over), and switches the hotel tier / flags how to trim.

**Say:** *"Pure planning usually quotes a number and moves on. TravelMate instead tells you *why* it's over budget and reshapes the plan — that's the 'decision' in Travel Decision Engine."*

---

## Scene 4 — Explanation  (45 sec)

Type / tap:
> **"Why these places?"**

**Expected:**
- Explanation: "Here's why this plan works for you… Day 1 focuses on Ooty — these spots are grouped because they're close… estimated cost… changes you asked for."

**Say:** *"Every recommendation is explainable — important for trust, and it was one of the challenge's innovation criteria."*

---

## Scene 5 — The on-device story  (60 sec)

**Presenter (key line for the Qualcomm/Snapdragon criterion):**
> *"The whole interpretation layer runs **on-device by default** — `AI_PROVIDER=edge` is pure local logic, no cloud calls, so it's private and works offline. The same interface is designed to slot a Qualcomm-optimised model via Ollama (`AI_PROVIDER=ollama`) for even smarter understanding, without touching the planner."

Show the `.env` block:
```env
AI_PROVIDER=edge            # edge | ollama | gemini
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

**Close:**
> *"Constraint-aware, weather-aware, budget-aware, explainable — and built to run on the device. That's TravelMate Edge."*

---

## Backup prompts (if a database state surprises you)
- *"Plan a 2-day nature trip to Munnar, mostly outdoor"* → filters to outdoor/nature places.
- *"Plan a trip to Goa, beaches and nature, 2 days, under ₹10,000"*
- *"Day 1 is too packed — make it relaxing"* → caps activities and spreads overflow.
- *"Remove Doddabetta Peak"* / *"Add a temple"* → fuzzy add/remove.

---

## Rehearsal checklist
- [ ] Server running + Mongo connected
- [ ] FAB visible on page
- [ ] Weather note appears (Scene 1)
- [ ] Preview itinerary renders the card grid
- [ ] Rain replan shows the 📡 live forecast line
- [ ] "Make it cheaper" outputs budget math
- [ ] "Why these places?" prints the explanation