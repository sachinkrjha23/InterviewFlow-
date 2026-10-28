import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";

// CLIENT_URL is set to this in tests/setup.js
const GOOD = "http://localhost:5173";
const EVIL = "http://evil.example";

// logout needs no login and no database, so it is a clean way to test the Origin check
const logout = () => request(app).post("/api/auth/logout").send({});

describe("Origin check (blocks other websites from making changes)", () => {
  it("blocks a POST that comes from another website", async () => {
    const res = await logout().set("Origin", EVIL);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Request blocked." });
  });

  it("allows a POST from the real client", async () => {
    const res = await logout().set("Origin", GOOD);
    expect(res.status).toBe(200);
  });

  it.each([
    ["a different port", "http://localhost:5174"],
    ["a look-alike host", "http://localhost:5173.evil.example"],
    ["the string null", "null"],
    ["something that is not a URL", "not a url"],
  ])("blocks %s", async (_name, origin) => {
    const res = await logout().set("Origin", origin);
    expect(res.status).toBe(403);
  });

  it("uses the Referer when there is no Origin header", async () => {
    expect((await logout().set("Referer", `${EVIL}/page`)).status).toBe(403);
    expect((await logout().set("Referer", `${GOOD}/interview`)).status).toBe(200);
  });

  it("lets requests with neither header through (not a browser, so no cookie to abuse)", async () => {
    const res = await logout();
    expect(res.status).toBe(200);
  });

  it("does not check safe methods such as GET", async () => {
    const res = await request(app).get("/health").set("Origin", EVIL);
    expect(res.status).toBe(200);
  });

  it("exempts the Razorpay webhook (its signature protects it instead)", async () => {
    const res = await request(app)
      .post("/api/payment/webhook")
      .set("Origin", EVIL)
      .set("Content-Type", "application/json")
      .send("{}");

    expect(res.status).toBe(400); // rejected for the missing signature, not for the Origin
    expect(res.body.message).toMatch(/invalid webhook request/i);
  });
});

describe("basic HTTP behaviour", () => {
  it("answers unknown routes with a JSON 404", async () => {
    const get = await request(app).get("/api/nothing-here");
    const post = await request(app).post("/api/nothing-here").send({});

    expect(get.status).toBe(404);
    expect(get.body).toEqual({ message: "Route not found." });
    expect(post.status).toBe(404);
  });

  it("GET / and GET /health answer without a login", async () => {
    expect((await request(app).get("/")).body).toEqual({ message: "Server is running" });
    expect((await request(app).get("/health")).body).toEqual({ status: "ok" });
  });

  it("answers broken JSON with a clean 400", async () => {
    const res = await request(app)
      .post("/api/auth/google")
      .set("Content-Type", "application/json")
      .send("{ this is not json");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Invalid JSON body." });
  });

  it("answers a body over 100kb with 413", async () => {
    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "a".repeat(200_000) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: "Request body too large." });
  });

  it("treats a non-JSON body as empty, so handlers answer 400 instead of crashing", async () => {
    const res = await request(app)
      .post("/api/auth/google")
      .set("Content-Type", "text/plain")
      .send("hello");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/idtoken required/i);
  });
});

describe("headers", () => {
  it("names only the real client origin, with credentials", async () => {
    const good = await request(app).get("/health").set("Origin", GOOD);
    expect(good.headers["access-control-allow-origin"]).toBe(GOOD);
    expect(good.headers["access-control-allow-credentials"]).toBe("true");

    // the header always names the real client, so a browser on any other site is refused
    const evil = await request(app).get("/health").set("Origin", EVIL);
    expect(evil.headers["access-control-allow-origin"]).toBe(GOOD);
    expect(evil.headers["access-control-allow-origin"]).not.toBe(EVIL);
  });

  it("answers a browser preflight request from the real client", async () => {
    const res = await request(app)
      .options("/api/interview/finish")
      .set("Origin", GOOD)
      .set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(GOOD);
  });

  it("sends security headers and hides that it is Express", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("gives every response a request id, and keeps a valid one the caller sent", async () => {
    const own = await request(app).get("/health");
    expect(own.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);

    const sent = await request(app).get("/health").set("X-Request-Id", "my-request-1234");
    expect(sent.headers["x-request-id"]).toBe("my-request-1234");

    const junk = await request(app).get("/health").set("X-Request-Id", "x");
    expect(junk.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});