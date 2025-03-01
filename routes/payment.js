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
router.get("/top-up/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("User requested top up => userId:", userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const apiEndpoint = `/api/v1/stores/${process.env.BTCPAY_STORE_ID}/invoices`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'token ' + process.env.BTCPAY_API_KEY
    };
    const payload = {}; // Define your payload here

    // Use fetch with await to get the response
    const response = await fetch(process.env.BTCPAY_SERVER_URL + apiEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      // If the response is not OK, throw an error
      const errorData = await response.json();
      console.error("Error from BTCPay API:", errorData);
      return res.status(response.status).json({ message: "Error from BTCPay API", error: errorData });
    }

    const data = await response.json(); // Process the fetched data
    // Send back the fetched data in response
    res.status(200).json(data);
  } catch (error) {
    console.error("Error adding payment:", error);
    res.status(500).json({ message: "Error recording payment", error });
  }
});

/**
 * 🔹 Retrieve User Payment History
 */
router.get("/top-up-history/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("User requested top up => userId:", userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const apiEndpoint = `/api/v1/stores/${process.env.BTCPAY_STORE_ID}/invoices`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'token ' + process.env.BTCPAY_API_KEY
    };
    const payload = {}; // Define your payload here

    // Use fetch with await to get the response
    const response = await fetch(process.env.BTCPAY_SERVER_URL + apiEndpoint+"?take=20", {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      // If the response is not OK, throw an error
      const errorData = await response.json();
      console.error("Error from BTCPay API:", errorData);
      return res.status(response.status).json({ message: "Error from BTCPay API", error: errorData });
    }

    const data = await response.json(); // Process the fetched data
    // Send back the fetched data in response
    res.status(200).json(data);
  } catch (error) {
    console.error("Error loading invoices:", error);
    res.status(500).json({ message: "Error loading invoices", error });
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
