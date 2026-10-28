import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { userLimiter } from "../middleware/userLimiter.js";

// a tiny app: the "login" is just an x-user header, everything comes from the same IP
const makeApp = (limiterOptions, handler = (req, res) => res.json({ ok: true })) => {
  const app = express();
  app.use((req, res, next) => {
    req.userId = req.get("x-user");
    next();
  });
  app.get("/limited", userLimiter({ windowMs: 60_000, ...limiterOptions }), handler);
  return app;
};

const hit = (app, user) => request(app).get("/limited").set("x-user", user);

describe("userLimiter", () => {
  it("answers 429 with the custom message once the limit is used", async () => {
    const app = makeApp({ limit: 2, message: "Slow down please." });

    expect((await hit(app, "u1")).status).toBe(200);
    expect((await hit(app, "u1")).status).toBe(200);
    const third = await hit(app, "u1");

    expect(third.status).toBe(429);
    expect(third.body).toEqual({ message: "Slow down please." });
  });

  it("counts per user, not per IP", async () => {
    const app = makeApp({ limit: 1, message: "Slow down." });

    expect((await hit(app, "alice")).status).toBe(200);
    expect((await hit(app, "alice")).status).toBe(429);
    // same IP, different user: has their own allowance
    expect((await hit(app, "bob")).status).toBe(200);
  });

  it("sends the standard RateLimit headers", async () => {
    const app = makeApp({ limit: 5, message: "x" });
    const res = await hit(app, "u1");
    expect(res.headers["ratelimit"] || res.headers["ratelimit-limit"]).toBeDefined();
    expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
  });

  it("can leave rejected requests (400/429) out of the count", async () => {
    const app = makeApp(
      {
        limit: 2,
        message: "Daily limit.",
        skipFailedRequests: true,
        requestWasSuccessful: (req, res) => ![400, 429].includes(res.statusCode),
      },
      (req, res) => (req.get("x-bad") ? res.status(400).json({ message: "bad input" }) : res.json({ ok: true })),
    );

    // five bad requests do not use up the allowance
    for (let i = 0; i < 5; i++) {
      const bad = await hit(app, "u1").set("x-bad", "1");
      expect(bad.status).toBe(400);
    }
    expect((await hit(app, "u1")).status).toBe(200);
    expect((await hit(app, "u1")).status).toBe(200);
    expect((await hit(app, "u1")).status).toBe(429);
  });
});