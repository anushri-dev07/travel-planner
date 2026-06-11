const mongoose = require("mongoose");

const placeSchema = new mongoose.Schema({
    name: String,
    cityId: String,
    stateId: String,
    type: String,
    rating: Number,
    description: String
});

module.exports = mongoose.model("Place", placeSchema, "places");
