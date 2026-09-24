const mongoose = require("mongoose");

// --- Geographic helpers ---
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

function clusterByDistance(places, maxDistance = 30) {
    if (places.length === 0) return [];

    let clusters = [];
    let used = new Set();

    while (used.size < places.length) {
        let cluster = [];
        let remaining = places.filter((p, i) => !used.has(i));

        if (remaining.length === 0) break;

        let startIdx = places.findIndex(p => p === remaining[0]);
        cluster.push(remaining[0]);
        used.add(startIdx);

        for (let i = 0; i < remaining.length; i++) {
            if (used.has(places.indexOf(remaining[i]))) continue;

            let nearestInCluster = cluster[0];
            let minDist = getDistance(remaining[i].lat, remaining[i].lng, nearestInCluster.lat, nearestInCluster.lng);

            for (let j = 0; j < cluster.length; j++) {
                let dist = getDistance(remaining[i].lat, remaining[i].lng, cluster[j].lat, cluster[j].lng);
                if (dist < minDist) minDist = dist;
            }

            if (minDist <= maxDistance) {
                let idx = places.indexOf(remaining[i]);
                cluster.push(remaining[i]);
                used.add(idx);
            }
        }

        if (cluster.length > 0) {
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

function classifyType(type) {
    const t = String(type || "").toLowerCase();
    if (/(beach|coast)/.test(t)) return "outdoor";
    if (/(hill|mountain|trek|peak|garden|park|waterfall|viewpoint|lake|nature|wildlife|forest)/.test(t)) return "outdoor";
    if (/(museum|temple|palace|fort|monument|heritage|church|mosque|gallery|indoor|cafe|mall)/.test(t)) return "indoor";
    if (/(shopping|market|street|bazaar)/.test(t)) return "indoor";
    return "outdoor";
}

function placesInterests(places) {
    const tags = new Set();
    places.forEach(p => {
        const t = String(p.type || "").toLowerCase();
        const n = String(p.name || "").toLowerCase();
        if (t.includes("beach") || n.includes("beach")) tags.add("beaches");
        if (/(hill|mountain|trek|peak|nature|forest|wildlife)/.test(t) || /(hill|mountain)/.test(n)) tags.add("nature");
        if (/(temple|palace|fort|museum|monument|heritage|historical)/.test(t) || /(fort|temple|palace|museum)/.test(n)) tags.add("heritage");
        if (/adventure|trek|raft|para|zip|safari/.test(t)) tags.add("adventure");
    });
    return Array.from(tags);
}

/**
 * Build a trip plan for a destination.
 * @param {Object} opts { name, budget, days, members, hotelChoice, transport, maxClusterKm }
 *   - maxClusterKm controls how tightly places are grouped (lower = shorter travel for "avoid long drives").
 * @returns Promise<Object> same shape as the old /plan response, plus `.found`
 */
async function buildTripPlan(opts = {}) {
    const name = String(opts.name || "").trim();
    let budget = Number(opts.budget) || 0;
    let days = Number(opts.days) || 1;
    if (days < 1) days = 1;
    if (days > 30) days = 30;
    const members = Math.max(1, Number(opts.members) || 1);
    const hotelChoice = opts.hotelChoice || "budget";
    const transport = opts.transport || "Bus";
    const maxClusterKm = Number(opts.maxClusterKm) > 0 ? Number(opts.maxClusterKm) : 25;

    const searchName = name.toLowerCase();
    const db = mongoose.connection.db;
    const countries = await db.collection("countries").find({}).toArray();
    const states = await db.collection("states").find({}).toArray();
    const cities = await db.collection("cities").find({}).toArray();
    const places = await db.collection("places").find({}).toArray();

    let dest = null;
    let isInternational = false;
    let cityName = null;

    dest = cities.find(c => String(c.name || "").toLowerCase() === searchName && c.countryId);
    if (dest) {
        const country = countries.find(c => c._id === dest.countryId);
        isInternational = true;
        dest = { _id: dest._id, name: dest.name, costPerDay: country?.costPerDay || 8000 };
    }

    if (!dest) {
        const indianCityIds = [...new Set(cities.filter(c => c.stateId).map(c => c.stateId))];
        const foundState = indianCityIds
            .map(id => states.find(s => s._id === id))
            .find(s => s && String(s.name || "").toLowerCase() === searchName);
        if (foundState) {
            dest = foundState;
        }
    }

    // NEW: resolve an Indian city (e.g. "Ooty") to its parent state so it flows
    // through the same itinerary builder (without countryId it's not a foreign trip).
    if (!dest) {
        const cityMatch = cities.find(c => String(c.name || "").toLowerCase() === searchName && c.stateId);
        if (cityMatch) {
            const state = states.find(s => s._id === cityMatch.stateId);
            if (state) {
                cityName = cityMatch.name;
                dest = state;
            }
        }
    }

    if (!dest) {
        return { success: false, found: false, msg: "Destination not found" };
    }

    const costPerDay = dest.costPerDay || (isInternational ? 8000 : 3000);
    const total = costPerDay * days * members;

    let allPlaces = [];
    let destCities = [];

    if (isInternational) {
        destCities = cities.filter(c => String(c.name || "").toLowerCase() === searchName);
    } else if (cityName) {
        // Focus on the named Indian city first, fall back to all state cities
        const named = cities.filter(c => String(c.name || "").toLowerCase() === String(cityName).toLowerCase());
        const allState = cities.filter(c => c.stateId === dest._id);
        destCities = named.length > 0 ? named : allState;
    } else {
        destCities = cities.filter(c => c.stateId === dest._id);
    }

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

    let allPlacesWithCoords = [];
    Object.entries(cityPlacesMap).forEach(([cityName, data]) => {
        data.places.forEach(p => {
            allPlacesWithCoords.push({ name: p.name, type: p.type, city: cityName, lat: data.lat, lng: data.lng });
        });
    });

    const proximityClusters = clusterByDistance(allPlacesWithCoords, maxClusterKm);

    // Smart itinerary builder
    let smartItinerary = [];
    const usedPlaces = new Set();
    let dayIndex = 0;
    const destClusters = proximityClusters;

    if (destClusters && destClusters.length > 0 && days <= destClusters.length * 2) {
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
        place: "",
        city: "",
        state: dest.name,
        budget,
        days,
        members,
        hotel: hotelChoice || "budget",
        transport: transport || "Bus",
        totalCost: total,
        itinerary: smartItinerary.map(i => `Day ${i.day}: ${i.zone} - ${i.places.join(', ')}`),
        detailedItinerary: smartItinerary,
        tripDate: null,
        visited: false,
        createdAt: new Date()
    };

    return {
        success: true,
        found: true,
        destination: cityName || dest.name,
        isInternational,
        totalCost: total,
        costPerDay,
        places: allPlaces,
        smartItinerary: smartItinerary,
        tripData: tripData,
        tags: placesInterests(allPlaces.slice(0, 40))
    };
}

module.exports = { buildTripPlan, clusterByDistance, getDistance, classifyType, placesInterests };