const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, required: true }, // e.g., BTC
  transactionId: { type: String, required: true, unique: true },
  status: { type: String, enum: ["Pending", "Completed", "Failed"], required: true },
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Payment", PaymentSchema);
