import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";

vi.mock("../services/AiService.js", () => ({ askAi: vi.fn() }));

import { askAi } from "../services/AiService.js";
import app from "../app.js";
import genToken from "../config/token.js";

// these routes only need a valid login cookie, not a database
const newUserCookie = async () => `token=${await genToken(crypto.randomBytes(12).toString("hex"))}`;

const RESUME = [
  "ASHA VERMA",
  "SUMMARY",
  "Full stack developer who builds REST APIs with React and Node.js.",
  "SKILLS",
  "JavaScript, React, Node.js, MongoDB",
  "PROJECTS",
  "- Built a payments dashboard used by 40 customers",
].join("\n");

const JOB = [
  "We are hiring a full stack engineer to build customer dashboards.",
  "You will work with React and Node.js every day, ship services with Docker,",
  "and deploy them on AWS with our platform team.",
].join(" ");

const KEYWORD_REPLY = "MUST_HAVE: React, Node.js, Docker\nNICE_TO_HAVE: AWS";

// the rewrite adds the missing skills and one number that was not in the original
const REWRITE_REPLY = [
  "### RESUME",
  "ASHA VERMA",
  "SUMMARY",
  "Full stack developer who builds REST APIs with React and Node.js, deployed with Docker on AWS (99% uptime).",
  "SKILLS",
  "React, Node.js, JavaScript, MongoDB, Docker, AWS",
  "PROJECTS",
  "- Built a payments dashboard used by 40 customers",
  "### CHANGES",
  "- Moved React and Node.js to the front of the skills list",
  "- Mentioned Docker and AWS in the summary",
].join("\n");

const isKeywordCall = (messages) => messages[0].content.startsWith("You extract the screening keywords");

// answers the first AI step (keywords) and the second (rewrite) by what is asked
const happyAi = () =>
  askAi.mockImplementation(async (messages) => (isKeywordCall(messages) ? KEYWORD_REPLY : REWRITE_REPLY));

const tailor = (cookie, body = { resumeText: RESUME, jobDescription: JOB }) =>
  request(app).post("/api/resume/tailor").set("Cookie", cookie).send(body);

beforeEach(() => {
  askAi.mockReset();
});

describe("POST /api/resume/tailor: request checks", () => {
  it("needs a login", async () => {
    const res = await request(app).post("/api/resume/tailor").send({ resumeText: RESUME, jobDescription: JOB });
    expect(res.status).toBe(401);
  });

  it.each([
    ["no resume", { jobDescription: JOB }, /add your resume/i],
    ["a resume under 100 characters", { resumeText: "x".repeat(99), jobDescription: JOB }, /add your resume/i],
    ["a resume that is only spaces", { resumeText: " ".repeat(500), jobDescription: JOB }, /add your resume/i],
    ["no job description", { resumeText: RESUME }, /full job description/i],
    ["a job description under 100 characters", { resumeText: RESUME, jobDescription: "x".repeat(99) }, /full job description/i],
    ["text that is not a string", { resumeText: 12345, jobDescription: JOB }, /add your resume/i],
  ])("returns 400 for %s, without asking the AI", async (_name, body, message) => {
    const res = await tailor(await newUserCookie(), body);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
    expect(askAi).not.toHaveBeenCalled();
  });
});

describe("POST /api/resume/tailor: a successful run", () => {
  it("returns before and after scores, the added keywords, the changes and new numbers", async () => {
    happyAi();

    const res = await tailor(await newUserCookie());

    expect(res.status).toBe(200);
    // React and Node.js (2 points each) were there; Docker (2) and AWS (1) were not
    expect(res.body.before).toEqual({ score: 57, matched: ["React", "Node.js"], missing: ["Docker", "AWS"] });
    expect(res.body.after).toEqual({ score: 100, matched: ["React", "Node.js", "Docker", "AWS"], missing: [] });
    expect(res.body.added).toEqual(["Docker", "AWS"]);
    expect(res.body.newNumbers).toEqual(["99%"]); // 40 was already in the original
    expect(res.body.changes).toEqual([
      "Moved React and Node.js to the front of the skills list",
      "Mentioned Docker and AWS in the summary",
    ]);
    expect(res.body.tailoredText).toContain("deployed with Docker on AWS");
    expect(res.body.tailoredText).not.toContain("###");
  });

  it("returns the keywords with their importance and spelling variants", async () => {
    happyAi();

    const res = await tailor(await newUserCookie());

    expect(res.body.keywords.map((k) => [k.term, k.importance])).toEqual([
      ["React", "must"],
      ["Node.js", "must"],
      ["Docker", "must"],
      ["AWS", "nice"],
    ]);
    const react = res.body.keywords.find((k) => k.term === "React");
    expect(react.variants).toEqual(expect.arrayContaining(["react", "reactjs"]));
  });

  it("tells the rewrite step which keywords are missing", async () => {
    happyAi();

    await tailor(await newUserCookie());

    expect(askAi).toHaveBeenCalledTimes(2);
    const rewritePrompt = askAi.mock.calls[1][0][1].content;
    expect(rewritePrompt).toContain("KEYWORDS ALREADY IN THE RESUME: React, Node.js");
    expect(rewritePrompt).toMatch(/NOT FOUND IN THE RESUME[^\n]*: Docker, AWS/);
  });
});

describe("POST /api/resume/tailor: when the AI misbehaves", () => {
  it("asks for keywords a second time when the first answer has fewer than 3", async () => {
    askAi.mockImplementation(async (messages) => {
      if (!isKeywordCall(messages)) return REWRITE_REPLY;
      return askAi.mock.calls.filter(([m]) => isKeywordCall(m)).length === 1
        ? "MUST_HAVE: React"
        : KEYWORD_REPLY;
    });

    const res = await tailor(await newUserCookie());

    expect(res.status).toBe(200);
    expect(askAi).toHaveBeenCalledTimes(3); // keywords twice, then the rewrite
  });

  it("gives a clean 500 after two useless keyword answers, and never reaches the rewrite", async () => {
    askAi.mockResolvedValue("I could not find any keywords, sorry.");

    const res = await tailor(await newUserCookie());

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/couldn't tailor your resume/i);
    expect(askAi).toHaveBeenCalledTimes(2);
  });

  // a rewrite of the given length, as a share of the original resume
  const rewriteOfLength = (ratio) =>
    `### RESUME\n${"ASHA VERMA ".padEnd(Math.round(RESUME.length * ratio), "a")}\n### CHANGES\n- Shortened the resume`;

  it.each([
    ["30%", 0.3, 500],
    ["60%", 0.6, 200],
  ])("a rewrite that is %s as long as the original is handled correctly (under half is refused)", async (_name, ratio, status) => {
    askAi.mockImplementation(async (messages) => (isKeywordCall(messages) ? KEYWORD_REPLY : rewriteOfLength(ratio)));

    const res = await tailor(await newUserCookie());

    expect(res.status).toBe(status);
    if (status === 500) expect(res.body.message).toMatch(/couldn't tailor your resume/i);
  });

  it("leaks no provider detail when the AI call fails", async () => {
    askAi.mockRejectedValue(new Error("provider secret: key sk-123"));

    const res = await tailor(await newUserCookie());

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("sk-123");
  });
});

describe("POST /api/resume/tailor: one run at a time per user", () => {
  const slowAi = () =>
    askAi.mockImplementation(
      (messages) =>
        new Promise((resolve) => setTimeout(() => resolve(isKeywordCall(messages) ? KEYWORD_REPLY : REWRITE_REPLY), 100)),
    );

  it("answers 429 to a second request from the same user while the first is running", async () => {
    slowAi();
    const cookie = await newUserCookie();

    const results = await Promise.all([tailor(cookie), tailor(cookie)]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 429]);
    const blocked = results.find((r) => r.status === 429);
    expect(blocked.body.message).toMatch(/already being tailored/i);
    expect(askAi).toHaveBeenCalledTimes(2); // only the first request used the AI
  });

  it("does not block a different user", async () => {
    slowAi();

    const results = await Promise.all([tailor(await newUserCookie()), tailor(await newUserCookie())]);

    expect(results.map((r) => r.status)).toEqual([200, 200]);
  });

  it("lets the user try again after a failure (the lock is released)", async () => {
    askAi.mockRejectedValueOnce(new Error("provider down"));
    askAi.mockImplementation(async (messages) => (isKeywordCall(messages) ? KEYWORD_REPLY : REWRITE_REPLY));
    const cookie = await newUserCookie();

    const failed = await tailor(cookie);
    const retried = await tailor(cookie);

    expect(failed.status).toBe(500);
    expect(retried.status).toBe(200);
  });
});

describe("POST /api/resume/tailor: usage limits", () => {
  // only the clock is faked, so the one-minute and one-day windows can be moved along
  const nextMinute = () => vi.setSystemTime(new Date(Date.now() + 61 * 1000));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
    happyAi();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows 3 per minute", async () => {
    const cookie = await newUserCookie();

    for (let i = 0; i < 3; i++) expect((await tailor(cookie)).status).toBe(200);
    const fourth = await tailor(cookie);

    expect(fourth.status).toBe(429);
    expect(fourth.body.message).toMatch(/too many requests/i);
  });

  it("allows 15 successful runs a day, then asks to try again tomorrow", async () => {
    const cookie = await newUserCookie();

    for (let round = 0; round < 5; round++) {
      for (let i = 0; i < 3; i++) expect((await tailor(cookie)).status).toBe(200);
      nextMinute();
    }
    const sixteenth = await tailor(cookie);

    expect(sixteenth.status).toBe(429);
    expect(sixteenth.body.message).toMatch(/daily limit reached/i);
  });

  it("does not count requests rejected for bad input towards the daily limit", async () => {
    const cookie = await newUserCookie();

    // 18 bad requests: more than the daily limit of 15 if they counted
    for (let round = 0; round < 6; round++) {
      for (let i = 0; i < 3; i++) {
        expect((await tailor(cookie, { resumeText: "too short", jobDescription: JOB })).status).toBe(400);
      }
      nextMinute();
    }

    expect((await tailor(cookie)).status).toBe(200);
  });

  it("counts each user's day separately", async () => {
    const busy = await newUserCookie();
    for (let round = 0; round < 5; round++) {
      for (let i = 0; i < 3; i++) await tailor(busy);
      nextMinute();
    }
    expect((await tailor(busy)).status).toBe(429);

    expect((await tailor(await newUserCookie())).status).toBe(200);
  });
});