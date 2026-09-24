const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    placeName: { type: String, required: true },
    cityName: { type: String, required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, required: true, maxlength: 1000 },
    likes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', reviewSchema);
