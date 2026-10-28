import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("sign-in rate limit", () => {
  it("limits POST /api/auth/google per IP (60 per 15 minutes)", async () => {
    // an empty body fails fast with 400 and never calls Firebase
    for (let i = 0; i < 60; i++) {
      const res = await request(app).post("/api/auth/google").send({});
      expect(res.status).toBe(400);
    }

    const blocked = await request(app).post("/api/auth/google").send({});
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many sign-in attempts/i);
  });
});

describe("health", () => {
  it("GET /health is ok and needs no login", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /ready answers 503 while the database is not connected", async () => {
    const res = await request(app).get("/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "unavailable" });
  });
});