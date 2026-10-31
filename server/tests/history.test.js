import { it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import app from "../app.js";
import Interview from "../models/interviewModel.js";
import { startDb, stopDb, clearDb } from "./helpers/db.js";
import { makeUser, authCookie } from "./helpers/auth.js";
beforeAll(startDb); afterAll(stopDb); afterEach(clearDb);
it("GET /api/interview/history counts answered questions, newest first, only the caller's interviews", async () => {
  const user = await makeUser(); const other = await makeUser();
  const base = { role: "Dev", experience: "1 year", mode: "HR" };
  await Interview.create({ ...base, userId: user._id, createdAt: new Date("2026-01-01"), questions: [
    { question: "Q1 long enough?", submitted: true, answer: "a" },
    { question: "Q2 long enough?" },
    { question: "Q3 legacy answered", answer: "old answer without flag" },
    { question: "Q4 whitespace only", answer: "   " },
  ]});
  await Interview.create({ ...base, userId: user._id, createdAt: new Date("2026-02-01"), questions: [] });
  await Interview.create({ ...base, userId: other._id, questions: [{ question: "not yours?" }] });
  const res = await request(app).get("/api/interview/history").set("Cookie", await authCookie(user));
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(2);
  expect(new Date(res.body[0].createdAt) > new Date(res.body[1].createdAt)).toBe(true);
  expect(res.body[1]).toMatchObject({ role: "Dev", totalQuestions: 4, answeredCount: 2 });
  expect(res.body[0]).toMatchObject({ totalQuestions: 0, answeredCount: 0 });
  expect(res.body[0].questions).toBeUndefined();
});