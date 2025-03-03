const mongoose = require("mongoose");

const bulkOrderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  courier: {
    type: String,
    required: true,
  },
  bulkOrderData: {
    type: Object,
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("BulkOrder", bulkOrderSchema);
