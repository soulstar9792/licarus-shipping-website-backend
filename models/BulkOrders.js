const mongoose = require("mongoose");

const bulkOrderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  bulkOrderData: {
    type: Object,
    required: true,
  },
  pdfName: {
    type: String,
    required: false,
  },
  autoConfirmCSVName: {
    type: String,
    required: false,
  },
  resultCSVName: {
    type: String,
    required: false,
  },
  processedCount: {
    type: Number,
    required: true,
    default: 0
  },
  totalCount: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("BulkOrder", bulkOrderSchema);
