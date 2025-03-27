const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/Users");
const Payment = require("../models/Payment");
const bodyParser = require("body-parser");
const BTCPayServerAPI = require("../utils/btcPayActions");
const crypto = require('crypto');

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

    const data = await BTCPayServerAPI.createInvoice(userId);
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
    console.log("User requested top up history => userId:", userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const data = await BTCPayServerAPI.retrieveInvoices();
    console.log("Retrived Invoice Count:", data.length);
    //filter out invoices that are belong to the user
    const filteredData = data.filter(invoice => invoice.metadata.userId === userId);
    // Send back the fetched data in response
    res.status(200).json(filteredData);
  } catch (error) {
    console.error("Error loading invoices:", error);
    res.status(500).json({ message: "Error loading invoices", error });
  }
});

/**
 * 🔹 Retrieve 5 Most Recent Top Ups
 */
router.get("/recent-deposits/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("User requested top up history => userId:", userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const data = await BTCPayServerAPI.retrieveInvoices();
    
    //filter out invoices that are belong to the user
    const recentDeposits = data.filter(invoice => invoice.metadata.userId === userId);
    recentDeposits.sort((a, b) => b.createdAt - a.createdAt);
    recentDeposits.splice(5);
    // Send back the fetched data in response
    res.status(200).json(recentDeposits);
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
    // Add debug logging
    console.log('Received headers:', req.headers);
    console.log('Received body:', req.body);
    
    const btcpaySignature = req.headers['btcpay-sig'];
    
    if (!btcpaySignature) {
      console.error('❌ No BTCPay signature found in headers');
      console.log('Available headers:', Object.keys(req.headers));
      return res.status(401).json({ message: 'No signature provided' });
    }

    // Remove the 'sha256=' prefix from the received signature
    const receivedSignature = btcpaySignature.replace('sha256=', '');

    // Calculate expected signature
    const webhookSecret = process.env.BTCPAY_WEBHOOK_SECRET;
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
    
    // Add debug logging
    console.log('Received signature (cleaned):', receivedSignature);
    console.log('Expected signature:', expectedSignature);

    // Verify signature
    if (receivedSignature !== expectedSignature) {
      console.error('❌ Invalid BTCPay signature');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    // If signature is valid, proceed with the rest of the webhook handling
    const { type, metadata, invoiceId } = req.body;

    console.log("BTCPay Webhook Event:", type, req.body);

    // Ensure the event type is InvoiceSettled
    if (type === "InvoiceSettled") {
      const userId = metadata?.userId;

      if (!userId) {
        console.warn("⚠️ No userId found in metadata.");
        return res.sendStatus(400);
      }

      const user = await User.findById(userId);
      if (!user) {
        console.warn("⚠️ User not found for this payment.");
        return res.status(404).json({ message: "User not found." });
      }

      // Get the invoice details from BTCPay API
      try {
        const invoiceData = await BTCPayServerAPI.getInvoice(process.env.BTCPAY_STORE_ID, invoiceId);

        // Extract relevant information
        const amount = parseFloat(invoiceData.amount); // Ensure it's a number
        const currency = invoiceData.currency;

        // Save payment in database or whatever business logic is required
        const newPayment = new Payment({
          userId,
          amount,
          paymentMethod: "BTC",
          transactionId: invoiceId, // Using invoiceId as transactionId
          status: "Completed",
          date: new Date(),
        });

        await newPayment.save();

        // Update user balance
        user.balance += amount;
        await user.save();

        console.log(`✅ User ${userId} balance updated by +${amount} ${currency}`);
      } catch (error) {
        console.error(`Failed to retrieve invoice: ${error.message}`);
        return res.status(500).json({ message: "Failed to retrieve invoice." });
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error handling BTCPay webhook:", error);
    res.status(500).json({ message: "Error processing payment", error });
  }
});


module.exports = router;