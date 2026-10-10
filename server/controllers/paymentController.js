import crypto from "crypto";
import User from "../models/users.js";
import Payment from "../models/paymentModel.js";
import { getRazorpay } from "../config/razorpay.js";
import { CREDIT_PACKS } from "../config/creditPacks.js";

const safeEqual = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Claims an order atomically, then adds the credits. Safe to call twice for the same order.
const fulfillOrder = async ({ orderId, paymentId, userId, source }) => {
  const filter = { razorpayOrderId: orderId, status: "created" };
  if (userId) filter.userId = userId;

  const payment = await Payment.findOneAndUpdate(
    filter,
    { $set: { status: "paid", razorpayPaymentId: paymentId } },
    { returnDocument: "after" },
  );
  if (!payment) {
    console.log(
      `[payments] ${source}: order ${orderId} already fulfilled (or unknown), nothing to add`,
    );
    return null; // already fulfilled, or unknown order
  }

  try {
    await User.updateOne(
      { _id: payment.userId },
      { $inc: { credits: payment.credits } },
    );
    console.log(
      `[payments] ${source}: +${payment.credits} credits to user ${payment.userId} (order ${orderId}, payment ${paymentId})`,
    );
    return payment;
  } catch (error) {
    // crediting failed: reopen the order so it can be retried
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { status: "created" }, $unset: { razorpayPaymentId: "" } },
    );
    throw error;
  }
};

export const getPacks = (req, res) => {
  return res.status(200).json(CREDIT_PACKS);
};

export const createOrder = async (req, res) => {
  try {
    const pack = CREDIT_PACKS.find((p) => p.id === req.body.packId);
    if (!pack) return res.status(400).json({ message: "Invalid credit pack." });

    const amount = pack.price * 100; // paise, always decided here on the server

    const order = await getRazorpay().orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${Date.now()}_${String(req.userId).slice(-6)}`,
      notes: { userId: String(req.userId), packId: pack.id },
    });

    await Payment.create({
      userId: req.userId,
      packId: pack.id,
      credits: pack.credits,
      amount,
      razorpayOrderId: order.id,
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      packName: pack.name,
      credits: pack.credits,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Could not start the payment. Please try again." });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (
      [razorpay_order_id, razorpay_payment_id, razorpay_signature].some(
        (v) => typeof v !== "string" || !v,
      )
    ) {
      return res.status(400).json({ message: "Missing payment details." });
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!safeEqual(expected, razorpay_signature)) {
      return res.status(400).json({ message: "Payment verification failed." });
    }

    const claimed = await fulfillOrder({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      userId: req.userId,
      source: "browser verify",
    });

    // If the webhook got there first, the order is already paid: report it the same way
    const payment =
      claimed ||
      (await Payment.findOne({
        razorpayOrderId: razorpay_order_id,
        userId: req.userId,
      }));
    if (!payment) return res.status(404).json({ message: "Order not found." });

    const user = await User.findById(req.userId);
    const done =
      payment.status === "paid" &&
      payment.razorpayPaymentId === razorpay_payment_id;

    return res
      .status(200)
      .json(
        done
          ? { credits: user.credits, added: payment.credits }
          : { credits: user.credits },
      );
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Couldn't confirm the payment. Please try again." });
  }
};

export const razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!secret || typeof signature !== "string" || !req.rawBody) {
      console.warn("[webhook] rejected: missing secret, signature header or body");
      return res.status(400).json({ message: "Invalid webhook request." });
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(req.rawBody)
      .digest("hex");

    if (!safeEqual(expected, signature)) {
      console.warn(
        "[webhook] rejected: signature mismatch (does RAZORPAY_WEBHOOK_SECRET match the dashboard?)",
      );
      return res.status(400).json({ message: "Invalid signature." });
    }

    const { event, payload } = req.body;
    console.log(`[webhook] received "${event}"`);

    if (event === "payment.captured" || event === "order.paid") {
      const entity = payload?.payment?.entity;
      const orderId = entity?.order_id;
      const paymentId = entity?.id;

      if (orderId && paymentId && entity.status === "captured") {
        const record = await Payment.findOne({ razorpayOrderId: orderId });

        // sanity check: the paid amount must match what we created the order for
        if (record && record.amount === entity.amount) {
          await fulfillOrder({ orderId, paymentId, source: "webhook" });
        } else {
          console.warn(
            `[webhook] ignored: unknown order or amount mismatch (order ${orderId})`,
          );
        }
      } else {
        console.log(`[webhook] "${event}" skipped: payment not captured or details missing`);
      }
    } else {
      console.log(`[webhook] ignoring event "${event}"`);
    }

    // 200 tells Razorpay we got it (including duplicates); 500 below makes it retry
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[webhook] error:", error);
    return res.status(500).json({ message: "Webhook handling failed." });
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.userId, status: "paid" })
      .select("packId credits amount razorpayPaymentId updatedAt")
      .sort({ updatedAt: -1 })
      .limit(20);

    return res.status(200).json(
      payments.map((p) => ({
        _id: p._id,
        packName: CREDIT_PACKS.find((c) => c.id === p.packId)?.name || p.packId,
        credits: p.credits,
        amount: p.amount, // paise
        paymentId: p.razorpayPaymentId,
        paidAt: p.updatedAt,
      })),
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Couldn't load payment history." });
  }
};
