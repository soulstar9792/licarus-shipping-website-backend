const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/Users");
const Payment = require("../models/Payment");
const bodyParser = require("body-parser");

router.use(bodyParser.json()); // Ensure we parse JSON from BTCPayServer

/**
 * 🔹 Add Payment Manually
 * User manually records a payment (e.g., bank transfers or admin entries).
 */
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
    res.status(201).json({ message: "Payment recorded successfully", payment: newPayment });

  } catch (error) {
    console.error("Error adding payment:", error);
    res.status(500).json({ message: "Error recording payment", error });
  }
});

/**
 * 🔹 Retrieve User Payment History
 */
router.get("/payment-history/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const payments = await Payment.find({ userId }).sort({ date: -1 });

    if (!payments.length) payments = [];

    res.status(200).json({ message: "Payment history retrieved", payments });

  } catch (error) {
    console.error("Error retrieving payment history:", error);
    res.status(500).json({ message: "Error retrieving payment history", error });
  }
});

/**
 * 🔹 Webhook from BTCPayServer
 * - Automatically updates balance when a payment is confirmed.
 */
router.post("/btcpay-webhook", async (req, res) => {
  try {
    const { event, data } = req.body;

    console.log("BTCPay Webhook Event:", event, data);

    if (event === "invoice_settled") {
      const { metadata, amount, currency, id: transactionId } = data;
      const userId = metadata?.userId;
      const paymentMethod = "BTC";

      if (!userId) {
        console.warn("⚠️ No userId found in metadata.");
        return res.sendStatus(400);
      }

      const user = await User.findById(userId);
      if (!user) {
        console.warn("⚠️ User not found for this payment.");
        return res.status(404).json({ message: "User not found." });
      }

      // Save payment in database
      const newPayment = new Payment({
        userId,
        amount,
        paymentMethod,
        transactionId,
        status: "Completed",
        date: new Date(),
      });

      await newPayment.save();

      // Update user balance
      user.balance += amount;
      await user.save();

      console.log(`✅ User ${userId} balance updated by +${amount} ${currency}`);
    }

    res.sendStatus(200);

  } catch (error) {
    console.error("❌ Error handling BTCPay webhook:", error);
    res.status(500).json({ message: "Error processing payment", error });
  }
});

module.exports = router;
