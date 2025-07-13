//jshint esversion:8

const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const Razorpay = require("razorpay");
const { ensureAuth } = require("../../middleware/auth");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");

// Initialize Razorpay instance with your test keys
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc     Render Add Balance page
// @route    GET /addBalance
// @access   Private
router.get("/", ensureAuth, (req, res) => {
  let user = req.user;
  let avatar = req.user.image;
  res.status(200).render("addBalance", {
    layout: "layouts/app",
    avatar,
    user,
    href: "/addBalance",
  });
});

// @desc     Create Razorpay order
// @route    POST /addBalance/create-order
// @access   Private
router.post("/create-order", ensureAuth, async (req, res) => {
  const amount = Number(req.body.addAmount) * 100; // Convert to paise

  const options = {
    amount,
    currency: "USD",
    receipt: `rcpt_${Date.now()}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json(order); // Send order details back to client
  } catch (err) {
    console.error("Razorpay Order Creation Failed:", err);
    res.status(500).send("Razorpay Order Creation Failed");
  }
});

// @desc     Handle payment success
// @route    POST /addBalance/payment-success
// @access   Private
router.post("/payment-success", ensureAuth, async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = req.body;
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    console.error("Payment signature verification failed");
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  const finalAmount = parseFloat(amount) + parseFloat(req.user.balance);

  try {
    // Update user balance
    await User.findOneAndUpdate(
      { _id: req.user.id },
      { balance: finalAmount },
      { new: true, runValidators: true }
    );

    // Log the transaction
    await Transaction.create({
      details: "Balance Added to Wallet",
      amount: amount,
      operation: "Deposit",
      user: req.user.id,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Failed to update balance:", err);
    res.status(500).send("Failed to save payment info");
  }
});

module.exports = router;
