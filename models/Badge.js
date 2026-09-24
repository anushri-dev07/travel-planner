const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
    userEmail: { type: String, required: true },
    badgeName: { type: String, required: true },
    badgeIcon: { type: String, required: true },
    badgeType: { type: String, required: true },
    earnedAt: { type: Date, default: Date.now },
    placeName: { type: String },
    cityName: { type: String }
});

badgeSchema.statics.checkAndAwardBadges = async function(userEmail, placeType, placeName, cityName, stateName) {
    return null;
};

badgeSchema.statics.getUserBadges = async function(email) {
    return await this.find({ userEmail: email }).sort({ earnedAt: -1 });
};

module.exports = mongoose.model('Badge', badgeSchema);
