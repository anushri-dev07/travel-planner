const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

require("dotenv").config();

// ---------- Helpers ----------
function normalizeEmail(e) {
    return String(e || "").trim().toLowerCase();
}

function regexEscape(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");

function signToken(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
    return `${body}.${sig}`;
}

function verifyToken(token) {
    try {
        const [body, sig] = String(token || "").split(".");
        if (!body || !sig) return null;
        const expected = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
        const payload = JSON.parse(Buffer.from(body, "base64url").toString());
        if (!payload.email || (payload.exp && Date.now() > payload.exp)) return null;
        return payload;
    } catch (err) {
        return null;
    }
}

function issueToken(email, role) {
    return signToken({ email: normalizeEmail(email), role: role || "user", iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
}

function getIdentity(req) {
    const auth = req.headers.authorization || "";
    if (auth.startsWith("Bearer ")) {
        const payload = verifyToken(auth.slice(7));
        if (payload && payload.email) return payload.email;
    }
    return normalizeEmail((req.body && req.body.email) || req.query.email);
}

function authAdmin(req, res, next) {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.query.token || "");
    const payload = verifyToken(token);
    if (payload && payload.role === "admin") return next();
    return res.status(401).json({ success: false, msg: "Unauthorized" });
}

const hotelData = require("./data/hotels");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve index.html for root path
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Ensure uploads directory exists
if (!fs.existsSync("./uploads")) {
    fs.mkdirSync("./uploads");
}

// Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Models
const State = require("./models/State");
const User = require("./models/User");
const City = require("./models/City");
const Place = require("./models/Place");
const Review = require("./models/Review");
const PopularPlace = require("./models/PopularPlace");
const Badge = require("./models/Badge");
const { buildTripPlan } = require("./planner");
const aiAgent = require("./aiAgent");

// Connect MongoDB Atlas
if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI is not set in .env — cannot connect to database.");
    process.exit(1);
}
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000, connectTimeoutMS: 30000 })
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log("MongoDB Error:", err.message));

// Helper to wait for DB
const waitForDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    await new Promise(resolve => mongoose.connection.once('open', resolve));
};

// 🌦️ Live weather for the AI replanner.
// Uses the OpenWeatherMap 5-day forecast when OPENWEATHER_API_KEY is set.
// Falls back to a deterministic, locally computed forecast so the demo still
// works fully offline (on-device friendly: no cloud dependency).
const WEATHER_CACHE = {};
async function getDestinationWeather(destName, days = 5) {
    const key = String(destName || "").trim().toLowerCase();
    if (!key) return [];
    if (WEATHER_CACHE[key]) return WEATHER_CACHE[key];
    let out = [];

    const apiKey = process.env.OPENWEATHER_API_KEY || '';
    try {
        if (apiKey) {
            // 1) resolve coords
            const db = mongoose.connection.db;
            let lat, lon, city;
            const cityDoc = db ? await db.collection("cities").findOne({ name: new RegExp("^" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") }) : null;
            if (cityDoc && cityDoc.lat && cityDoc.lng) {
                lat = cityDoc.lat; lon = cityDoc.lng; city = cityDoc.name;
            } else {
                const geo = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(key)}&limit=1&appid=${apiKey}`);
                const geoData = await geo.json();
                if (geoData && geoData.length) {
                    lat = geoData[0].lat; lon = geoData[0].lon; city = geoData[0].name;
                }
            }
            if (lat != null && lon != null) {
                const f = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`);
                const data = await f.json();
                if (data && data.list) {
                    const daily = {};
                    data.list.forEach(item => {
                        const date = (item.dt_txt || "").split(" ")[0];
                        if (!date) return;
                        if (!daily[date]) {
                            daily[date] = {
                                tempMin: Math.round(item.main.temp_min),
                                tempMax: Math.round(item.main.temp_max),
                                rain: (item.rain && (item.rain["3h"] || item.rain["1h"])) || /rain|drizzle|storm|thunder/.test(item.weather?.[0]?.main || ""),
                                description: item.weather?.[0]?.description || ""
                            };
                        } else if (/rain|drizzle|storm|thunder/.test(item.weather?.[0]?.main || "")) {
                            daily[date].rain = true;
                        }
                    });
                    out = Object.keys(daily).sort().slice(0, days).map((date, i) => ({
                        day: i + 1,
                        date,
                        temp: `${daily[date].tempMin}°–${daily[date].tempMax}°`,
                        rain: !!daily[date].rain,
                        description: daily[date].description
                    }));
                }
            }
        }
    } catch (err) {
        console.log("🌦️ Weather fetch failed (falling back):", err.message);
    }

    // Deterministic local fallback — stable per destination so the demo is offline-safe.
    if (out.length === 0) {
        let seed = 0;
        for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
        const base = 18 + (seed % 12);
        out = Array.from({ length: days }, (_, i) => {
            const hash = (seed + i * 7) % 11;
            return {
                day: i + 1,
                date: null,
                temp: `${base + hash}°–${base + hash + 6}°`,
                rain: hash <= 2,
                description: hash <= 2 ? "light rain showers" : "partly cloudy"
            };
        });
    }

    WEATHER_CACHE[key] = out;
    return out;
}

// Serve API keys (so user configures them once in .env)
app.get("/api/config", (req, res) => {
    res.json({
        orsApiKey: process.env.ORS_API_KEY || '',
        openWeatherApiKey: process.env.OPENWEATHER_API_KEY || ''
    });
});

// ✅ GET all destinations (with cities and places)
app.get("/destinations", async (req, res) => {
    try {
        await waitForDB();
        const db = mongoose.connection.db;
        if (!db) throw new Error("Database not ready");
        
        const states = await db.collection("states").find({}).toArray();
        const cities = await db.collection("cities").find({}).toArray();
        const places = await db.collection("places").find({}).toArray();
        const countries = await db.collection("countries").find({}).toArray();
        
        console.log("Countries:", countries.length, "| States:", states.length);
        console.log("Cities:", cities.length, "| Places:", places.length);
        
        const data = [];
        
        // Compute tags for a destination based on its places
        function computeTags(places) {
            const tags = new Set();
            places.forEach(p => {
                const t = (p.type || '').toLowerCase();
                const n = (p.name || '').toLowerCase();
                if (t.includes('beach') || t.includes('coast') || n.includes('beach')) tags.add('beaches');
                if (t.includes('hill') || t.includes('mountain') || t.includes('trek') || t.includes('peak') || n.includes('hill') || n.includes('mountain')) tags.add('mountains');
                if (t.includes('fort') || t.includes('temple') || t.includes('palace') || t.includes('museum') || t.includes('monument') || t.includes('heritage') || t.includes('historical') || n.includes('fort') || n.includes('temple') || n.includes('palace') || n.includes('museum')) tags.add('heritage');
            });
            return Array.from(tags);
        }

        // Add foreign cities as individual entries (treat cities like states)
        const foreignCities = cities.filter(c => c.countryId);
        foreignCities.forEach(city => {
            const country = countries.find(c => c._id === city.countryId);
            const cityPlaces = places
                .filter(p => p.cityId === city._id)
                .map(p => ({
                    name: p.name,
                    type: p.type,
                    rating: p.rating
                }));
            
            if (cityPlaces.length > 0) {
                data.push({
                    _id: city._id,
                    name: city.name,
                    type: "region",
                    cities: [{ name: city.name, places: cityPlaces }],
                    tags: computeTags(cityPlaces),
                    costPerDay: country?.costPerDay || 8000,
                    activities: country?.activities || ["Sightseeing", "Tourism"],
                    food: country?.food || ["Local Cuisine"],
                    hotels: country?.hotels || { budget: ["Budget Hotel"], premium: ["Premium Hotel"], luxury: ["Luxury Resort"] }
                });
            }
        });
        
        // Add Indian states
        const indianCityIds = new Set(cities.filter(c => c.stateId).map(c => c.stateId));
        indianCityIds.forEach(stateId => {
            const state = states.find(s => s._id === stateId);
            if (state) {
                const stateCities = cities
                    .filter(c => c.stateId === stateId)
                    .map(city => ({
                        name: city.name,
                        places: places
                            .filter(p => p.cityId === city._id)
                            .map(p => ({
                                name: p.name,
                                type: p.type,
                                rating: p.rating
                            }))
                    }));
                const allStatePlaces = stateCities.flatMap(c => c.places);
                
                data.push({
                    _id: state._id,
                    name: state.name,
                    type: "state",
                    cities: stateCities,
                    tags: computeTags(allStatePlaces),
                    costPerDay: state.costPerDay || 3000,
                    activities: state.activities || ["Sightseeing"],
                    food: state.food || ["Local Cuisine"],
                    hotels: state.hotels || { budget: ["Budget Inn"], premium: ["Premium Hotel"], luxury: ["Luxury Resort"] }
                });
            }
        });
        
        res.json(data);
    } catch (err) {
        console.log("Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 🔍 DEBUG: Get all MongoDB data
app.get("/debug/all", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ error: "MongoDB not connected yet. Wait a few seconds and try again." });
        }
        const db = mongoose.connection.db;
        const states = await db.collection("states").find({}).toArray();
        const cities = await db.collection("cities").find({}).toArray();
        const places = await db.collection("places").find({}).toArray();
        const countries = await db.collection("countries").find({}).toArray();
        
        res.json({
            states: states.map(s => s.name),
            cities: cities.map(c => ({ name: c.name, stateId: c.stateId, countryId: c.countryId })),
            places: places.map(p => ({ name: p.name, cityId: p.cityId })),
            countries: countries.map(c => c.name)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// 🔐 REGISTER API
app.post("/register", async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const email = normalizeEmail(req.body.email);
        const password = String(req.body.password || "");

        if (!username || !email || !password) {
            return res.json({ success: false, msg: "All fields are required!" });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.json({ success: false, msg: "Please enter a valid email address!" });
        }

        // Extract domain and check if it exists (DNS MX lookup)
        const domain = email.split('@')[1];
        try {
            const dns = require('dns');
            const dnsPromises = dns.promises;
            await dnsPromises.resolveMx(domain);
        } catch (dnsError) {
            console.log("❌ Email domain not found:", domain);
            return res.json({ success: false, msg: "Email domain does not exist! Please use a valid email." });
        }

        // Check if user already exists (case-insensitive)
        const existing = await User.findOne({
            $or: [
                { username: { $regex: new RegExp("^" + regexEscape(username) + "$", "i") } },
                { email: { $regex: new RegExp("^" + regexEscape(email) + "$", "i") } }
            ]
        });
        if (existing) {
            return res.json({ success: false, msg: "User already exists!" });
        }

        // Create user (not verified yet)
        const user = new User({ username, email, password, verified: false });
        await user.save();
        
        // Send verification email
        const { sendVerificationEmail } = require('./emailService');
        await sendVerificationEmail(email, username);
        
        console.log("✅ User registered:", username, "| Email:", email);
        res.json({ success: true, needsVerification: true, token: issueToken(email, "user"), msg: "Registration successful! Check your email for the verification code." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verify email code
app.post("/verify-email", async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { code } = req.body;
        const { verifyCode } = require('./emailService');
        
        if (verifyCode(email, code)) {
            await User.findOneAndUpdate({ email: { $regex: new RegExp("^" + regexEscape(email) + "$", "i") } }, { verified: true });
            res.json({ success: true, msg: "Email verified!" });
        } else {
            res.json({ success: false, msg: "Invalid or expired code!" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Resend verification code
app.post("/resend-code", async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const username = String(req.body.username || "").trim();
        const { sendVerificationEmail } = require('./emailService');
        const code = await sendVerificationEmail(email, username);
        
        if (code) {
            res.json({ success: true, msg: "Verification code sent! Check your email." });
        } else {
            res.json({ success: false, msg: "Failed to send code. Please try again." });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// 🔐 LOGIN API
app.post("/login", async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const password = String(req.body.password || "");

        if (!email || !password) {
            return res.json({ success: false, msg: "Invalid email or password" });
        }

        // Case-insensitive lookup so "Anu@Gmail.com" matches "anu@gmail.com"
        const user = await User.findOne({ email: { $regex: new RegExp("^" + regexEscape(email) + "$", "i") } });
        if (!user) {
            return res.json({ success: false, msg: "Invalid email or password" });
        }

        const storedPw = String(user.password || "");
        let isMatch = false;
        if (storedPw.startsWith("$2")) {
            isMatch = await bcrypt.compare(password, storedPw);
        } else {
            isMatch = storedPw === password;
            if (isMatch) {
                // Upgrade legacy plaintext password. Assigning the raw password here and letting
                // the model's pre-save hook hash it ONCE avoids the previous double-hash bug
                // (manual hash + pre-save re-hash made the account un-loginable afterwards).
                user.password = password;
                await user.save();
            }
        }

        if (!isMatch) {
            return res.json({ success: false, msg: "Invalid email or password" });
        }

        console.log("🔐 User logged in:", user.username, "| Email:", user.email);
        res.json({ 
            success: true, 
            token: issueToken(user.email, "user"),
            username: user.username, 
            email: user.email, 
            trips: user.trips || [], 
            wishlist: user.wishlist || [], 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});





// ✈️ PLAN TRIP API
app.post("/plan", async (req, res) => {
    try {
        let { name, budget, days, members, hotelChoice, transport, email, place, city, tripDate } = req.body;

        email = getIdentity(req);
        budget = Number(budget) || 0;
        days = Number(days) || 1;
        members = Number(members) || 1;

        const searchName = name.trim().toLowerCase();
        console.log("🗺️ Planning trip for:", searchName);
        console.log("   Budget: ₹" + budget + ", Days: " + days + ", Members: " + members);
        
        const db = mongoose.connection.db;
        const countries = await db.collection("countries").find({}).toArray();
        const states = await db.collection("states").find({}).toArray();
        const cities = await db.collection("cities").find({}).toArray();
        const places = await db.collection("places").find({}).toArray();
        
        let dest = null;
        let isInternational = false;
        
        // Search in cities first (for foreign cities like San Francisco, Paris, etc.)
        dest = cities.find(c => c.name.toLowerCase() === searchName && c.countryId);
        if (dest) {
            const country = countries.find(c => c._id === dest.countryId);
            isInternational = true;
            dest = { _id: dest._id, name: dest.name, costPerDay: country?.costPerDay || 8000 };
        }
        
        // If not found in cities, search in Indian states
        if (!dest) {
            const indianCityIds = [...new Set(cities.filter(c => c.stateId).map(c => c.stateId))];
            const foundState = indianCityIds
                .map(id => states.find(s => s._id === id))
                .find(s => s && s.name.toLowerCase() === searchName);
            if (foundState) {
                dest = foundState;
            }
        }
         
        if (!dest) {
            console.log("❌ Destination not found:", searchName);
            return res.json({ success: false, msg: "Destination not found" });
        }
        console.log("✅ Found:", dest.name);

        const costPerDay = dest.costPerDay || (isInternational ? 8000 : 3000);
        const total = costPerDay * days * members;

        // Get places for this destination
        let allPlaces = [];
        let destCities = [];
        
        if (isInternational) {
            // For international cities, search by city name
            destCities = cities.filter(c => c.name.toLowerCase() === searchName);
        } else {
            // For Indian states, search by stateId
            destCities = cities.filter(c => c.stateId === dest._id);
        }
        
        // Haversine distance function (in km)
        function getDistance(lat1, lng1, lat2, lng2) {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        }
        
        // Get places with city coordinates
        let cityPlacesMap = {};
        destCities.forEach(c => {
            if (c.lat && c.lng) {
                cityPlacesMap[c.name] = { lat: c.lat, lng: c.lng, places: [] };
            }
        });
        
        places.forEach(p => {
            const city = cities.find(c => c._id === p.cityId);
            if (city && cityPlacesMap[city.name]) {
                cityPlacesMap[city.name].places.push({ name: p.name, type: p.type });
            }
        });
        
        // Group by city first
        let allPlacesWithCoords = [];
        Object.entries(cityPlacesMap).forEach(([cityName, data]) => {
            data.places.forEach(p => {
                allPlacesWithCoords.push({ name: p.name, type: p.type, city: cityName, lat: data.lat, lng: data.lng });
            });
        });
        
        // Distance-based clustering
        function clusterByDistance(places, maxDistance = 30) {
            if (places.length === 0) return [];
            
            let clusters = [];
            let used = new Set();
            
            // Start with first place
            while (used.size < places.length) {
                let cluster = [];
                let remaining = places.filter((p, i) => !used.has(i));
                
                if (remaining.length === 0) break;
                
                // Start new cluster with first remaining place
                let startIdx = places.findIndex(p => p === remaining[0]);
                cluster.push(remaining[0]);
                used.add(startIdx);
                
                // Find nearby places within maxDistance
                for (let i = 0; i < remaining.length; i++) {
                    if (used.has(places.indexOf(remaining[i]))) continue;
                    
                    let nearestInCluster = cluster[0];
                    let minDist = getDistance(remaining[i].lat, remaining[i].lng, nearestInCluster.lat, nearestInCluster.lng);
                    
                    for (let j = 0; j < cluster.length; j++) {
                        let dist = getDistance(remaining[i].lat, remaining[i].lng, cluster[j].lat, cluster[j].lng);
                        if (dist < minDist) {
                            minDist = dist;
                        }
                    }
                    
                    if (minDist <= maxDistance) {
                        let idx = places.indexOf(remaining[i]);
                        cluster.push(remaining[i]);
                        used.add(idx);
                    }
                }
                
                if (cluster.length > 0) {
                    // Get cluster center for zone name
                    let centerLat = cluster.reduce((sum, p) => sum + p.lat, 0) / cluster.length;
                    let centerLng = cluster.reduce((sum, p) => sum + p.lng, 0) / cluster.length;
                    clusters.push({ 
                        zone: cluster[0].city, 
                        places: cluster.map(p => p.name),
                        centerLat,
                        centerLng
                    });
                }
            }
            
            return clusters;
        }
        
        const proximityClusters = clusterByDistance(allPlacesWithCoords, 25);
        
        // Smart itinerary builder
        let smartItinerary = [];
        const usedPlaces = new Set();
        let dayIndex = 0;
        
        // Use clusters if available, otherwise distribute by city
        const destClusters = proximityClusters;
        
        if (destClusters && destClusters.length > 0 && days <= destClusters.length * 2) {
            // Use proximity-based clustering
            dayIndex = 0;
            destClusters.forEach(cluster => {
                if (dayIndex >= days) return;
                const placesForDay = cluster.places.filter(p => !usedPlaces.has(p)).slice(0, 2);
                if (placesForDay.length > 0) {
                    smartItinerary.push({
                        day: dayIndex + 1,
                        zone: cluster.zone,
                        places: placesForDay
                    });
                    placesForDay.forEach(p => usedPlaces.add(p));
                    dayIndex++;
                }
                if (dayIndex > 0 && placesForDay.length < 3) {
                    const morePlaces = cluster.places.filter(p => !usedPlaces.has(p)).slice(0, 1);
                    if (morePlaces.length > 0 && smartItinerary[dayIndex - 1]) {
                        smartItinerary[dayIndex - 1].places.push(...morePlaces);
                        morePlaces.forEach(p => usedPlaces.add(p));
                    }
                }
            });
        } else {
            // Fallback: distribute by city
            destCities.forEach((city, idx) => {
                if (dayIndex >= days) return;
                const cityPlaceNames = allPlacesWithCoords.filter(p => p.city === city.name).map(p => p.name);
                if (cityPlaceNames.length > 0) {
                    smartItinerary.push({
                        day: dayIndex + 1,
                        zone: city.name,
                        places: cityPlaceNames.slice(0, 3)
                    });
                    cityPlaceNames.slice(0, 3).forEach(p => usedPlaces.add(p));
                    dayIndex++;
                }
            });
        }
        
        // Fill remaining days
        while (smartItinerary.length < days) {
            smartItinerary.push({ day: smartItinerary.length + 1, zone: 'Free Day', places: ['Explore local area', 'Try local food'] });
        }
        
        destCities.forEach(c => {
            const cityPlaces = places.filter(p => p.cityId === c._id);
            cityPlaces.forEach(p => {
                allPlaces.push({ name: p.name, city: c.name, type: p.type });
            });
        });
        
        const tripData = {
            destination: dest.name,
            place: place || "",
            city: city || "",
            state: dest.name,
            budget,
            days,
            members,
            hotel: hotelChoice || "budget",
            transport: transport || "Bus",
            totalCost: total,
            itinerary: smartItinerary.map(i => `Day ${i.day}: ${i.zone} - ${i.places.join(', ')}`),
            detailedItinerary: smartItinerary, // Store full itinerary with timing
            tripDate: tripDate || null,
            visited: false,
            createdAt: new Date()
        };

        // Save trip to user if email provided
        if (email) {
            const user = await User.findOne({ email });
            if (user) {
                user.trips.push(tripData);
                await user.save();
                console.log("💾 Trip saved to user:", user.username);
                console.log("📋 Total Cost:", total);
            }
        }

        res.json({
            success: true,
            destination: dest.name,
            totalCost: total,
            places: allPlaces,
            smartItinerary: smartItinerary,
            tripData: tripData
        });

    } catch (err) {
        console.log("❌ Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 🤖 TRAVELMATE EDGE — AI ASSISTANT
// Natural-language trip creation, constraint-aware replanning & explanations.
// The intelligence layer (aiAgent) defaults to a fully local, on-device
// rule-based engine; it can be upgraded to on-device LLMs (Ollama) or cloud
// Gemini via .env — see aiAgent.js.
app.post("/ai/assistant", async (req, res) => {
    try {
        const { message, plan } = req.body;
        if (!message || !String(message).trim()) {
            return res.json({ success: false, msg: "Please say something." });
        }

        const knownDestinations = await aiAgent.getKnownDestinations();

        // Attach live weather to the plan (if a plan is being modified) so the
        // replanner can react to the real forecast, not just the spoken words.
        if (plan && (plan.destination || (plan.tripData && plan.tripData.destination))) {
            const destForWeather = plan.destination || plan.tripData.destination;
            const daysForWeather = (plan.tripData && plan.tripData.days) || (plan.smartItinerary && plan.smartItinerary.length) || 5;
            plan.weather = await getDestinationWeather(destForWeather, daysForWeather);
        }

        // Run the TravelMate engine on the message
        const out = await aiAgent.runAssistant({ message, plan, knownDestinations });

        if (out.action === "create") {
            const req2 = out.request;
            if (!req2) {
                return res.json({ success: false, msg: out.reply, needsInput: true, action: "create" });
            }

            // Build the itinerary, honoring constraints (maxClusterKm for short drives)
            const opts = {
                name: req2.destination,
                budget: req2.budget || 0,
                days: req2.days || 1,
                members: req2.members || 1,
                hotelChoice: req2.hotel || "budget",
                transport: req2.transport || "Bus",
                maxClusterKm: req2.constraints.maxClusterKm || 25
            };
            let result = await buildTripPlan(opts);

            if (!result.found) {
                return res.json({ success: false, msg: result.msg || "Destination not found", action: "create" });
            }

            // Apply NL constraints (pace, interests, hotel, budget) to the generated plan
            result = aiAgent.applyConstraints(result, req2);

            // Save for logged-in users
            const email = getIdentity(req);
            if (email) {
                const user = await User.findOne({ email });
                if (user) {
                    user.trips.push(result.tripData);
                    await user.save();
                }
            }

            // Why these recommendations?
            const explanation = aiAgent.explain(result, req2.interests);

            // Live (or fallback local) forecast for the trip window
            const weather = await getDestinationWeather(result.destination, result.tripData.days);

            return res.json({
                success: true,
                action: "create",
                destination: result.destination,
                totalCost: result.totalCost,
                places: result.places,
                smartItinerary: result.smartItinerary,
                tripData: result.tripData,
                tags: result.tags,
                changes: result.aiChanges || [],
                weather,
                weatherNote: weather && weather.filter(w => w.rain).length
                    ? `Heads up: rain expected on ${weather.filter(w => w.rain).map(w => `Day ${w.day}`).join(", ")}. Say "it's raining on Day X — adjust" and I'll reorder to indoor spots.`
                    : (weather && weather.length ? `Weather looks good for all ${weather.length} day(s).` : ""),
                explanation,
                reply: `Here's your ${result.tripData.days}-day ${result.destination} plan.\n` +
                       `Estimated cost: ₹${Number(result.tripData.estimatedCost || result.totalCost).toLocaleString()}.\n` +
                       `\n${result.smartItinerary.map(i => `Day ${i.day} (${i.zone}): ${i.places.join(", ")}`).join("\n")}` +
                       (result.aiChanges && result.aiChanges.length ? `\n\nAdjustments:\n• ${result.aiChanges.join("\n• ")}` : "")
            });
        }

        if (out.action === "replan") {
            const modifications = out.changes || [];
            // When reacting to weather, surface the live forecast in the reply too
            const weatherLine = (out.intent && out.intent.kind === "weather" && plan && plan.weather)
                ? `\n\n📡 Live forecast: ${plan.weather.map(w => `Day ${w.day}: ${w.temp} ${w.rain ? "🌧️ " + w.description : "☀️ " + w.description}`).join(" · ")}`
                : "";
            return res.json({
                success: true,
                action: "replan",
                message: (out.message || modifications.join("\n")) + weatherLine,
                changes: modifications,
                smartItinerary: out.plan.smartItinerary,
                tripData: out.plan.tripData,
                places: out.plan.places,
                weather: plan && plan.weather ? plan.weather : [],
                explanation: aiAgent.explain(out.plan, [])
            });
        }

        // question / chat
        return res.json({ success: true, action: "question", reply: out.reply, plan: out.plan || null });

    } catch (err) {
        console.log("❌ AI Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 📋 GET USER TRIPS
app.get("/my-trips", async (req, res) => {
    try {
        const email = getIdentity(req);
        if (!email) {
            return res.json({ trips: [] });
        }
        const user = await User.findOne({ email });
        if (user) {
            res.json({ trips: user.trips });
        } else {
            res.json({ trips: [] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ MARK TRIP AS VISITED
app.post("/mark-visited", async (req, res) => {
    try {
        const email = getIdentity(req);
        const { tripId } = req.body;
        const user = await User.findOne({ email });
        if (user) {
            const trip = user.trips.id(tripId);
            if (trip) {
                trip.visited = true;
                await user.save();
                console.log("✅ Trip marked as visited:", tripId);
                res.json({ success: true });
            } else {
                res.json({ success: false, msg: "Trip not found" });
            }
        } else {
            res.json({ success: false, msg: "User not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🗑️ DELETE TRIP
app.post("/delete-trip", async (req, res) => {
    try {
        const email = getIdentity(req);
        const { tripId } = req.body;
        const user = await User.findOne({ email });
        if (user) {
            user.trips.pull(tripId);
            await user.save();
            console.log("🗑️ Trip deleted:", tripId);
            res.json({ success: true });
        } else {
            res.json({ success: false, msg: "User not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🏨 ADD HOTEL BOOKING TO TRIP
app.post("/add-hotel-booking", async (req, res) => {
    try {
        const email = getIdentity(req);
        const { tripId, hotelName, checkIn, checkOut, confirmationNo, notes } = req.body;
        const user = await User.findOne({ email });
        if (user) {
            const trip = user.trips.id(tripId);
            if (trip) {
                trip.hotelBooking = {
                    hotelName,
                    checkIn,
                    checkOut,
                    confirmationNo,
                    notes,
                    bookedAt: new Date()
                };
                await user.save();
                res.json({ success: true });
            } else {
                res.json({ success: false, msg: "Trip not found" });
            }
        } else {
            res.json({ success: false, msg: "User not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ❤️ ADD TO WISHLIST
app.post("/add-wishlist", async (req, res) => {
    try {
        const email = getIdentity(req);
        const { placeName, cityName, stateName, placeType, rating, imageUrl } = req.body;
        
        if (!email) {
            return res.json({ success: false, msg: "Please login first" });
        }
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ success: false, msg: "User not found" });
        }
        
        // Check if already in wishlist
        const exists = user.wishlist.find(w => w.placeName === placeName && w.cityName === cityName);
        if (exists) {
            return res.json({ success: false, msg: "Already in wishlist!" });
        }
        
        user.wishlist.push({
            placeName,
            cityName,
            stateName,
            placeType: placeType || "Attraction",
            rating: rating || 4.0,
            imageUrl: imageUrl || ""
        });
        
        await user.save();
        console.log("❤️ Added to wishlist:", placeName, "-", cityName);
        res.json({ success: true, msg: "Added to wishlist!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📋 GET WISHLIST
app.get("/wishlist", async (req, res) => {
    try {
        const email = getIdentity(req);
        if (!email) {
            return res.json({ wishlist: [] });
        }
        
        const user = await User.findOne({ email });
        if (user) {
            res.json({ wishlist: user.wishlist || [] });
        } else {
            res.json({ wishlist: [] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🗑️ REMOVE FROM WISHLIST
app.post("/remove-wishlist", async (req, res) => {
    try {
        const email = getIdentity(req);
        const { wishlistId } = req.body;
        
        const user = await User.findOne({ email });
        if (user) {
            user.wishlist = user.wishlist.filter(w => w._id.toString() !== wishlistId);
            await user.save();
            console.log("🗑️ Removed from wishlist:", wishlistId);
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🧪 TEST API
app.get("/test", (req, res) => {
    console.log("TEST API HIT");
    res.send("Working");
});

// 🐛 DEBUG - Check raw database data
app.get("/debug-destinations", async (req, res) => {
    try {
        const data = await State.find().lean();
        console.log("Raw DB data:", JSON.stringify(data, null, 2));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🐛 DEBUG - Check what models return
app.get("/debug-collections", async (req, res) => {
    try {
        const states = await State.find();
        const cities = await City.find();
        const places = await Place.find();
        res.json({
            states: states.slice(0, 3),
            cities: cities.slice(0, 3),
            places: places.slice(0, 3)
        });
    } catch (err) {
        res.json({ error: err.message });
    }
});


// 📝 REVIEWS API

// Get reviews for a place
app.get("/reviews/:placeName", async (req, res) => {
    try {
        const reviews = await Review.find({ placeName: req.params.placeName })
            .sort({ createdAt: -1 })
            .lean();
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a review
app.post("/reviews", async (req, res) => {
    try {
        const { placeName, cityName, userName, userEmail, rating, review } = req.body;
        
        if (!placeName || !cityName || !userName || !userEmail || !rating || !review) {
            return res.status(400).json({ error: "All fields are required" });
        }
        
        const newReview = new Review({
            placeName,
            cityName,
            userName,
            userEmail,
            rating: parseInt(rating),
            review
        });
        
        await newReview.save();
        res.json({ success: true, review: newReview });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Like a review
app.post("/reviews/like", async (req, res) => {
    try {
        const { reviewId } = req.body;
        const review = await Review.findByIdAndUpdate(
            reviewId,
            { $inc: { likes: 1 } },
            { new: true }
        );
        res.json({ success: true, likes: review.likes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get average rating for a place
app.get("/reviews/avg/:placeName", async (req, res) => {
    try {
        const result = await Review.aggregate([
            { $match: { placeName: req.params.placeName } },
            { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } }
        ]);
        
        if (result.length === 0) {
            return res.json({ avgRating: 0, count: 0 });
        }
        
        res.json({ avgRating: result[0].avgRating, count: result[0].count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🏆 POPULAR PLACES API

// Get most visited places
app.get("/popular-places", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const popular = await PopularPlace.find()
            .sort({ visits: -1 })
            .limit(limit)
            .lean();
        res.json(popular);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Track a visit to a place
app.post("/track-visit", async (req, res) => {
    try {
        const { placeName, cityName } = req.body;
        if (!placeName || !cityName) {
            return res.status(400).json({ error: "Place name and city name required" });
        }
        
        const popular = await PopularPlace.findOneAndUpdate(
            { placeName },
            { 
                $inc: { visits: 1 },
                $set: { cityName, lastVisited: new Date() }
            },
            { upsert: true, returnDocument: 'after' }
        );
        
        res.json({ success: true, visits: popular.visits });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🏆 BADGES API
const { checkAndAwardBadges, getUserBadges } = require('./models/Badge');

// Get user badges
app.get("/badges/:email", async (req, res) => {
    try {
        const badges = await getUserBadges(normalizeEmail(req.params.email));
        res.json(badges);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Award badge when visiting
app.post("/award-badge", async (req, res) => {
    try {
        const userEmail = normalizeEmail(req.body.userEmail);
        const { placeType, placeName, cityName, stateName } = req.body;
        if (!userEmail) return res.json({ badge: null });
        
        const badge = await checkAndAwardBadges(userEmail, placeType, placeName, cityName, stateName);
        res.json({ badge });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📦 PACKING LIST GENERATOR
app.get("/packing-list", (req, res) => {
    const { city, days, weather } = req.query;
    
    const essentials = ['Passport/ID', 'Phone charger', 'Power bank', 'Medicines', 'Toiletries'];
    const clothing = days > 3 
        ? ['3-4 shirts', '2 pants', 'Sleepwear', 'Underwear', 'Socks']
        : ['2 shirts', '1 pant', 'Sleepwear', 'Underwear'];
    const weatherGear = weather?.includes('rain') 
        ? ['Umbrella', 'Raincoat', 'Waterproof bag']
        : weather?.includes('cold') 
            ? ['Warm jacket', 'Gloves', 'Scarf', 'Thermal wear']
            : ['Sunglasses', 'Sunscreen', 'Hat/Cap'];
    const electronics = ['Camera', 'Headphones', 'Laptop/Tablet', 'Travel adapter'];
    const documents = ['Flight tickets', 'Hotel booking', 'Travel insurance', 'Cash/Cards'];
    
    res.json({
        essentials,
        clothing,
        weatherGear,
        electronics,
        documents,
        tips: [
            'Roll clothes to save space',
            'Use packing cubes',
            'Keep essentials in carry-on',
            'Double-check your bag before leaving'
        ]
    });
});

// 🏥 EMERGENCY INFO (Sample data)
app.get("/emergency/:city", (req, res) => {
    const city = req.params.city.toLowerCase();
    
    const emergencyData = {
        'chennai': { police: '100', ambulance: '108', hospital: '044-28592750', fire: '101' },
        'madurai': { police: '100', ambulance: '108', hospital: '0452-2341900', fire: '101' },
        'mumbai': { police: '100', ambulance: '102', hospital: '022-26580000', fire: '101' },
        'delhi': { police: '100', ambulance: '102', hospital: '011-23061469', fire: '101' },
        'bangalore': { police: '100', ambulance: '108', hospital: '080-22943150', fire: '101' },
        'paris': { police: '17', ambulance: '15', hospital: '01 40 06 80 00', fire: '18' },
        'new york': { police: '911', ambulance: '911', hospital: '212-263-5555', fire: '911' },
        'singapore': { police: '999', ambulance: '995', hospital: '64338888', fire: '995' },
        'london': { police: '999', ambulance: '999', hospital: '020 3451 2345', fire: '999' }
    };
    
    const info = emergencyData[city] || {
        police: '100',
        ambulance: '108',
        hospital: 'Check local directory',
        fire: '101'
    };
    
    res.json({
        city: city.charAt(0).toUpperCase() + city.slice(1),
        ...info,
        tips: [
            'Save emergency contacts in your phone',
            'Keep copies of important documents',
            'Know the nearest embassy if traveling abroad',
            'Download offline maps for the area'
        ]
    });
});

// 📋 VISA REQUIREMENTS (Sample data)
app.get("/visa/:country", (req, res) => {
    const country = req.params.country.toLowerCase();
    
    const visaData = {
        'usa': { visa: 'B1/B2 Tourist Visa', cost: '~$185', duration: 'Up to 10 years', processing: '3-5 weeks', indian: 'Required' },
        'france': { visa: 'Schengen Visa', cost: '€80', duration: '90 days', processing: '2-3 weeks', indian: 'Required' },
        'uk': { visa: 'Standard Visitor Visa', cost: '£100', duration: '6 months', processing: '3 weeks', indian: 'Required' },
        'singapore': { visa: 'e-Visa / On Arrival', cost: '~$30', duration: '30 days', processing: '1-2 days', indian: 'e-Visa Available' },
        'thailand': { visa: 'Visa on Arrival / e-Visa', cost: '฿1000', duration: '15-60 days', processing: 'Same day', indian: 'Visa on Arrival Available' },
        'japan': { visa: 'Tourist Visa', cost: '¥3000', duration: '15-90 days', processing: '4-5 days', indian: 'Required' },
        'uae': { visa: 'e-Visa / On Arrival', cost: '~$50', duration: '30 days', processing: '2-4 days', indian: 'e-Visa Available' },
        'australia': { visa: 'ETA (Subclass 601)', cost: 'A$20', duration: '12 months', processing: 'Instant', indian: 'ETA Available' },
        'germany': { visa: 'Schengen Visa', cost: '€80', duration: '90 days', processing: '2-3 weeks', indian: 'Required' },
        'italy': { visa: 'Schengen Visa', cost: '€80', duration: '90 days', processing: '2-3 weeks', indian: 'Required' }
    };
    
    const info = visaData[country] || {
        visa: 'Check embassy website',
        cost: 'Varies',
        duration: 'Varies',
        processing: 'Varies',
        indian: 'Check requirements'
    };
    
    res.json({
        country: country.charAt(0).toUpperCase() + country.slice(1),
        ...info,
        requirements: [
            'Valid passport (6+ months)',
            'Passport-size photos',
            'Bank statements (last 3 months)',
            'Flight itinerary',
            'Hotel booking confirmation',
            'Travel insurance'
        ]
    });
});

// 👥 CROWD PREDICTOR (Based on visit patterns)
app.get("/crowd/:placeName", async (req, res) => {
    try {
        const PopularPlace = require('./models/PopularPlace');
        const place = await PopularPlace.findOne({ placeName: req.params.placeName });
        
        let level = 'Moderate';
        let message = 'Good time to visit';
        let waitTime = '30-45 mins';
        
        if (place) {
            if (place.visits > 100) {
                level = 'Very High';
                message = 'Peak season - Expect crowds';
                waitTime = '1-2 hours';
            } else if (place.visits > 50) {
                level = 'High';
                message = 'Popular time - Some wait';
                waitTime = '45-60 mins';
            } else if (place.visits > 20) {
                level = 'Moderate';
                message = 'Good time to visit';
                waitTime = '30-45 mins';
            } else if (place.visits > 5) {
                level = 'Low';
                message = 'Quiet time - Enjoy!';
                waitTime = '15-20 mins';
            } else {
                level = 'Very Low';
                message = 'Almost empty - Perfect!';
                waitTime = '10-15 mins';
            }
        }
        
        res.json({
            place: req.params.placeName,
            visits: place?.visits || 0,
            level,
            message,
            waitTime,
            tips: [
                'Visit early morning or late evening',
                'Weekdays are less crowded',
                'Book tickets online if possible',
                'Avoid public holidays'
            ]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📝 TRAVEL STORY GENERATOR
app.post("/travel-story", (req, res) => {
    const { destination, days, places, userName } = req.body;
    
    const stories = [
        `The adventure to ${destination} began with excitement and wonder. Over ${days} unforgettable days, every moment became a cherished memory. From exploring ancient temples to savoring local delicacies, this journey was nothing short of magical. The warm hospitality of the locals and the breathtaking scenery made this trip truly extraordinary. This is a story I will tell for generations to come.`,
        
        `${destination} - a name that echoes with adventure! Our ${days}-day expedition was filled with discovery and joy. We wandered through bustling markets, found peace in serene landscapes, and created memories that will last forever. Every sunrise brought new possibilities and every sunset brought gratitude. This journey has changed us in ways we never imagined.`,
        
        `What started as a simple trip to ${destination} turned into the journey of a lifetime. ${days} days of exploration, ${places?.length || 0} places visited, and countless smiles shared. From the moment we arrived, we knew this would be special. The diversity of experiences, the beauty of nature, and the warmth of the people made this an unforgettable chapter in our travel diary.`
    ];
    
    const story = stories[Math.floor(Math.random() * stories.length)];
    const title = `My ${destination} Adventure`;
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    res.json({
        title,
        date,
        story,
        stats: {
            days,
            places: places?.length || 0,
            destination
        }
    });
});

// 🚀 START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


// ===================== ADMIN DASHBOARD APIs =====================

// Admin login
app.post("/admin/login", async (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER || "admin";
    const adminPass = process.env.ADMIN_PASS;
    if (!adminPass) {
        return res.json({ success: false, msg: "Admin password not configured. Set ADMIN_PASS in .env" });
    }
    if (username === adminUser && password === adminPass) {
        res.json({ success: true, token: issueToken(adminUser, "admin") });
    } else {
        res.json({ success: false, msg: "Invalid credentials" });
    }
});

// Get all users
app.get("/admin/users", authAdmin, async (req, res) => {
    try {
        const users = await User.find({}, "-password").lean();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all trips from all users
app.get("/admin/trips", authAdmin, async (req, res) => {
    try {
        const users = await User.find({}).lean();
        let allTrips = [];
        users.forEach(user => {
            if (user.trips && Array.isArray(user.trips)) {
                user.trips.forEach(trip => {
                    allTrips.push({ ...trip, userEmail: user.email, userName: user.username });
                });
            }
        });
        res.json(allTrips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all reviews
app.get("/admin/reviews", authAdmin, async (req, res) => {
    try {
        const reviews = await Review.find({}).sort({ createdAt: -1 }).lean();
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all places
app.get("/admin/places", authAdmin, async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const places = await db.collection("places").find({}).toArray();
        const cities = await db.collection("cities").find({}).toArray();
        
        const placesWithCity = places.map(p => {
            const city = cities.find(c => c._id === p.cityId);
            return { ...p, cityName: city?.name || "Unknown" };
        });
        
        res.json(placesWithCity);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get dashboard stats
app.get("/admin/stats", authAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const users = await User.find({}).lean();
        let totalTrips = 0;
        users.forEach(u => totalTrips += (u.trips?.length || 0));
        
        const totalReviews = await Review.countDocuments();
        const db = mongoose.connection.db;
        const totalPlaces = await db.collection("places").countDocuments();
        const totalCities = await db.collection("cities").countDocuments();
        
        res.json({
            totalUsers,
            totalTrips,
            totalReviews,
            totalPlaces,
            totalCities
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete user
app.delete("/admin/users/:email", authAdmin, async (req, res) => {
    try {
        await User.findOneAndDelete({ email: req.params.email });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete review
app.delete("/admin/reviews/:id", authAdmin, async (req, res) => {
    try {
        await Review.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new place
app.post("/admin/places", authAdmin, async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { name, type, rating, cityId } = req.body;
        await db.collection("places").insertOne({ name, type, rating, cityId, createdAt: new Date() });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete place
app.delete("/admin/places/:id", authAdmin, async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { ObjectId } = require("mongodb");
        await db.collection("places").deleteOne({ _id: new ObjectId(req.params.id) });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📷 UPLOAD PHOTO
app.post("/upload-photo", upload.single("photo"), async (req, res) => {
    try {
        if (!req.file) {
            return res.json({ success: false, msg: "No file uploaded" });
        }
        
        const photoUrl = "/uploads/" + req.file.filename;
        res.json({ success: true, url: photoUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📷 ADD PHOTO TO PLACE
app.post("/add-photo", async (req, res) => {
    try {
        const { placeName, photoUrl, userEmail } = req.body;
        
        if (!placeName || !photoUrl) {
            return res.json({ success: false, msg: "Missing info" });
        }
        
        const db = mongoose.connection.db;
        
        // Add photo to place
        await db.collection("places").updateOne(
            { name: placeName },
            { 
                $push: { 
                    photos: { 
                        url: photoUrl, 
                        uploadedBy: userEmail || "anonymous",
                        createdAt: new Date() 
                    } 
                } 
            }
        );
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📷 GET PHOTOS FOR PLACE
app.get("/place-photos/:placeName", async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const place = await db.collection("places").findOne({ name: req.params.placeName });
        
        if (place && place.photos) {
            res.json(place.photos);
        } else {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🏨 GET HOTELS FOR DESTINATION
app.get("/hotels/:destination", async (req, res) => {
    try {
        const dest = req.params.destination;
        const hotels = hotelData[dest] || { budget: [], premium: [], luxury: [] };
        
        // If no exact match, try partial match
        if (hotels.budget.length === 0) {
            const key = Object.keys(hotelData).find(k => 
                k.toLowerCase().includes(dest.toLowerCase()) || 
                dest.toLowerCase().includes(k.toLowerCase())
            );
            if (key) {
                return res.json(hotelData[key]);
            }
        }
        
        res.json(hotels);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =========================================