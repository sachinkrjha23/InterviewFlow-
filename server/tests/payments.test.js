import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import request from "supertest";

const { createOrderMock } = vi.hoisted(() => ({ createOrderMock: vi.fn() }));
vi.mock("../config/razorpay.js", () => ({
  getRazorpay: () => ({ orders: { create: createOrderMock } }),
}));

import app from "../app.js";
import User from "../models/users.js";
import Payment from "../models/paymentModel.js";
import { startDb, stopDb, clearDb } from "./helpers/db.js";
import { makeUser, authCookie } from "./helpers/auth.js";

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const hmac = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");
const signCheckout = (orderId, paymentId) => hmac(KEY_SECRET, `${orderId}|${paymentId}`);

const seedOrder = (user, overrides = {}) =>
  Payment.create({
    userId: user._id,
    packId: "popular",
    credits: 250,
    amount: 19900,
    razorpayOrderId: "order_1",
    ...overrides,
  });

const webhookBody = (entity = {}, event = "payment.captured") =>
  JSON.stringify({
    event,
    payload: {
      payment: {
        entity: { id: "pay_1", order_id: "order_1", status: "captured", amount: 19900, ...entity },
      },
    },
  });

const sendWebhook = (raw, signature = hmac(WEBHOOK_SECRET, raw)) =>
  request(app)
    .post("/api/payment/webhook")
    .set("Content-Type", "application/json")
    .set("x-razorpay-signature", signature)
    .send(raw);

const verify = (cookie, overrides = {}) =>
  request(app)
    .post("/api/payment/verify")
    .set("Cookie", cookie)
    .send({
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: signCheckout("order_1", "pay_1"),
      ...overrides,
    });

const creditsOf = async (user) => (await User.findById(user._id)).credits;

beforeAll(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await startDb();
});
afterAll(stopDb);
afterEach(async () => {
  createOrderMock.mockReset();
  await clearDb();
});

describe("packs and order creation", () => {
  it("lists the three packs", async () => {
    const user = await makeUser();
    const res = await request(app).get("/api/payment/packs").set("Cookie", await authCookie(user));

    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.id)).toEqual(["starter", "popular", "pro"]);
  });

  it("creates an order and stores a 'created' payment; the amount is decided by the server", async () => {
    createOrderMock.mockResolvedValue({ id: "order_new", amount: 19900, currency: "INR" });
    const user = await makeUser();

    const res = await request(app)
      .post("/api/payment/order")
      .set("Cookie", await authCookie(user))
      .send({ packId: "popular", amount: 1 }); // a client-sent amount must be ignored

    expect(res.status).toBe(200);
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 19900, currency: "INR" }),
    );
    const saved = await Payment.findOne({ razorpayOrderId: "order_new" });
    expect(saved).toMatchObject({ credits: 250, amount: 19900, status: "created" });
    expect(String(saved.userId)).toBe(String(user._id));
  });

  it("rejects an unknown pack without calling Razorpay", async () => {
    const user = await makeUser();
    const res = await request(app)
      .post("/api/payment/order")
      .set("Cookie", await authCookie(user))
      .send({ packId: "free-credits" });

    expect(res.status).toBe(400);
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("returns 500 and stores nothing when the Razorpay SDK fails", async () => {
    createOrderMock.mockRejectedValue(new Error("razorpay down"));
    const user = await makeUser();

    const res = await request(app)
      .post("/api/payment/order")
      .set("Cookie", await authCookie(user))
      .send({ packId: "starter" });

    expect(res.status).toBe(500);
    expect(await Payment.countDocuments()).toBe(0);
  });
});

describe("browser verify", () => {
  it("credits the pack once with a good signature", async () => {
    const user = await makeUser({ credits: 150 });
    await seedOrder(user);

    const res = await verify(await authCookie(user));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ credits: 400, added: 250 });
    expect(await creditsOf(user)).toBe(400);
    expect((await Payment.findOne({ razorpayOrderId: "order_1" })).status).toBe("paid");
  });

  it("rejects a bad signature and credits nothing", async () => {
    const user = await makeUser({ credits: 150 });
    await seedOrder(user);

    const res = await verify(await authCookie(user), { razorpay_signature: "0".repeat(64) });

    expect(res.status).toBe(400);
    expect(await creditsOf(user)).toBe(150);
    expect((await Payment.findOne({ razorpayOrderId: "order_1" })).status).toBe("created");
  });

  it("rejects missing fields", async () => {
    const user = await makeUser();
    const res = await verify(await authCookie(user), { razorpay_payment_id: "" });
    expect(res.status).toBe(400);
  });

  it("verifying the same payment twice credits only once", async () => {
    const user = await makeUser({ credits: 150 });
    await seedOrder(user);
    const cookie = await authCookie(user);

    await verify(cookie);
    const second = await verify(cookie);

    expect(second.status).toBe(200);
    expect(second.body.credits).toBe(400);
    expect(await creditsOf(user)).toBe(400);
  });

  it("another user cannot claim someone else's order", async () => {
    const owner = await makeUser({ credits: 150 });
    const other = await makeUser({ credits: 150 });
    await seedOrder(owner);

    const res = await verify(await authCookie(other));

    expect(res.status).toBe(404);
    expect(await creditsOf(owner)).toBe(150);
    expect(await creditsOf(other)).toBe(150);
  });
});

describe("Razorpay webhook", () => {
  it("credits once with a good signature (no login, no Origin needed)", async () => {
    const user = await makeUser({ credits: 150 });
    await seedOrder(user);

    const res = await sendWebhook(webhookBody()).set("Origin", "http://evil.example");

    expect(res.status).toBe(200);
    expect(await creditsOf(user)).toBe(400);
  });

  it("rejects a bad signature with 400 and credits nothing", async () => {
    const user = await makeUser({ credits: 150 });
    await seedOrder(user);

    const res = await sendWebhook(webhookBody(), "f".repeat(64));

    expect(res.status).toBe(400);
    expect(await creditsOf(user)).toBe(150);
  });

  it("rejects a request with no signature header", async () => {
    const user = await makeUser({ credits: 150 });
    await seedOrder(user);

    const res = await request(app)
      .post("/api/payment/webhook")
      .set("Content-Type", "application/json")
      .send(webhookBody());

    expect(res.status).toBe(400);
    expect(await creditsOf(user)).toBe(150);
  });

  it("a repeated webhook does not double-credit", async () => {
    const user = await makeUser({ credits: 150 });
    await seedOrder(user);
    const raw = webhookBody();

    const first = await sendWebhook(raw);
    const second = await sendWebhook(raw);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await creditsOf(user)).toBe(400);
  });

  it("the signature is checked against the raw body, not re-serialized JSON", async () => {
    const user = await makeUser({ credits: 150 });
    await seedOrder(user);
    const pretty = JSON.stringify(JSON.parse(webhookBody()), null, 2);
    const compact = webhookBody();

    // signed over the exact pretty bytes that are sent: accepted
    const good = await sendWebhook(pretty);
    expect(good.status).toBe(200);
    expect(await creditsOf(user)).toBe(400);

    // signed over different bytes than the ones sent: rejected
    const bad = await sendWebhook(pretty, hmac(WEBHOOK_SECRET, compact));
    expect(bad.status).toBe(400);
  });

  it("ignores an amount mismatch, an uncaptured payment and unknown events", async () => {
    const user = await makeUser({ credits: 150 });
    await seedOrder(user);

    const wrongAmount = await sendWebhook(webhookBody({ amount: 100 }));
    const notCaptured = await sendWebhook(webhookBody({ status: "authorized" }));
    const otherEvent = await sendWebhook(webhookBody({}, "refund.created"));
    const unknownOrder = await sendWebhook(webhookBody({ order_id: "order_nope" }));

    for (const r of [wrongAmount, notCaptured, otherEvent, unknownOrder]) {
      expect(r.status).toBe(200);
    }
    expect(await creditsOf(user)).toBe(150);
    expect((await Payment.findOne({ razorpayOrderId: "order_1" })).status).toBe("created");
  });
});

describe("browser verify and webhook together (idempotency)", () => {
  it("webhook first, then verify: credited once", async () => {
    const user = await makeUser({ credits: 150 });
    await seedOrder(user);

    await sendWebhook(webhookBody());
    const res = await verify(await authCookie(user));

    expect(res.status).toBe(200);
    expect(await creditsOf(user)).toBe(400);
  });

  it("verify and webhook at the same moment: credited once", async () => {
    const user = await makeUser({ credits: 150 });
    await seedOrder(user);
    const cookie = await authCookie(user);

    const [a, b] = await Promise.all([verify(cookie), sendWebhook(webhookBody())]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await creditsOf(user)).toBe(400);
  });
});