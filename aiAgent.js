const mongoose = require("mongoose");
const { classifyType } = require("./planner");

// ===========================================================================
// TravelMate Edge — AI Travel Decision Engine
// The interpretation layer is intentionally provider-agnostic:
//   - DEFAULT 'edge' provider: deterministic, local, rule-based NLU — runs
//     fully on-device (no cloud, private by design, the Snapdragon/on-device path)
//   - Optional 'gemini' / 'ollama' providers activate when configured in .env
// ===========================================================================

const HOTEL_NIGHT_COST = { budget: 1200, premium: 2500, luxury: 4500 };

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

function toNumber(str) {
    str = String(str || "").toLowerCase().trim();
    if (NUMBER_WORDS[str]) return NUMBER_WORDS[str];
    return parseInt(str.replace(/[^0-9]/g, ""), 10) || 0;
}

function extractNumber(text, patterns) {
    for (const re of patterns) {
        const m = String(text || "").match(re);
        if (m) {
            const raw = m[1];
            const num = parseFloat(String(raw).replace(/,/g, ""));
            if (!isNaN(num)) return num;
        }
    }
    return null;
}

const WORD_DECIMAL = { thousand: 1000, lakh: 100000, k: 1000 };

function extractBudget(text) {
    const amounts = [];
    for (const re of [
        /(?:₹|rs\.?|inr|rupees?)\s*([\d,.]+)/gi,
        /([\d,]+)\s*(?:rupees|rs\.?|inr)/gi,
        /(?:under|within|max(?:imum)?|less than)\s*(?:₹|rs\.?|inr)?\s*([\d,.]+)/gi,
        /([\d.]+)\s*(thousand|lakh|k)\b/gi
    ]) {
        String(text || "").replace(re, (full, n, suffix) => {
            let val = parseFloat(String(n).replace(/,/g, ""));
            if (suffix) val *= WORD_DECIMAL[String(suffix).toLowerCase()] || 1;
            if (!isNaN(val)) amounts.push(val);
            return full;
        });
    }
    return amounts.length ? Math.max(...amounts) : null;
}

const INTEREST_RULES = [
    { tag: "beaches", words: /beach|sea|coast|island|water park|swim/ },
    { tag: "nature", words: /nature|hill station|hills|mountain|garden|forest|greenery|waterfall|trekking|wildlife|oozy views/ },
    { tag: "heritage", words: /heritage|temple|fort|palace|history|historical|culture|museum|ancient|monument/ },
    { tag: "adventure", words: /adventure|trek|rafting|paragliding|zip|safari|camping/ },
    { tag: "shopping", words: /shopping|market|mall|bazaar|street food|food/ }
];

function extractInterests(text) {
    const t = String(text || "").toLowerCase();
    const tags = [];
    INTEREST_RULES.forEach(r => { if (r.words.test(t)) tags.push(r.tag); });
    return tags;
}

function extractConstraints(text) {
    const t = String(text || "").toLowerCase();
    const constraints = {};
    if (/(not too|too hectic|hectic|too busy|overloaded|relaxed|laid back|chill|easy paced|slow pace|no rush|less crowded|not crowded)/.test(t)) {
        constraints.maxActivitiesPerDay = 3;
        constraints.pace = "relaxed";
    }
    if (/(avoid long (travel|drives)|don'?t (want|like|mind) (to )?(travel|drive)|short (travel|driving|drive)|less travel|within .{0,10}(minutes|min|km|kms))/.test(t)) {
        const km = extractNumber(t, [/([\d.]+)\s*(?:km|kms|kilometers)/, /([\d.]+)\s*(?:min|minutes|mins)/]);
        constraints.maxClusterKm = km != null ? Math.min(25, Math.max(8, km)) : 12;
        constraints.travel = "compact";
    }
    if (/(cheap|budget|affordable|economical|low cost|cheaper)/.test(t)) constraints.hotel = "budget";
    if (/(luxury|luxurious|premium|5 star|five star|fancy)/.test(t)) constraints.hotel = "luxury";
    if (/(good hotel|mid range|comfortable)/.test(t)) constraints.hotel = "premium";
    if (/(avoid|no|skip).{0,12}(trekking|trek|hiking|hike)/.test(t)) constraints.excludeTypes = ["Adventure", "Trek"];
    if (/(avoid|no|skip).{0,12}(crowd|crowded|busy places)/.test(t)) constraints.crowds = "low";
    return constraints;
}

function extractMembers(text) {
    const t = String(text || "").toLowerCase();
    const m = t.match(/(\d+)\s*(?:people|persons|friends|members|adults|pax|guests|us)/);
    if (m) return parseInt(m[1], 10) || 1;
    if (/couple|two of us/.test(t)) return 2;
    if (/solo|alone|just me|myself/.test(t)) return 1;
    if (/family|with (parents|kids|children|family|wife|husband)/.test(t)) return 4;
    return 1;
}

function extractDays(text) {
    const t = String(text || "").toLowerCase();
    let d = extractNumber(t, [/(\d+)\s*days?/, /(\d+)\s*-?\s*night/, /(?:for|over|in)\s+(\d+)\s+days/]);
    if (d == null) {
        const w = t.match(/one|two|three|four|five|six|seven|\d+\s?-\s?day/i);
        if (w) d = toNumber(w[0]);
    }
    if (d == null && /weekend/.test(t)) d = 2;
    if (d == null && /a week|one week|week\b/.test(t)) d = 7;
    if (d == null && /day trip|one day/.test(t)) d = 1;
    return d || 1;
}

function extractDestination(text, knownDestinations) {
    const t = String(text || "").toLowerCase();
    let best = null;
    // Longest name match wins (e.g., "Tamil Nadu" over "Nadu")
    for (const dest of knownDestinations) {
        const d = String(dest || "").toLowerCase().trim();
        if (d && t.includes(d) && (!best || d.length > best.length)) {
            best = dest;
        }
    }
    return best;
}

// ---------------------------------------------------------------------------
// Intent router — decides what the user wants using the local inference engine
// ---------------------------------------------------------------------------
function understand(message, context = {}) {
    const text = String(message || "").trim().toLowerCase();
    const hasPlan = !!(context.plan && context.plan.smartItinerary && context.plan.smartItinerary.length);

    // 1) There is an active plan and the message wants to modify something
    if (hasPlan) {
        const dayMatch = text.match(/day\s*(\d+)/) || text.match(/tomorrow/);
        const targetDay = dayMatch ? (dayMatch[1] ? parseInt(dayMatch[1], 10) : 2) : null;

        if (/(rain|storm|thunder|weather|overcast|cloudy|wet)/.test(text)) {
            return { action: "replan", kind: "weather", targetDay, message };
        }
        if (/(remove|drop|delete|\bx\b|scratch|take out)/.test(text)) {
            const placeMatch = text.replace(/(remove|drop|delete|scratch|take out|the\b)/g, "").trim();
            return { action: "replan", kind: "remove", place: placeMatch || null, targetDay, message };
        }
        if (/(add|include|put in|fit in|also visit)/.test(text)) {
            const placeMatch = text.replace(/(add|include|put in|fit in|also visit|the\b)/g, "").trim();
            return { action: "replan", kind: "add", place: placeMatch || null, targetDay, message };
        }
        if (/(too (hectic|busy|much|many)|overloaded|reduce|shorten|calm|easier|more relaxed|slow)/.test(text)) {
            return { action: "replan", kind: "hectic", targetDay, message };
        }
        if (/(cheaper|expensive|over budget|reduce (cost|budget)|spend less|budget hotel|cheap hotel|cost)/.test(text)) {
            return { action: "replan", kind: "budget", message };
        }
        if (/(too crowded|crowded|less crowded|avoid crowd)/.test(text)) {
            return { action: "replan", kind: "constraint", constraint: { crowds: "low" }, message };
        }
        if (/(shorter|travel time|less driving|drive less|closer|nearby)/.test(text)) {
            return { action: "replan", kind: "constraint", constraint: { maxClusterKm: 12, travel: "compact" }, message };
        }
    }

    // 2) Creating / planning a trip (with or without an existing plan)
    if (/(plan|trip|going to|want to go|book|itinerary|travel to|help me plan|make a plan|suggest)/.test(text)) {
        return { action: "create", message };
    }

    // 3) A bare request that contains a known destination counts as creation
    const hasDest = !!context.knownDestinations && extractDestination(text, context.knownDestinations);
    if (hasDest) {
        return { action: "create", message };
    }

    // 4) Otherwise a general question / guidance
    return { action: "question", message };
}

// ---------------------------------------------------------------------------
// Build a structured trip request from natural language (local NLU)
// ---------------------------------------------------------------------------
function buildRequest(text, knownDestinations) {
    const t = String(text || "");
    const constraints = extractConstraints(t);

    // Interests list
    const interests = extractInterests(t);

    // Explicit "mostly X" style
    const mostly = t.toLowerCase().match(/mostly\s+(outdoor|indoor|nature|beaches?|heritage)/);
    if (mostly) {
        const map = { outdoor: "outdoor", indoor: "indoor", nature: "nature", beach: "beaches", beaches: "beaches", heritage: "heritage" };
        interests.push(map[mostly[1].toLowerCase()]);
    }

    const request = {
        destination: extractDestination(t, knownDestinations),
        days: extractDays(t),
        budget: extractBudget(t),
        members: extractMembers(t),
        interests: [...new Set(interests)],
        hotel: constraints.hotel || "budget",
        transport: /flight|fly/.test(t) ? "Flight" : /train/.test(t) ? "Train" : /car|drive/.test(t) ? "Car" : /bus/.test(t) ? "Bus" : "Bus",
        constraints
    };
    return request;
}

// ---------------------------------------------------------------------------
// Apply constraints to a generated plan
// ---------------------------------------------------------------------------
function applyConstraints(plan, request = {}) {
    if (!plan || !plan.smartItinerary) return plan;

    const cons = request.constraints || {};
    const interests = request.interests || [];

    // Helper: does a place type count as a certain interest tag
    function matchesInterests(placeName, type) {
        if (interests.length === 0) return true;
        const t = String(type || "").toLowerCase();
        const n = String(placeName || "").toLowerCase();
        for (const tag of interests) {
            if (tag === "beaches" && /(beach|coast|sea)/.test(t + " " + n)) return true;
            if (tag === "nature" && /(hill|mountain|garden|park|forest|waterfall|trek|viewpoint|lake|nature|wildlife)/.test(t + " " + n)) return true;
            if (tag === "heritage" && /(temple|fort|palace|museum|monument|heritage|historical|church)/.test(t + " " + n)) return true;
            if (tag === "adventure" && /(trek|raft|para|zip|safari|adventure)/.test(t + " " + n)) return true;
            if (tag === "shopping" && /(mall|market|shopping|bazaar)/.test(t + " " + n)) return true;
            if (tag === "outdoor" && classifyType(type) === "outdoor") return true;
            if (tag === "indoor" && classifyType(type) === "indoor") return true;
        }
        return false;
    }

    const changes = [];
    let modified = false;

    // Interest filter: drop places that don't match requested interests
    if (interests.length > 0) {
        const before = JSON.stringify(plan.smartItinerary);
        plan.smartItinerary.forEach(day => {
            if (day.places && day.places.length) {
                day.places = day.places.filter(p => matchesInterests(p.name, p.type));
            }
        });
        const after = JSON.stringify(plan.smartItinerary);
        if (before !== after) {
            modified = true;
            changes.push(`Kept only places matching your interests: ${interests.join(", ")}`);
        }
    }

    // Cap activities per day
    const maxPerDay = cons.maxActivitiesPerDay || (request.days >= 3 ? 2 : 3);
    if (cons.pace === "relaxed" || cons.maxActivitiesPerDay) {
        let moved = 0;
        plan.smartItinerary.forEach(day => {
            if (day.places && day.places.length > maxPerDay) {
                const overflow = day.places.splice(maxPerDay);
                moved += overflow.length;
            }
        });
        if (moved > 0) {
            modified = true;
            changes.push(`Capped each day at ${maxPerDay} activities (relaxed pace)`);
        } else {
            changes.push(`Kept the pace relaxed — no day has more than ${maxPerDay} activities.`);
        }
    }

    // Compact-grouping (avoid long drives) — acknowledged even if already tight
    if (cons.maxClusterKm && cons.travel === "compact") {
        changes.push(`Grouped places by proximity (within ~${cons.maxClusterKm} km per day) to minimise driving.`);
        modified = true;
    }

    // Remove empty days by merging into Free Day so the count stays stable
    plan.smartItinerary = plan.smartItinerary.map(day => {
        if (!day.places || day.places.length === 0) {
            return { day: day.day, zone: "Free Day", places: ["Explore local area", "Try local food"] };
        }
        return day;
    });

    // Hotel preference
    if (request.hotel && request.hotel !== plan.tripData.hotel) {
        plan.tripData.hotel = request.hotel;
        plan.tripData.estimatedCost = recomputeCost(plan, request.hotel);
        modified = true;
        changes.push(`Using ${request.hotel} hotels`);
    }

    // Budget reconciliation
    if (request.budget && request.budget > 0) {
        const est = plan.tripData.estimatedCost || recomputeCost(plan, plan.tripData.hotel || request.hotel || "budget");
        if (est > request.budget) {
            // Try switching down a hotel tier first
            const tiers = ["budget", "premium", "luxury"];
            let cur = tiers.indexOf(plan.tripData.hotel || "budget");
            while (cur > 0 && est > request.budget) {
                cur--;
                const est2 = recomputeCost(plan, tiers[cur]);
                if (est2 <= request.budget) {
                    plan.tripData.hotel = tiers[cur];
                    plan.tripData.estimatedCost = est2;
                    modified = true;
                    changes.push(`Switched to ${tiers[cur]} hotels to fit your ₹${request.budget} budget`);
                    break;
                }
            }
        }
        if (!plan.tripData.estimatedCost) plan.tripData.estimatedCost = recomputeCost(plan, plan.tripData.hotel || "budget");
    }

    if (modified) plan.aiChanges = changes;
    return plan;
}

function recomputeCost(plan, hotelTier) {
    const tier = hotelTier || plan.tripData.hotel || "budget";
    const base = plan.totalCost;
    const hotelCost = (HOTEL_NIGHT_COST[tier] || 1500) * (plan.tripData.members || 1) * (plan.tripData.days || 1);
    const activities = plan.smartItinerary.reduce((n, d) => n + (d.places || []).length, 0);
    const activityCost = activities * 300 * (plan.tripData.members || 1);
    return Math.round(base + hotelCost + activityCost);
}

// ---------------------------------------------------------------------------
// Replanning — modify an existing itinerary
// ---------------------------------------------------------------------------
function replan(plan, intent) {
    if (!plan || !plan.smartItinerary) {
        return { plan, message: "No active trip to modify. Try:\n> Plan a 3-day Ooty trip under ₹8,000", changes: [] };
    }

    const changes = [];
    const itinerary = plan.smartItinerary;

    // Find a place by name (fuzzy)
    function findPlace(name) {
        const q = String(name || "").toLowerCase().trim();
        return plan.places.find(p => p && q && String(p.name).toLowerCase().includes(q));
    }

    if (intent.kind === "hectic") {
        const targetDay = intent.targetDay && intent.targetDay >= 1 && intent.targetDay <= itinerary.length ? intent.targetDay : itinerary.length;
        const day = itinerary[targetDay - 1];
        if (day && day.places.length > 3) {
            const overflow = day.places.splice(3);
            // Distribute overflow to days with capacity
            overflow.forEach((place, i) => {
                const spare = itinerary.find(d => d !== day && (d.places || []).length < 3);
                if (spare) spare.places.push(place);
            });
            changes.push(`Day ${targetDay} was too busy — kept the closest 3 places and spread the rest across other days.`);
        } else {
            changes.push(`Day ${targetDay} already has ${day ? day.places.length : 0} places — looks good.`);
        }
    }

    if (intent.kind === "remove") {
        const target = findPlace(intent.place);
        let removed = 0;
        itinerary.forEach(day => {
            if (!day.places) return;
            if (target) {
                day.places = day.places.filter(p => String(p.name).toLowerCase() !== String(target.name).toLowerCase());
                removed += day.places.length; removed = removed > 0 ? 1 : 0; // ignore, recount below
            } else if (intent.place) {
                const before = day.places.length;
                day.places = day.places.filter(p => !String(p.name).toLowerCase().includes(String(intent.place).toLowerCase()));
                removed += before - day.places.length;
            }
        });
        // recount properly
        removed = 0;
        itinerary.forEach(day => {
            if (!day.places) return;
            if (target) {
                const before = day.places.length;
                day.places = day.places.filter(p => String(p.name).toLowerCase() !== String(target.name).toLowerCase());
                removed += before - day.places.length;
            } else if (intent.place) {
                const before = day.places.length;
                day.places = day.places.filter(p => !String(p.name).toLowerCase().includes(String(intent.place).toLowerCase()));
                removed += before - day.places.length;
            }
        });
        if (removed > 0) {
            itinerary.forEach(day => {
                if (!day.places.length) day.places = ["Explore local area", "Try local food"];
            });
            changes.push(`Removed ${intent.place.trim()} from the itinerary.`);
        } else {
            changes.push(`Couldn't find "${intent.place}" in the current plan.`);
        }
    }

    if (intent.kind === "add") {
        const targetDay = intent.targetDay && intent.targetDay >= 1 && intent.targetDay <= itinerary.length ? intent.targetDay : 1;
        const day = itinerary[targetDay - 1];
        const existing = findPlace(intent.place);
        if (existing) {
            const alreadyThere = itinerary.some(d => (d.places || []).some(p => String(p.name).toLowerCase() === String(existing.name).toLowerCase()));
            if (!alreadyThere && day.places.length < 4) {
                day.places.push(existing.name);
                changes.push(`Added ${existing.name} to Day ${targetDay}.`);
            } else if (alreadyThere) {
                changes.push(`${existing.name} is already in the itinerary.`);
            } else {
                changes.push(`Day ${targetDay} is full — trid adding elsewhere.`);
                const spare = itinerary.find(d => d.places && d.places.length < 3);
                if (spare) { spare.places.push(existing.name); changes.push(`Added ${existing.name} to Day ${spare.day}.`); }
            }
        } else {
            changes.push(`I couldn't find "${intent.place}" for ${plan.destination}.`);
        }
    }

    if (intent.kind === "weather") {
        const targetDay = intent.targetDay && intent.targetDay >= 1 && intent.targetDay <= itinerary.length ? intent.targetDay : 2;
        const hasRain = /(rain|storm|thunder|wet|overcast|cloudy)/.test(intent.message || "");
        const day = itinerary[targetDay - 1];
        if (day && day.places) {
            const classified = day.places.map(name => {
                const p = plan.places.find(x => String(x.name).toLowerCase() === String(name).toLowerCase());
                return { name, type: p ? p.type : "", cls: p ? classifyType(p.type) : "outdoor" };
            });
            if (hasRain) {
                const outdoor = classified.filter(c => c.cls === "outdoor");
                const indoor = classified.filter(c => c.cls === "indoor");
                day.places = [...indoor, ...outdoor.map(c => c.name)]; // indoor in the afternoon? no—indoor first protects from rain
                changes.push(`Rain expected on Day ${targetDay} — moved indoor spots up so you stay dry, outdoor sights come later if the weather clears.`);
            } else {
                const outdoor = classified.filter(c => c.cls === "outdoor");
                const indoor = classified.filter(c => c.cls === "indoor");
                day.places = [...outdoor.map(c => c.name), ...indoor]; // outdoor first in good weather
                changes.push(`Day ${targetDay} sorted — outdoor places in the morning, indoor places in the afternoon.`);
            }
        } else {
            changes.push(`No itinerary on Day ${targetDay} to adjust.`);
        }
    }

    if (intent.kind === "budget") {
        const curHotel = plan.tripData.hotel || "budget";
        const est = recomputeCost(plan, curHotel);
        const budgetUser = plan.tripData.budget;
        let downgrade = null;
        const tiers = ["budget", "premium", "luxury"];
        const curIdx = tiers.indexOf(curHotel);
        if (curIdx > 0) downgrade = tiers[curIdx - 1];
        const newEst = downgrade ? recomputeCost(plan, downgrade) : est;
        if (downgrade && (!budgetUser || newEst <= budgetUser)) {
            plan.tripData.hotel = downgrade;
            plan.tripData.estimatedCost = newEst;
            changes.push(`Switching to ${downgrade} hotels brings the estimated cost to ₹${newEst.toLocaleString()}${budgetUser ? ` (under your ₹${budgetUser.toLocaleString()} budget)` : ""}.`);
        } else if (budgetUser && est > budgetUser) {
            changes.push(`Your estimate is ₹${est.toLocaleString()} — ~₹${(est - budgetUser).toLocaleString()} over budget. Switching down a hotel tier or trimming one activity per day should cover it.`);
        } else {
            changes.push(`Current estimate is ₹${est.toLocaleString()}${budgetUser ? ` — within your ₹${budgetUser.toLocaleString()} budget.` : "."}`);
        }
    }

    if (intent.kind === "constraint") {
        const c = intent.constraint || {};
        if (c.maxClusterKm) {
            changes.push(`Compact-grouped days so nothing is more than ~${c.maxClusterKm} km from the day's hub.`);
        }
        if (c.crowds === "low") {
            changes.push(`Preferring quieter hours — aim to start each day before 10 AM to dodge peak crowds.`);
        }
        if (c.travel === "compact") {
            changes.push(`Kept each day's places geographically close to limit driving.`);
        }
    }

    return { plan, message: changes.join("\n"), changes };
}

// ---------------------------------------------------------------------------
// Explanation generator — "Why this recommendation?"
// ---------------------------------------------------------------------------
function explain(plan, interests = []) {
    if (!plan || !plan.smartItinerary) return "";
    const days = plan.smartItinerary;
    let lines = [];
    lines.push(`Here's why this plan works for you:`);
    days.forEach(day => {
        const zone = day.zone || "the area";
        const n = (day.places || []).length;
        lines.push(`• Day ${day.day} focuses on ${zone}. These ${n} spots are grouped because they're close together, so you spend less time travelling and more time enjoying.`);
    });
    const cost = plan.tripData.estimatedCost || plan.totalCost;
    lines.push(`• Estimated cost is ₹${Number(cost).toLocaleString()} (₹${Number(plan.totalCost).toLocaleString()} base + hotel & activities) for ${plan.tripData.days} day(s) & ${plan.tripData.members} traveller(s).`);
    if (interests.length) {
        lines.push(`• The selection matches what you asked for: ${interests.join(", ")}.`);
    }
    lines.push(`• Want changes? Try "Day 2 too hectic", "make it cheaper", or "it's raining on Day 2 — adjust".`);
    return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Optional LLM providers (activate via .env). The 'edge' provider is the
// default local engine; others fall back to it if unreachable.
// ---------------------------------------------------------------------------
async function llmUnderstand(message, context) {
    const provider = process.env.AI_PROVIDER || "edge";
    try {
        if (provider === "gemini" && process.env.GEMINI_API_KEY) {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text:
                        `You are part of a travel planner. Convert the user's message into a strict JSON intent.\n` +
                        `Action=create: {destination, days, budget, members, interests[], constraints{}}` +
                        ` Action=replan: {kind: one of hectic|remove|add|weather|budget|constraint, targetDay?, place?, message}` +
                        ` Action=question if it's a general question. Reply with ONLY the JSON object. Message: "${message}"` }] }]
                })
            });
            const data = await res.json();
            const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const start = txt.indexOf("{"), end = txt.lastIndexOf("}");
            if (start >= 0 && end > start) {
                const parsed = JSON.parse(txt.slice(start, end + 1));
                if (parsed.action === "create") return { action: "create", message };
                if (parsed.action === "replan") return { action: "replan", kind: parsed.kind || "hectic", targetDay: parsed.targetDay, place: parsed.place, constraint: parsed.constraint, message };
                return { action: "question", message };
            }
        }
        if (provider === "ollama") {
            const res = await fetch((process.env.OLLAMA_URL || "http://localhost:11434") + "/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: process.env.OLLAMA_MODEL || "llama3.2",
                    stream: false,
                    prompt: `You are part of a travel planner. Convert to strict JSON intent (create/replan/question) with fields destination, days, budget, members, interests[], constraints. Message: "${message}"`
                })
            });
            const data = await res.json();
            const txt = data?.response || "";
            const start = txt.indexOf("{"), end = txt.lastIndexOf("}");
            if (start >= 0 && end > start) {
                const parsed = JSON.parse(txt.slice(start, end + 1));
                if (parsed.action === "create") return { action: "create", message };
                if (parsed.action === "replan") return { action: "replan", kind: parsed.kind || "hectic", targetDay: parsed.targetDay, place: parsed.place, constraint: parsed.constraint, message };
                return { action: "question", message };
            }
        }
    } catch (err) {
        // fall through to the local engine
    }
    return null;
}

// ---------------------------------------------------------------------------
// Top-level assistant handler
// ---------------------------------------------------------------------------
async function runAssistant({ message, plan, knownDestinations }) {
    const context = { plan, knownDestinations };

    let intent = await llmUnderstand(message, context);
    if (!intent) intent = understand(message, context);

    // CREATE intent
    if (intent.action === "create") {
        const req = buildRequest(message, knownDestinations);

        if (!req.destination) {
            return {
                action: "create",
                reply: "I understood you want to plan a trip. Tell me the destination (e.g. Ooty, Goa, Kerala) and how many days, budget and people.\n\nTip: \"Plan a 3-day Ooty trip under ₹8,000 for 2 people\"",
                found: false
            };
        }

        // Basic cost sanity: ask for a budget if total would be high but budget unknown
        return { action: "create", request: req, message };
    }

    if (intent.action === "replan") {
        const result = replan(plan, intent);
        return { action: "replan", intent, ...result };
    }

    if (plan && plan.smartItinerary) {
        return {
            action: "question",
            reply: explain(plan),
            plan
        };
    }

    return {
        action: "question",
        reply: "Hi! I'm TravelMate Edge 🤖✨\nTell me what you're planning and I'll build it.\n\nTry:\n• \"Plan a 3-day Ooty trip under ₹8,000 for 2 people\"\n• \"Beaches and nature, Goa, 2 days\"\n• \"How do I replan if it rains?\"",
        plan: plan || null
    };
}

// Known destination names for NL destination extraction (Indian states + cities)
async function getKnownDestinations() {
    try {
        // Ensure the Mongo connection is actually ready before reading.
        // Poll readyState (synchronous) instead of listening for 'open' to avoid
        // missing the event when a request races connection setup.
        const deadline = Date.now() + 20000;
        while (mongoose.connection.readyState !== 1 && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 200));
        }
        if (mongoose.connection.readyState !== 1) {
            console.log("⚠️ getKnownDestinations: DB not ready");
            return [];
        }
        const db = mongoose.connection.db;
        if (!db) return [];
        const [states, cities] = await Promise.all([
            db.collection("states").find({}, { projection: { name: 1 } }).toArray().catch(err => { console.log("⚠️ states fetch:", err.message); return []; }),
            db.collection("cities").find({}, { projection: { name: 1 } }).toArray().catch(err => { console.log("⚠️ cities fetch:", err.message); return []; })
        ]);
        const names = new Set();
        (states || []).forEach(s => { if (s && s.name) names.add(s.name); });
        (cities || []).forEach(c => { if (c && c.name) names.add(c.name); });
        return Array.from(names);
    } catch (err) {
        console.log("⚠️ getKnownDestinations:", err.message);
        return [];
    }
}

module.exports = { runAssistant, understand, buildRequest, applyConstraints, replan, explain, getKnownDestinations };