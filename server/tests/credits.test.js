import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  vi,
} from "vitest";
import request from "supertest";

vi.mock("../services/AiService.js", () => ({ askAi: vi.fn() }));

import { askAi } from "../services/AiService.js";
import app from "../app.js";
import User from "../models/users.js";
import Interview from "../models/interviewModel.js";
import { startDb, stopDb, clearDb } from "./helpers/db.js";
import { makeUser, authCookie } from "./helpers/auth.js";

const SIX_QUESTIONS = [
  "What is the difference between let and const in JavaScript?",
  "How does the virtual DOM help React update the page efficiently?",
  "Explain how closures work and give a practical example of using one.",
  "How would you optimize a React component that re-renders too often?",
  "Describe how you would design a rate limiter for a public REST API.",
  "How would you debug a memory leak in a long running Node.js service?",
].join("\n");

const body = {
  role: "Frontend Developer",
  experience: "2 years",
  mode: "Technical",
};

const start = (cookie, payload = body) =>
  request(app)
    .post("/api/interview/generateQuestions")
    .set("Cookie", cookie)
    .send(payload);

const creditsOf = async (user) => (await User.findById(user._id)).credits;

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);
beforeEach(() => {
  askAi.mockReset();
});

describe("credits: starting an interview", () => {
  it("deducts exactly 50 and creates the interview", async () => {
    askAi.mockResolvedValue(SIX_QUESTIONS);
    const user = await makeUser({ credits: 150 });

    const res = await start(await authCookie(user));

    expect(res.status).toBe(200);
    expect(res.body.creditsLeft).toBe(100);
    expect(res.body.questions).toHaveLength(6);
    expect(await creditsOf(user)).toBe(100);
    expect(await Interview.countDocuments({ userId: user._id })).toBe(1);
  });

  it("works with exactly 50 credits and leaves 0", async () => {
    askAi.mockResolvedValue(SIX_QUESTIONS);
    const user = await makeUser({ credits: 50 });

    const res = await start(await authCookie(user));

    expect(res.status).toBe(200);
    expect(await creditsOf(user)).toBe(0);
  });

  it("returns 400 and deducts nothing when credits are below 50", async () => {
    const user = await makeUser({ credits: 49 });

    const res = await start(await authCookie(user));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not enough credits/i);
    expect(await creditsOf(user)).toBe(49);
    expect(askAi).not.toHaveBeenCalled();
    expect(await Interview.countDocuments()).toBe(0);
  });

  it("does not deduct when the request itself is invalid", async () => {
    const user = await makeUser({ credits: 150 });
    const cookie = await authCookie(user);

    const noRole = await start(cookie, {
      experience: "2 years",
      mode: "Technical",
    });
    const badMode = await start(cookie, { ...body, mode: "Casual" });

    expect(noRole.status).toBe(400);
    expect(badMode.status).toBe(400);
    expect(await creditsOf(user)).toBe(150);
    expect(askAi).not.toHaveBeenCalled();
  });
});

describe("credits: refunds when the AI fails", () => {
  it("refunds the 50 credits and leaks no internal detail", async () => {
    askAi.mockRejectedValue(new Error("upstream exploded: secret-detail"));
    const user = await makeUser({ credits: 150 });

    const res = await start(await authCookie(user));

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/refunded/i);
    expect(JSON.stringify(res.body)).not.toContain("secret-detail");
    expect(await creditsOf(user)).toBe(150);
    expect(await Interview.countDocuments()).toBe(0);
  });

  it("retries once when fewer than 6 questions come back, then refunds", async () => {
    askAi.mockResolvedValue("Only one usable question is returned here?\n");
    const user = await makeUser({ credits: 150 });

    const res = await start(await authCookie(user));

    expect(res.status).toBe(500);
    expect(askAi).toHaveBeenCalledTimes(2);
    expect(await creditsOf(user)).toBe(150);
  });

  it("succeeds when the retry returns 6 questions", async () => {
    askAi
      .mockResolvedValueOnce("Too short list of things?\n")
      .mockResolvedValueOnce(SIX_QUESTIONS);
    const user = await makeUser({ credits: 150 });

    const res = await start(await authCookie(user));

    expect(res.status).toBe(200);
    expect(askAi).toHaveBeenCalledTimes(2);
    expect(await creditsOf(user)).toBe(100);
  });
});

describe("credits: race conditions", () => {
  const slowAi = () =>
    askAi.mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve(SIX_QUESTIONS), 150)),
    );

  it("two simultaneous requests with only 50 credits: one succeeds", async () => {
    slowAi();
    const user = await makeUser({ credits: 50 });
    const cookie = await authCookie(user);

    const results = await Promise.all([start(cookie), start(cookie)]);
    const statuses = results.map((r) => r.status).sort();

    expect(statuses).toEqual([200, 400]);
    expect(await creditsOf(user)).toBe(0);
    expect(await Interview.countDocuments({ userId: user._id })).toBe(1);
  });

  it("five simultaneous requests with 100 credits: exactly two succeed, never below 0", async () => {
    slowAi();
    const user = await makeUser({ credits: 100 });
    const cookie = await authCookie(user);

    const results = await Promise.all([1, 2, 3, 4, 5].map(() => start(cookie)));
    const ok = results.filter((r) => r.status === 200).length;
    const rejected = results.filter((r) => r.status === 400).length;

    expect(ok).toBe(2);
    expect(rejected).toBe(3);
    expect(await creditsOf(user)).toBe(0);
    expect(await Interview.countDocuments({ userId: user._id })).toBe(2);
  });
});
