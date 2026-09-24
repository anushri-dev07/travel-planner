const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const tripSchema = new mongoose.Schema({
    destination: String,
    place: String,
    city: String,
    state: String,
    budget: Number,
    days: Number,
    members: Number,
    hotel: String,
    transport: String,
    totalCost: Number,
    itinerary: [String],
    tripDate: String,
    visited: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
}, { _id: true });

const wishlistSchema = new mongoose.Schema({
    placeName: String,
    cityName: String,
    stateName: String,
    placeType: String,
    rating: Number,
    imageUrl: String,
    addedAt: { type: Date, default: Date.now }
}, { _id: true });

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    verified: { type: Boolean, default: false },
    trips: [tripSchema],
    wishlist: [wishlistSchema],
    createdAt: { type: Date, default: Date.now }
});

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model("User", userSchema);
