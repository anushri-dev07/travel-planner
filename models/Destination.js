const mongoose = require("mongoose");

const placeInCitySchema = new mongoose.Schema({
    name: String,
    rating: Number,
    type: String,
    description: String
}, { _id: false });

const citySchema = new mongoose.Schema({
    name: String,
    places: [placeInCitySchema]
}, { _id: false });

const destinationSchema = new mongoose.Schema({
    country: String,
    state: String,
    name: String,
    cities: [citySchema],
    costPerDay: { type: Number, default: 3000 },
    activities: { type: [String], default: ["Sightseeing"] },
    food: { type: [String], default: ["Local Cuisine"] },
    hotels: {
        budget: { type: [String], default: ["Budget Inn"] },
        premium: { type: [String], default: ["Premium Hotel"] },
        luxury: { type: [String], default: ["Luxury Resort"] }
    }
});

module.exports = mongoose.model("Destination", destinationSchema);
