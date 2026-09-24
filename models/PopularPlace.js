const mongoose = require('mongoose');

const popularPlaceSchema = new mongoose.Schema({
    placeName: { type: String, required: true, unique: true },
    cityName: { type: String, required: true },
    visits: { type: Number, default: 0 },
    lastVisited: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PopularPlace', popularPlaceSchema);
