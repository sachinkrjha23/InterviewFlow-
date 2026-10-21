import express from "express";
import { userLimiter } from "../middleware/userLimiter.js";
import isAuth from "../middleware/isAuth.js";
import {
  getPacks,
  createOrder,
  verifyPayment,
  razorpayWebhook,
  getPaymentHistory,
} from "../controllers/paymentController.js";

const paymentRouter = express.Router();

const orderLimiter = userLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  message: "Too many attempts, please slow down.",
});

paymentRouter.post("/webhook", razorpayWebhook);

paymentRouter.get("/packs", isAuth, getPacks);
paymentRouter.get("/history", isAuth, getPaymentHistory);
paymentRouter.post("/order", isAuth, orderLimiter, createOrder);
paymentRouter.post("/verify", isAuth, verifyPayment);

export default paymentRouter;