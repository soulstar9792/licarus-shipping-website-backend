const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/Users");
const Payment = require("../models/Payment.js"); // Ensure you have this model

// Add payment history
router.post("/add-payment/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, paymentMethod, transactionId, status } = req.body;

    if (!amount || !paymentMethod || !transactionId || !status) {
      return res.status(400).json({ message: "Missing required payment details." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const newPayment = new Payment({
      userId,
      amount,
      paymentMethod,
      transactionId,
      status,
      date: new Date(),
    });

    await newPayment.save();

    res.status(201).json({
      message: "Payment recorded successfully",
      payment: newPayment,
    });
  } catch (error) {
    console.error("Error adding payment:", error);
    res.status(500).json({ message: "Error recording payment", error });
  }
});

// Get payment history for a user
router.get("/payment-history/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const payments = await Payment.find({ userId }).sort({ date: -1 });
    if (!payments.length) {
      return res.status(404).json({ message: "No payment history found." });
    }
    res.status(200).json({ message: "Payment history retrieved", payments });
  } catch (error) {
    console.error("Error retrieving payment history:", error);
    res.status(500).json({ message: "Error retrieving payment history", error });
  }
});

module.exports = router;
