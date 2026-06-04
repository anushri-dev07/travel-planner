const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const bcrypt = require("bcryptjs");

require("dotenv").config();

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

// Connect MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://AnuShriJ:anu2007@travelplannercluster.niroqe2.mongodb.net/travelPlanner?retryWrites=true&w=majority&serverSelectionTimeoutMS=30000&connectTimeoutMS=30000")
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log("MongoDB Error:", err.message));

// Helper to wait for DB
const waitForDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    await new Promise(resolve => mongoose.connection.once('open', resolve));
};


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
                
                data.push({
                    _id: state._id,
                    name: state.name,
                    type: "state",
                    cities: stateCities,
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
        const { username, email, password } = req.body;

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

        // Check if user already exists
        const existing = await User.findOne({ $or: [{ username }, { email }] });
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
        res.json({ success: true, needsVerification: true, msg: "Registration successful! Check your email for the verification code." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verify email code
app.post("/verify-email", async (req, res) => {
    try {
        const { email, code } = req.body;
        const { verifyCode } = require('./emailService');
        
        if (verifyCode(email, code)) {
            await User.findOneAndUpdate({ email }, { verified: true });
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
        const { email, username } = req.body;
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
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ success: false, msg: "Invalid email or password" });
        }

        const isHashed = user.password.startsWith('$2');
        let isMatch;
        if (isHashed) {
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            isMatch = password === user.password;
            if (isMatch) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(password, salt);
                await user.save();
            }
        }

        if (!isMatch) {
            return res.json({ success: false, msg: "Invalid email or password" });
        }

        console.log("🔐 User logged in:", user.username, "| Email:", user.email);
        res.json({ 
            success: true, 
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

// 📋 GET USER TRIPS
app.get("/my-trips", async (req, res) => {
    try {
        const email = req.query.email;
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
        const { email, tripId } = req.body;
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
        const { email, tripId } = req.body;
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
        const { email, tripId, hotelName, checkIn, checkOut, confirmationNo, notes } = req.body;
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
        const { email, placeName, cityName, stateName, placeType, rating, imageUrl } = req.body;
        
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
        const email = req.query.email;
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
        const { email, wishlistId } = req.body;
        
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
        const badges = await getUserBadges(req.params.email);
        res.json(badges);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Award badge when visiting
app.post("/award-badge", async (req, res) => {
    try {
        const { userEmail, placeType, placeName, cityName, stateName } = req.body;
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
    if (username === "admin" && password === "admin123") {
        res.json({ success: true, token: "admin-token-123" });
    } else {
        res.json({ success: false, msg: "Invalid credentials" });
    }
});

// Get all users
app.get("/admin/users", async (req, res) => {
    try {
        const users = await User.find({}, "-password").lean();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all trips from all users
app.get("/admin/trips", async (req, res) => {
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
app.get("/admin/reviews", async (req, res) => {
    try {
        const reviews = await Review.find({}).sort({ createdAt: -1 }).lean();
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all places
app.get("/admin/places", async (req, res) => {
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
app.get("/admin/stats", async (req, res) => {
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
app.delete("/admin/users/:email", async (req, res) => {
    try {
        await User.findOneAndDelete({ email: req.params.email });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete review
app.delete("/admin/reviews/:id", async (req, res) => {
    try {
        await Review.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new place
app.post("/admin/places", async (req, res) => {
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
app.delete("/admin/places/:id", async (req, res) => {
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