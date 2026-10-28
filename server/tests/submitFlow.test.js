import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";

vi.mock("../services/AiService.js", () => ({ askAi: vi.fn() }));

import { askAi } from "../services/AiService.js";
import app from "../app.js";
import Interview from "../models/interviewModel.js";
import { startDb, stopDb, clearDb } from "./helpers/db.js";
import { makeUser, authCookie } from "./helpers/auth.js";

// a scoring reply the fake AI sends back: (8 + 6 + 7) / 3 = score 7
const aiReply = (overrides = {}) =>
  JSON.stringify({
    confidence: 8,
    communication: 6,
    correctness: 7,
    feedback: "Clear answer, add an example.",
    followup: "",
    ...overrides,
  });

const FOLLOW_UP = "Can you explain how you would test that in production?";

const defaultQuestions = () => [
  { question: "What is the difference between let and const?", difficulty: "easy", timeLimit: 60 },
  { question: "How does the virtual DOM help React update efficiently?", difficulty: "medium", timeLimit: 90 },
  { question: "Explain closures and give a practical example.", difficulty: "hard", timeLimit: 120 },
];

const seed = (user, questions = defaultQuestions(), extra = {}) =>
  Interview.create({
    userId: user._id,
    role: "Frontend Developer",
    experience: "2 years",
    mode: "Technical",
    questions,
    ...extra,
  });

const submit = (cookie, body) =>
  request(app).post("/api/interview/submitAnswer").set("Cookie", cookie).send(body);

const reload = (interview) => Interview.findById(interview._id);

// most tests need: a user, their interview, and their login cookie
const setup = async (questions) => {
  const user = await makeUser();
  const interview = await seed(user, questions);
  return { user, interview, cookie: await authCookie(user), id: String(interview._id) };
};

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);
beforeEach(() => {
  askAi.mockReset();
});

describe("submitAnswer: request validation", () => {
  it.each([
    ["interviewId is not a string", { interviewId: 123, questionIndex: 0, answer: "x" }],
    ["interviewId is missing", { questionIndex: 0, answer: "x" }],
    ["questionIndex is a string", { interviewId: "507f1f77bcf86cd799439011", questionIndex: "0", answer: "x" }],
    ["questionIndex is negative", { interviewId: "507f1f77bcf86cd799439011", questionIndex: -1, answer: "x" }],
    ["questionIndex is not a whole number", { interviewId: "507f1f77bcf86cd799439011", questionIndex: 1.5, answer: "x" }],
  ])("returns 400 when %s", async (_name, body) => {
    const user = await makeUser();
    const res = await submit(await authCookie(user), body);
    expect(res.status).toBe(400);
    expect(askAi).not.toHaveBeenCalled();
  });

  it("returns 404 for an id that is not a valid ObjectId", async () => {
    const user = await makeUser();
    const res = await submit(await authCookie(user), { interviewId: "not-an-id", questionIndex: 0, answer: "x" });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a valid id that does not exist", async () => {
    const user = await makeUser();
    const res = await submit(await authCookie(user), {
      interviewId: String(new mongoose.Types.ObjectId()),
      questionIndex: 0,
      answer: "x",
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a question index past the end", async () => {
    const { cookie, id } = await setup();
    const res = await submit(cookie, { interviewId: id, questionIndex: 3, answer: "x" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid question index/i);
  });
});

describe("submitAnswer: ownership and repeats", () => {
  it("returns 403 for someone else's interview and changes nothing", async () => {
    const { interview, id } = await setup();
    const intruder = await makeUser();

    const res = await submit(await authCookie(intruder), { interviewId: id, questionIndex: 0, answer: "mine now" });

    expect(res.status).toBe(403);
    expect(askAi).not.toHaveBeenCalled();
    const saved = await reload(interview);
    expect(saved.questions[0].submitted).toBe(false);
    expect(saved.questions[0].answer).toBeFalsy();
  });

  it("returns 400 when the question was already answered, without a second AI call", async () => {
    askAi.mockResolvedValue(aiReply());
    const { cookie, id } = await setup();

    const first = await submit(cookie, { interviewId: id, questionIndex: 0, answer: "first answer", timeTaken: 20 });
    const second = await submit(cookie, { interviewId: id, questionIndex: 0, answer: "second answer", timeTaken: 20 });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/already been answered/i);
    expect(askAi).toHaveBeenCalledTimes(1);
  });
});

describe("submitAnswer: unscored answers", () => {
  it.each([["empty", ""], ["only spaces", "   \n  "]])(
    "stores an %s answer as score 0 without calling the AI",
    async (_name, answer) => {
      const { interview, cookie, id } = await setup();

      const res = await submit(cookie, { interviewId: id, questionIndex: 0, answer, timeTaken: 5 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ score: 0, feedback: "You did not submit an answer." });
      expect(askAi).not.toHaveBeenCalled();
      const q = (await reload(interview)).questions[0];
      expect(q.submitted).toBe(true);
      expect(q.score).toBe(0);
    },
  );

  it("stores an answer sent after the time limit as score 0, keeps the text, skips the AI", async () => {
    const { interview, cookie, id } = await setup();

    const res = await submit(cookie, { interviewId: id, questionIndex: 0, answer: "too late answer", timeTaken: 61 });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(0);
    expect(res.body.feedback).toMatch(/time limit exceeded/i);
    expect(askAi).not.toHaveBeenCalled();
    const q = (await reload(interview)).questions[0];
    expect(q.answer).toBe("too late answer");
    expect(q.submitted).toBe(true);
  });

  it("still scores an answer sent exactly at the time limit", async () => {
    askAi.mockResolvedValue(aiReply());
    const { cookie, id } = await setup();

    const res = await submit(cookie, { interviewId: id, questionIndex: 0, answer: "just in time", timeTaken: 60 });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(7);
    expect(askAi).toHaveBeenCalledTimes(1);
  });
});

describe("submitAnswer: a normal answer", () => {
  it("saves the scores, feedback and answer, and returns them", async () => {
    askAi.mockResolvedValue(aiReply());
    const { interview, cookie, id } = await setup();

    const res = await submit(cookie, {
      interviewId: id,
      questionIndex: 0,
      answer: "let can be reassigned, const cannot.",
      timeTaken: 30,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      score: 7,
      confidence: 8,
      communication: 6,
      correctness: 7,
      feedback: "Clear answer, add an example.",
      followUp: null,
    });
    const q = (await reload(interview)).questions[0];
    expect(q).toMatchObject({
      answer: "let can be reassigned, const cannot.",
      submitted: true,
      score: 7,
      confidence: 8,
      communication: 6,
      correctness: 7,
    });
  });

  it("clamps out-of-range scores from the AI to 0-10", async () => {
    askAi.mockResolvedValue(aiReply({ confidence: 99, communication: -4, correctness: 10 }));
    const { cookie, id } = await setup();

    const res = await submit(cookie, { interviewId: id, questionIndex: 0, answer: "an answer", timeTaken: 10 });

    expect(res.body).toMatchObject({ confidence: 10, communication: 0, correctness: 10 });
  });

  it("cuts an over-long answer to 5000 characters", async () => {
    askAi.mockResolvedValue(aiReply());
    const { interview, cookie, id } = await setup();

    await submit(cookie, { interviewId: id, questionIndex: 0, answer: "a".repeat(6000), timeTaken: 10 });

    expect((await reload(interview)).questions[0].answer).toHaveLength(5000);
  });
});

describe("submitAnswer: follow-up questions", () => {
  it("inserts a follow-up right after a non-easy question", async () => {
    askAi.mockResolvedValue(aiReply({ followup: FOLLOW_UP }));
    const { interview, cookie, id } = await setup();

    const res = await submit(cookie, { interviewId: id, questionIndex: 1, answer: "it diffs a virtual tree", timeTaken: 40 });

    expect(res.status).toBe(200);
    expect(res.body.followUp).toMatchObject({
      question: FOLLOW_UP,
      index: 2,
      isFollowUp: true,
      difficulty: "medium",
      timeLimit: 90,
    });
    const questions = (await reload(interview)).questions;
    expect(questions).toHaveLength(4);
    expect(questions[2]).toMatchObject({ question: FOLLOW_UP, isFollowUp: true, submitted: false });
    expect(questions[3].question).toMatch(/closures/i); // the old question 3 moved down
  });

  it("never adds a follow-up after an easy question", async () => {
    askAi.mockResolvedValue(aiReply({ followup: FOLLOW_UP }));
    const { interview, cookie, id } = await setup();

    const res = await submit(cookie, { interviewId: id, questionIndex: 0, answer: "let vs const", timeTaken: 10 });

    expect(res.body.followUp).toBeNull();
    expect((await reload(interview)).questions).toHaveLength(3);
  });

  it("never adds a follow-up after a follow-up", async () => {
    askAi.mockResolvedValue(aiReply({ followup: FOLLOW_UP }));
    const questions = [
      { question: "How does the virtual DOM help React update efficiently?", difficulty: "medium", timeLimit: 90 },
      { question: "What would you measure to prove that claim?", difficulty: "medium", timeLimit: 90, isFollowUp: true },
    ];
    const { interview, cookie, id } = await setup(questions);

    const res = await submit(cookie, { interviewId: id, questionIndex: 1, answer: "render timings", timeTaken: 10 });

    expect(res.body.followUp).toBeNull();
    expect((await reload(interview)).questions).toHaveLength(2);
  });

  it("stops after 2 follow-ups in one interview", async () => {
    askAi.mockResolvedValue(aiReply({ followup: FOLLOW_UP }));
    const questions = [
      { question: "Explain closures and give a practical example.", difficulty: "hard", timeLimit: 120 },
      { question: "First follow-up question about closures?", difficulty: "hard", timeLimit: 90, isFollowUp: true, submitted: true, answer: "x" },
      { question: "Second follow-up question about closures?", difficulty: "hard", timeLimit: 90, isFollowUp: true, submitted: true, answer: "y" },
    ];
    const { interview, cookie, id } = await setup(questions);

    const res = await submit(cookie, { interviewId: id, questionIndex: 0, answer: "a closure keeps its scope", timeTaken: 10 });

    expect(res.body.followUp).toBeNull();
    expect((await reload(interview)).questions).toHaveLength(3);
  });

  it("never goes past 10 questions", async () => {
    askAi.mockResolvedValue(aiReply({ followup: FOLLOW_UP }));
    const questions = Array.from({ length: 10 }, (_, i) => ({
      question: `Medium question number ${i + 1} about JavaScript?`,
      difficulty: "medium",
      timeLimit: 90,
    }));
    const { interview, cookie, id } = await setup(questions);

    const res = await submit(cookie, { interviewId: id, questionIndex: 0, answer: "an answer", timeTaken: 10 });

    expect(res.status).toBe(200);
    expect(res.body.followUp).toBeNull();
    expect((await reload(interview)).questions).toHaveLength(10);
  });

  it.each([
    ["too short", "Why?"],
    ["not a question", "Tell me more about how you would test that in production."],
    ["too long", `${"Why would you do that in production ".repeat(12)}?`],
  ])("ignores a follow-up that is %s", async (_name, followup) => {
    askAi.mockResolvedValue(aiReply({ followup }));
    const { interview, cookie, id } = await setup();

    const res = await submit(cookie, { interviewId: id, questionIndex: 1, answer: "an answer", timeTaken: 10 });

    expect(res.status).toBe(200);
    expect(res.body.followUp).toBeNull();
    expect((await reload(interview)).questions).toHaveLength(3);
  });

  it("ignores a follow-up that repeats an existing question (case does not matter)", async () => {
    askAi.mockResolvedValue(aiReply({ followup: "how does the virtual DOM help react update efficiently?" }));
    const questions = [
      { question: "How does the virtual DOM help React update efficiently?", difficulty: "medium", timeLimit: 90 },
      { question: "Explain closures and give a practical example.", difficulty: "hard", timeLimit: 120 },
    ];
    const { interview, cookie, id } = await setup(questions);

    const res = await submit(cookie, { interviewId: id, questionIndex: 1, answer: "an answer", timeTaken: 10 });

    expect(res.status).toBe(200);
    expect(res.body.followUp).toBeNull();
    expect((await reload(interview)).questions).toHaveLength(2);
  });

  it("removes quotation marks from the follow-up text", async () => {
    askAi.mockResolvedValue(aiReply({ followup: `\u201CCan you explain how you'd test that in production?\u201D` }));
    const { cookie, id } = await setup();

    const res = await submit(cookie, { interviewId: id, questionIndex: 1, answer: "an answer", timeTaken: 10 });

    expect(res.body.followUp.question).toBe("Can you explain how you'd test that in production?");
  });
});

describe("submitAnswer: voice delivery stats", () => {
  it("cleans delivery numbers before saving them", async () => {
    askAi.mockResolvedValue(aiReply());
    const { interview, cookie, id } = await setup();

    await submit(cookie, {
      interviewId: id,
      questionIndex: 0,
      answer: "spoken answer",
      timeTaken: 30,
      delivery: {
        durationSec: 9999,
        wordCount: 50,
        wpm: 9999,
        fillerCount: -5,
        fillers: Array.from({ length: 8 }, (_, i) => ({ word: "um".repeat(30) + i, count: 3 })),
        longPauseCount: 2,
        longestPauseSec: 4.5,
      },
    });

    const d = (await reload(interview)).questions[0].delivery;
    expect(d.durationSec).toBe(600);
    expect(d.wpm).toBe(400);
    expect(d.fillerCount).toBe(0);
    expect(d.fillers).toHaveLength(5);
    expect(d.fillers[0].word.length).toBeLessThanOrEqual(20);
    expect(d.longestPauseSec).toBe(4.5);
  });

  it("saves no delivery data when there are no spoken words", async () => {
    askAi.mockResolvedValue(aiReply());
    const { interview, cookie, id } = await setup();

    await submit(cookie, {
      interviewId: id,
      questionIndex: 0,
      answer: "typed answer",
      timeTaken: 30,
      delivery: { wordCount: 0, wpm: 120 },
    });

    expect((await reload(interview)).questions[0].delivery?.wordCount).toBeUndefined();
  });
});

describe("submitAnswer: bad AI replies", () => {
  it("leaves the question unsubmitted after three bad replies", async () => {
    askAi.mockResolvedValue("Sorry, I can't score that.");
    const { interview, cookie, id } = await setup();

    const res = await submit(cookie, { interviewId: id, questionIndex: 0, answer: "an answer", timeTaken: 10 });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/failed to submit/i);
    expect(askAi).toHaveBeenCalledTimes(3);
    const q = (await reload(interview)).questions[0];
    expect(q.submitted).toBe(false);
    expect(q.answer).toBeFalsy();
  });

  it("succeeds when the second reply is good", async () => {
    askAi.mockResolvedValueOnce("not json at all").mockResolvedValueOnce(aiReply());
    const { cookie, id } = await setup();

    const res = await submit(cookie, { interviewId: id, questionIndex: 0, answer: "an answer", timeTaken: 10 });

    expect(res.status).toBe(200);
    expect(askAi).toHaveBeenCalledTimes(2);
  });

  it("lets the user retry after an AI failure (the lock is released)", async () => {
    askAi.mockRejectedValueOnce(new Error("provider down"));
    askAi.mockResolvedValue(aiReply());
    const { cookie, id } = await setup();
    const body = { interviewId: id, questionIndex: 0, answer: "an answer", timeTaken: 10 };

    const failed = await submit(cookie, body);
    const retried = await submit(cookie, body);

    expect(failed.status).toBe(500);
    expect(JSON.stringify(failed.body)).not.toContain("provider down");
    expect(retried.status).toBe(200);
  });
});

describe("submitAnswer: double-submit lock", () => {
  it("answers 409 to a second request for the same question while the first is running", async () => {
    askAi.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(aiReply()), 150)));
    const { interview, cookie, id } = await setup();
    const body = { interviewId: id, questionIndex: 0, answer: "an answer", timeTaken: 10 };

    const results = await Promise.all([submit(cookie, body), submit(cookie, body)]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(askAi).toHaveBeenCalledTimes(1);
    expect((await reload(interview)).questions[0].submitted).toBe(true);
  });
});