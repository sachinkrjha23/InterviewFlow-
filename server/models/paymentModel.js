import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    packId: { type: String, required: true },
    credits: { type: Number, required: true },
    amount: { type: Number, required: true }, // in paise
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: String,
    status: { type: String, enum: ["created", "paid"], default: "created" },
  },
  { timestamps: true },
);

paymentSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 2,
    partialFilterExpression: { status: "created" },
  },
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;