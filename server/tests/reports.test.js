import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";

vi.mock("../services/AiService.js", () => ({ askAi: vi.fn() }));

import { askAi } from "../services/AiService.js";
import app from "../app.js";
import Interview from "../models/interviewModel.js";
import { startDb, stopDb, clearDb } from "./helpers/db.js";
import { makeUser, authCookie } from "./helpers/auth.js";

// an answered question with scores
const answered = (question, score, extra = {}) => ({
  question,
  difficulty: "medium",
  timeLimit: 90,
  answer: "my answer",
  submitted: true,
  score,
  confidence: score,
  communication: score,
  correctness: score,
  feedback: "ok",
  ...extra,
});

const unanswered = (question) => ({ question, difficulty: "medium", timeLimit: 90 });

const seed = (user, questions, extra = {}) =>
  Interview.create({
    userId: user._id,
    role: "Frontend Developer",
    experience: "2 years",
    mode: "Technical",
    questions,
    ...extra,
  });

const setup = async (questions, extra) => {
  const user = await makeUser();
  const interview = await seed(user, questions, extra);
  return { user, interview, cookie: await authCookie(user), id: String(interview._id) };
};

const finish = (cookie, body) => request(app).post("/api/interview/finish").set("Cookie", cookie).send(body);
const report = (cookie, id) => request(app).get(`/api/interview/report/${id}`).set("Cookie", cookie);
const modelAnswers = (cookie, id, body = {}) =>
  request(app).post(`/api/interview/report/${id}/model-answers`).set("Cookie", cookie).send(body);
const history = (cookie, query = "") => request(app).get(`/api/interview/history${query}`).set("Cookie", cookie);
const reload = (interview) => Interview.findById(interview._id);

const THREE_ANSWERED = () => [
  answered("What is the difference between let and const?", 7),
  answered("How does the virtual DOM help React update efficiently?", 8),
  answered("Explain closures and give a practical example.", 8),
];

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);
beforeEach(() => {
  askAi.mockReset();
});

describe("finishInterview", () => {
  it("returns 400 when interviewId is missing", async () => {
    const user = await makeUser();
    const res = await finish(await authCookie(user), {});
    expect(res.status).toBe(400);
  });

  it("returns 404 for an invalid or unknown id", async () => {
    const user = await makeUser();
    const cookie = await authCookie(user);
    expect((await finish(cookie, { interviewId: "nope" })).status).toBe(404);
    expect((await finish(cookie, { interviewId: String(new mongoose.Types.ObjectId()) })).status).toBe(404);
  });

  it("returns 403 for someone else's interview and does not complete it", async () => {
    const { interview, id } = await setup(THREE_ANSWERED());
    const intruder = await makeUser();

    const res = await finish(await authCookie(intruder), { interviewId: id });

    expect(res.status).toBe(403);
    expect((await reload(interview)).status).toBe("Incomplete");
  });

  it("returns 400 until every question is answered, and stays Incomplete", async () => {
    const { interview, cookie, id } = await setup([
      answered("First question about JavaScript?", 7),
      answered("Second question about React?", 6),
      unanswered("Third question still open?"),
    ]);

    const res = await finish(cookie, { interviewId: id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/2\/3 done/);
    const saved = await reload(interview);
    expect(saved.status).toBe("Incomplete");
  });

  it("averages every question (follow-ups included), rounds the response, and marks it Completed", async () => {
    const { interview, cookie, id } = await setup([
      answered("What is the difference between let and const?", 7),
      answered("How does the virtual DOM help React update efficiently?", 8),
      answered("What would you measure to prove that claim?", 8, { isFollowUp: true }),
    ]);

    const res = await finish(cookie, { interviewId: id });

    expect(res.status).toBe(200);
    expect(res.body.finalScore).toBe(7.7); // (7 + 8 + 8) / 3 = 7.666..., shown with 1 decimal
    expect(res.body).toMatchObject({ confidence: 7.7, communication: 7.7, correctness: 7.7 });
    expect(res.body.questionWiseScore).toHaveLength(3);
    expect(res.body.questionWiseScore[2]).toMatchObject({ index: 2, isFollowUp: true, score: 8 });

    const saved = await reload(interview);
    expect(saved.status).toBe("Completed");
    expect(saved.finalScore).toBeCloseTo(23 / 3, 5); // stored unrounded
  });

  it("counts unscored answers (score 0) in the average", async () => {
    const { cookie, id } = await setup([
      answered("First question about JavaScript?", 8),
      answered("Second question about React?", 0, { answer: "", feedback: "You did not submit an answer." }),
    ]);

    const res = await finish(cookie, { interviewId: id });

    expect(res.status).toBe(200);
    expect(res.body.finalScore).toBe(4);
  });

  it("can be called again without changing the result", async () => {
    const { cookie, id } = await setup(THREE_ANSWERED());

    const first = await finish(cookie, { interviewId: id });
    const second = await finish(cookie, { interviewId: id });

    expect(second.status).toBe(200);
    expect(second.body.finalScore).toBe(first.body.finalScore);
  });
});

describe("getInterviewReport", () => {
  it("returns 404 for an invalid or unknown id", async () => {
    const user = await makeUser();
    const cookie = await authCookie(user);
    expect((await report(cookie, "nope")).status).toBe(404);
    expect((await report(cookie, String(new mongoose.Types.ObjectId()))).status).toBe(404);
  });

  it("returns 403 for someone else's interview", async () => {
    const { id } = await setup(THREE_ANSWERED());
    const intruder = await makeUser();
    const res = await report(await authCookie(intruder), id);
    expect(res.status).toBe(403);
  });

  it("for an unfinished interview, averages only the answered questions and keeps their original numbers", async () => {
    const { cookie, id } = await setup([
      answered("First question about JavaScript?", 6),
      unanswered("Second question, skipped?"),
      answered("Third question about CSS?", 8),
    ]);

    const res = await report(cookie, id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "Incomplete", answeredCount: 2, totalQuestions: 3, finalScore: 7 });
    expect(res.body.questionWiseScore.map((q) => q.index)).toEqual([0, 2]);
  });

  it("returns zeros and an empty list when nothing was answered", async () => {
    const { cookie, id } = await setup([unanswered("Only question, not answered?")]);

    const res = await report(cookie, id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ finalScore: 0, answeredCount: 0, totalQuestions: 1, questionWiseScore: [] });
  });

  it("includes saved model answers and follow-up flags", async () => {
    const { cookie, id } = await setup([
      answered("First question about JavaScript?", 7, { modelAnswer: "A saved model answer." }),
      answered("A follow-up question about it?", 6, { isFollowUp: true }),
    ]);

    const res = await report(cookie, id);

    expect(res.body.questionWiseScore[0].modelAnswer).toBe("A saved model answer.");
    expect(res.body.questionWiseScore[1]).toMatchObject({ isFollowUp: true, modelAnswer: "" });
  });
});

describe("getModelAnswers", () => {
  const ANSWER_A = "I would explain that let allows reassignment while const does not, and I prefer const by default.";
  const ANSWER_B = "The virtual DOM lets React compare two lightweight trees and update only the parts that really changed.";

  it("returns 404 for an invalid id and 400 for a bad questionIndex", async () => {
    const user = await makeUser();
    const cookie = await authCookie(user);
    expect((await modelAnswers(cookie, "nope")).status).toBe(404);

    const { id, cookie: ownerCookie } = await setup(THREE_ANSWERED());
    for (const questionIndex of ["1", -1, 1.5]) {
      expect((await modelAnswers(ownerCookie, id, { questionIndex })).status).toBe(400);
    }
    expect(askAi).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown id and 403 for someone else's interview", async () => {
    const user = await makeUser();
    expect((await modelAnswers(await authCookie(user), String(new mongoose.Types.ObjectId()))).status).toBe(404);

    const { id } = await setup(THREE_ANSWERED());
    const intruder = await makeUser();
    expect((await modelAnswers(await authCookie(intruder), id)).status).toBe(403);
    expect(askAi).not.toHaveBeenCalled();
  });

  it("returns 400 for a question that was not answered", async () => {
    const { cookie, id } = await setup([answered("First question about JavaScript?", 7), unanswered("Not answered yet?")]);

    const res = await modelAnswers(cookie, id, { questionIndex: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hasn't been answered/i);
    expect(askAi).not.toHaveBeenCalled();
  });

  it("makes one AI call for all answered questions, saves them, and a second request makes no AI call", async () => {
    askAi.mockResolvedValue(`### 0\n${ANSWER_A}\n\n### 1\n${ANSWER_B}`);
    const { interview, cookie, id } = await setup([
      answered("What is the difference between let and const?", 7),
      answered("How does the virtual DOM help React update efficiently?", 8),
      unanswered("A question that was never answered?"),
    ]);

    const first = await modelAnswers(cookie, id);

    expect(first.status).toBe(200);
    expect(first.body.modelAnswers).toEqual({ 0: ANSWER_A, 1: ANSWER_B });
    expect(askAi).toHaveBeenCalledTimes(1);
    const prompt = askAi.mock.calls[0][0][1].content;
    expect(prompt).toContain("[0]");
    expect(prompt).toContain("[1]");
    expect(prompt).not.toContain("[2]");
    const saved = await reload(interview);
    expect(saved.questions[0].modelAnswer).toBe(ANSWER_A);
    expect(saved.questions[2].modelAnswer).toBeFalsy();

    const second = await modelAnswers(cookie, id);
    expect(second.status).toBe(200);
    expect(second.body.modelAnswers).toEqual({ 0: ANSWER_A, 1: ANSWER_B });
    expect(askAi).toHaveBeenCalledTimes(1); // nothing new to generate
  });

  it("only asks for the questions that have no model answer yet", async () => {
    askAi.mockResolvedValue(`### 1\n${ANSWER_B}`);
    const { cookie, id } = await setup([
      answered("What is the difference between let and const?", 7, { modelAnswer: ANSWER_A }),
      answered("How does the virtual DOM help React update efficiently?", 8),
    ]);

    const res = await modelAnswers(cookie, id);

    expect(res.body.modelAnswers).toEqual({ 0: ANSWER_A, 1: ANSWER_B });
    const prompt = askAi.mock.calls[0][0][1].content;
    expect(prompt).toContain("[1]");
    expect(prompt).not.toContain("[0]");
  });

  it("with questionIndex, prepares just that question", async () => {
    askAi.mockResolvedValue(`### 1\n${ANSWER_B}`);
    const { interview, cookie, id } = await setup(THREE_ANSWERED());

    const res = await modelAnswers(cookie, id, { questionIndex: 1 });

    expect(res.status).toBe(200);
    expect(res.body.modelAnswers).toEqual({ 1: ANSWER_B });
    const prompt = askAi.mock.calls[0][0][1].content;
    expect(prompt).toContain("[1]");
    expect(prompt).not.toContain("[0]");
    expect(prompt).not.toContain("[2]");
    expect((await reload(interview)).questions[0].modelAnswer).toBeFalsy();
  });

  it("understands a JSON reply", async () => {
    askAi.mockResolvedValue(JSON.stringify({ answers: [{ index: 0, answer: ANSWER_A }, { index: 1, answer: ANSWER_B }] }));
    const { cookie, id } = await setup(THREE_ANSWERED().slice(0, 2));

    const res = await modelAnswers(cookie, id);

    expect(res.body.modelAnswers).toEqual({ 0: ANSWER_A, 1: ANSWER_B });
  });

  it("accepts plain text when only one question is asked for", async () => {
    askAi.mockResolvedValue(ANSWER_A);
    const { cookie, id } = await setup(THREE_ANSWERED());

    const res = await modelAnswers(cookie, id, { questionIndex: 0 });

    expect(res.body.modelAnswers).toEqual({ 0: ANSWER_A });
  });

  it("saves the answer as clean plain text (no markdown, ASCII quotes)", async () => {
    askAi.mockResolvedValue(
      "### 0\n**I would say** that `const` is the \u201Csafer\u201D default \u2014 it stops accidental reassignment.\n- and keep it simple",
    );
    const { interview, cookie, id } = await setup(THREE_ANSWERED().slice(0, 1));

    await modelAnswers(cookie, id);

    const text = (await reload(interview)).questions[0].modelAnswer;
    expect(text).toBe('I would say that const is the "safer" default - it stops accidental reassignment. and keep it simple');
  });

  it("tries a second time when the first reply has nothing usable, then succeeds", async () => {
    askAi.mockResolvedValueOnce("### 0\nToo short.").mockResolvedValueOnce(`### 0\n${ANSWER_A}`);
    const { cookie, id } = await setup(THREE_ANSWERED().slice(0, 1));

    const res = await modelAnswers(cookie, id);

    expect(res.status).toBe(200);
    expect(askAi).toHaveBeenCalledTimes(2);
    expect(res.body.modelAnswers[0]).toBe(ANSWER_A);
  });

  it("gives a clean 500 and saves nothing when the AI never returns a usable answer", async () => {
    askAi.mockResolvedValue("### 0\nToo short.");
    const { interview, cookie, id } = await setup(THREE_ANSWERED().slice(0, 1));

    const res = await modelAnswers(cookie, id);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/couldn't prepare model answers/i);
    expect(JSON.stringify(res.body)).not.toMatch(/no usable/i);
    expect(askAi).toHaveBeenCalledTimes(2);
    expect((await reload(interview)).questions[0].modelAnswer).toBeFalsy();
  });

  it("answers 409 to a second request for the same interview while the first is running", async () => {
    askAi.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(`### 0\n${ANSWER_A}`), 150)),
    );
    const { cookie, id } = await setup(THREE_ANSWERED().slice(0, 1));

    const results = await Promise.all([modelAnswers(cookie, id), modelAnswers(cookie, id)]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(askAi).toHaveBeenCalledTimes(1);
  });

  it("releases the lock after a failure so the user can try again", async () => {
    askAi.mockRejectedValueOnce(new Error("provider down"));
    askAi.mockResolvedValue(`### 0\n${ANSWER_A}`);
    const { cookie, id } = await setup(THREE_ANSWERED().slice(0, 1));

    const failed = await modelAnswers(cookie, id);
    const retried = await modelAnswers(cookie, id);

    expect(failed.status).toBe(500);
    expect(JSON.stringify(failed.body)).not.toContain("provider down");
    expect(retried.status).toBe(200);
  });
});

describe("getMyInterviews: pagination", () => {
  const dated = (user, day, extra = {}) => ({
    userId: user._id,
    role: "Dev",
    experience: "1 year",
    mode: "HR",
    createdAt: new Date(`2026-01-${String(day).padStart(2, "0")}`),
    questions: [],
    ...extra,
  });

  it("returns newest first and respects limit and page", async () => {
    const user = await makeUser();
    await Interview.insertMany([1, 2, 3].map((d) => dated(user, d, { role: `Role ${d}` })));
    const cookie = await authCookie(user);

    const first = await history(cookie, "?limit=2");
    expect(first.body.map((i) => i.role)).toEqual(["Role 3", "Role 2"]);

    const second = await history(cookie, "?limit=2&page=2");
    expect(second.body.map((i) => i.role)).toEqual(["Role 1"]);

    const beyond = await history(cookie, "?limit=2&page=3");
    expect(beyond.body).toEqual([]);
  });

  it("falls back to sensible values for junk limit and page", async () => {
    const user = await makeUser();
    await Interview.insertMany([1, 2, 3].map((d) => dated(user, d)));
    const cookie = await authCookie(user);

    expect((await history(cookie, "?limit=abc&page=abc")).body).toHaveLength(3); // defaults: 50 per page, page 1
    expect((await history(cookie, "?limit=0")).body).toHaveLength(3); // 0 means default
    expect((await history(cookie, "?limit=-5")).body).toHaveLength(1); // clamped up to 1
    expect((await history(cookie, "?page=0")).body).toHaveLength(3); // page 0 counts as page 1
  });

  it("never returns more than 100 at once", async () => {
    const user = await makeUser();
    await Interview.insertMany(Array.from({ length: 105 }, (_, i) => dated(user, (i % 28) + 1)));

    const res = await history(await authCookie(user), "?limit=1000");

    expect(res.body).toHaveLength(100);
  });

  it("only lists the caller's interviews", async () => {
    const user = await makeUser();
    const other = await makeUser();
    await Interview.insertMany([dated(user, 1), dated(other, 2), dated(other, 3)]);

    const res = await history(await authCookie(user));

    expect(res.body).toHaveLength(1);
  });
});