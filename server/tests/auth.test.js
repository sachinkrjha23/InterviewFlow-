import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("../config/firebaseAdmin.js", () => ({ getAdminAuth: () => ({ verifyIdToken }) }));

import app from "../app.js";
import User from "../models/users.js";
import { DEMO_EMAIL } from "../config/demo.js";
import { startDb, stopDb, clearDb } from "./helpers/db.js";
import { makeUser, authCookie } from "./helpers/auth.js";

const SECRET = process.env.JWT_SECRET;

const currentUser = (cookie) => {
  const req = request(app).get("/api/user/currentUser");
  return cookie ? req.set("Cookie", cookie) : req;
};

const tokenFor = (userId, options = {}, secret = SECRET) =>
  jwt.sign({ userId: String(userId) }, secret, { expiresIn: "1h", ...options });

const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

const googleLogin = (body = { idToken: "fake-token" }) => request(app).post("/api/auth/google").send(body);
const demoLogin = () => request(app).post("/api/auth/demo").send({});

// the "token=..." part of the Set-Cookie header, ready to send back as a Cookie header
const sessionCookie = (res) => (res.headers["set-cookie"] || []).find((c) => c.startsWith("token="));
const cookieHeader = (res) => sessionCookie(res).split(";")[0];

const googleUser = (overrides = {}) => ({
  uid: "uid-1",
  email: "Asha@Example.com",
  email_verified: true,
  name: "Asha Verma",
  picture: "https://img.example/asha.png",
  ...overrides,
});

beforeAll(startDb);
afterAll(stopDb);
afterEach(async () => {
  await clearDb();
  verifyIdToken.mockReset();
  delete process.env.DEMO_MODE;
  delete process.env.COOKIE_SAMESITE;
});

describe("login cookie (isAuth)", () => {
  it("returns 401 with an AUTH_REQUIRED code when there is no cookie", async () => {
    const res = await currentUser();
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("returns 401 for a forged cookie", async () => {
    const res = await currentUser("token=not-a-real-token");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTH_REQUIRED");
  });

  it("returns 401 for a token signed with a different secret", async () => {
    const user = await makeUser();
    const res = await currentUser(`token=${tokenFor(user._id, {}, "some-other-secret")}`);
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    const user = await makeUser();
    const res = await currentUser(`token=${tokenFor(user._id, { expiresIn: -10 })}`);
    expect(res.status).toBe(401);
  });

  it("rejects a token signed with a different algorithm, even with the right secret", async () => {
    const user = await makeUser();
    const res = await currentUser(`token=${tokenFor(user._id, { algorithm: "HS384" })}`);
    expect(res.status).toBe(401);
  });

  it("rejects an unsigned token (alg none)", async () => {
    const user = await makeUser();
    const unsigned = `${base64url({ alg: "none", typ: "JWT" })}.${base64url({ userId: String(user._id) })}.`;
    const res = await currentUser(`token=${unsigned}`);
    expect(res.status).toBe(401);
  });

  it("accepts a real token and returns the profile without internal fields", async () => {
    const user = await makeUser({ credits: 80 });
    const res = await currentUser(await authCookie(user));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: user.email, credits: 80 });
    expect(res.body).not.toHaveProperty("googleUid");
    expect(res.body).not.toHaveProperty("avatarPublicId");
  });

  it("answers 404 (not a crash) for a valid token whose user no longer exists", async () => {
    const user = await makeUser();
    const cookie = await authCookie(user);
    await User.deleteOne({ _id: user._id });

    const res = await currentUser(cookie);

    expect(res.status).toBe(404);
  });
});

describe("Google sign-in", () => {
  it("returns 400 when no idToken is sent, without asking Firebase", async () => {
    const res = await googleLogin({});
    expect(res.status).toBe(400);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("returns 401 and sets no cookie when the token is invalid", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad token"));

    const res = await googleLogin();

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid google sign-in token/i);
    expect(sessionCookie(res)).toBeUndefined();
    expect(await User.countDocuments()).toBe(0);
  });

  it.each([
    ["unverified", googleUser({ email_verified: false })],
    ["missing", googleUser({ email: undefined })],
  ])("returns 401 when the Google email is %s", async (_name, decoded) => {
    verifyIdToken.mockResolvedValue(decoded);

    const res = await googleLogin();

    expect(res.status).toBe(401);
    expect(await User.countDocuments()).toBe(0);
  });

  it("creates a new user with 150 credits and sets a login cookie", async () => {
    verifyIdToken.mockResolvedValue(googleUser());

    const res = await googleLogin();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Asha Verma",
      email: "asha@example.com", // lowercased
      credits: 150,
      photo: "https://img.example/asha.png",
    });
    expect(res.body).not.toHaveProperty("googleUid");
    expect(await User.countDocuments()).toBe(1);

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Max-Age=2592000/); // 30 days
    const token = cookie.split(";")[0].replace("token=", "");
    expect(jwt.verify(token, SECRET).userId).toBe(res.body._id);
  });

  it("logs the same person in again without creating a duplicate or touching their credits", async () => {
    verifyIdToken.mockResolvedValue(googleUser());
    const first = await googleLogin();
    await User.updateOne({ _id: first.body._id }, { $set: { credits: 20 } });

    const second = await googleLogin();

    expect(second.status).toBe(200);
    expect(second.body._id).toBe(first.body._id);
    expect(second.body.credits).toBe(20);
    expect(await User.countDocuments()).toBe(1);
  });

  it("links an older profile (same email, no Google id yet) instead of creating a second one", async () => {
    const old = await makeUser({ email: "old@example.com", credits: 40 });
    verifyIdToken.mockResolvedValue(googleUser({ uid: "uid-9", email: "old@example.com" }));

    const res = await googleLogin();

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(String(old._id));
    expect(res.body.credits).toBe(40);
    expect(await User.countDocuments()).toBe(1);
    const saved = await User.findById(old._id).select("+googleUid");
    expect(saved.googleUid).toBe("uid-9");
  });

  it("returns 409 when the email already belongs to a different Google account", async () => {
    await User.create({ name: "Owner", email: "shared@example.com", googleUid: "uid-A" });
    verifyIdToken.mockResolvedValue(googleUser({ uid: "uid-B", email: "shared@example.com" }));

    const res = await googleLogin();

    expect(res.status).toBe(409);
    expect(sessionCookie(res)).toBeUndefined();
    expect(await User.countDocuments()).toBe(1);
  });

  it("falls back to the part of the email before @ when Google sends no name, and cuts long names to 60", async () => {
    verifyIdToken.mockResolvedValueOnce(googleUser({ uid: "u-a", email: "nameless@example.com", name: undefined }));
    const a = await googleLogin();
    expect(a.body.name).toBe("nameless");

    verifyIdToken.mockResolvedValueOnce(googleUser({ uid: "u-b", email: "long@example.com", name: "N".repeat(100) }));
    const b = await googleLogin();
    expect(b.body.name).toHaveLength(60);
  });

  it("ignores a profile picture URL that is too long, and updates a changed one", async () => {
    verifyIdToken.mockResolvedValueOnce(googleUser({ picture: "https://img.example/" + "a".repeat(600) }));
    const first = await googleLogin();
    expect(first.body.photo).toBe("");

    verifyIdToken.mockResolvedValueOnce(googleUser({ picture: "https://img.example/new.png" }));
    const second = await googleLogin();
    expect(second.body.photo).toBe("https://img.example/new.png");
  });

  it.each([
    ["lax", /SameSite=Lax/i, false],
    ["none", /SameSite=None/i, true],
    ["strict", /SameSite=Strict/i, false],
    ["nonsense", /SameSite=Strict/i, false], // unknown values fall back to the default
  ])("COOKIE_SAMESITE=%s sets the matching cookie options", async (value, sameSite, secure) => {
    process.env.COOKIE_SAMESITE = value;
    verifyIdToken.mockResolvedValue(googleUser());

    const res = await googleLogin();

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(sameSite);
    expect(/;\s*Secure/i.test(cookie)).toBe(secure);
  });
});

describe("logout", () => {
  it("clears the login cookie, and works even when not signed in", async () => {
    const res = await request(app).post("/api/auth/logout").send({});

    expect(res.status).toBe(200);
    const cleared = sessionCookie(res);
    expect(cleared).toMatch(/^token=;/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });
});

describe("demo login", () => {
  it("is a 404 unless DEMO_MODE is exactly true, and creates nothing", async () => {
    for (const value of [undefined, "false", "TRUE", "1"]) {
      if (value === undefined) delete process.env.DEMO_MODE;
      else process.env.DEMO_MODE = value;

      const res = await demoLogin();

      expect(res.status).toBe(404);
      expect(sessionCookie(res)).toBeUndefined();
    }
    expect(await User.countDocuments()).toBe(0);
  });

  it("with DEMO_MODE=true creates the demo user with 150 credits and a one-day cookie", async () => {
    process.env.DEMO_MODE = "true";

    const res = await demoLogin();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: DEMO_EMAIL, name: "Demo User", credits: 150 });
    expect(sessionCookie(res)).toMatch(/Max-Age=86400/);
    expect(await User.countDocuments({ email: DEMO_EMAIL })).toBe(1);
  });

  it("tops the balance back up to 150 on every login, but never lowers a higher balance", async () => {
    process.env.DEMO_MODE = "true";
    await demoLogin();

    await User.updateOne({ email: DEMO_EMAIL }, { $set: { credits: 20 } });
    expect((await demoLogin()).body.credits).toBe(150);

    await User.updateOne({ email: DEMO_EMAIL }, { $set: { credits: 400 } });
    expect((await demoLogin()).body.credits).toBe(400);

    expect(await User.countDocuments({ email: DEMO_EMAIL })).toBe(1);
  });
});

describe("blockDemo (the shared demo account cannot be edited)", () => {
  const blockedRoutes = [
    ["PATCH", "/api/user/profile", { name: "Hacked Name" }],
    ["POST", "/api/user/avatar", {}],
    ["DELETE", "/api/user/avatar", {}],
    ["POST", "/api/user/email/change", {}],
  ];

  it.each(blockedRoutes)("returns 403 for the demo user on %s %s", async (method, path, body) => {
    process.env.DEMO_MODE = "true";
    const login = await demoLogin();

    const res = await request(app)[method.toLowerCase()](path).set("Cookie", cookieHeader(login)).send(body);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/demo account/i);
    expect((await User.findOne({ email: DEMO_EMAIL })).name).toBe("Demo User");
  });

  it("does not block a normal user (profile name change works)", async () => {
    const user = await makeUser({ name: "Before Name" });

    const res = await request(app)
      .patch("/api/user/profile")
      .set("Cookie", await authCookie(user))
      .send({ name: "After Name" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("After Name");
  });

  it("lets the demo user read their own profile", async () => {
    process.env.DEMO_MODE = "true";
    const login = await demoLogin();

    const res = await currentUser(cookieHeader(login));

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(DEMO_EMAIL);
  });
});