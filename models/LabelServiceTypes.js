const mongoose = require("mongoose");

const LabelServiceTypeSchema = new mongoose.Schema({
  client_role: {
    type: String,
    required: true,
    unique: true,
  },
  courier: {
    type: String,
    required: true,
  },
  services: {
    type: Object,
    required: true,
  },
});

module.exports = mongoose.model("LabelServiceTypes", LabelServiceTypeSchema);
