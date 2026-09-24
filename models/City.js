const mongoose = require("mongoose");

const citySchema = new mongoose.Schema({
    name: String,
    stateId: String
});

module.exports = mongoose.model("City", citySchema, "cities");
