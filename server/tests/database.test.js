import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import app from "../app.js";
import User from "../models/users.js";
import Interview from "../models/interviewModel.js";
import Payment from "../models/paymentModel.js";
import { startDb, stopDb, clearDb } from "./helpers/db.js";
import { makeUser, authCookie } from "./helpers/auth.js";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);

// which fields of a model are invalid? (checked without saving anything)
const invalidFields = (doc) => Object.keys(doc.validateSync()?.errors || {});

const validInterview = (overrides = {}) => ({
  userId: "507f1f77bcf86cd799439011",
  role: "Frontend Developer",
  experience: "2 years",
  mode: "Technical",
  questions: [{ question: "What is the difference between let and const?" }],
  ...overrides,
});

// find an index definition by its key
const findIndex = (schema, key) =>
  schema.indexes().find(([fields]) => JSON.stringify(fields) === JSON.stringify(key));

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

describe("index definitions", () => {
  it("Interview: history lookup index on userId + newest first", () => {
    expect(findIndex(Interview.schema, { userId: 1, createdAt: -1 })).toBeDefined();
  });

  it("Interview: unfinished interviews expire after 14 days, finished ones are never deleted", () => {
    const [, options] = findIndex(Interview.schema, { createdAt: 1 });
    expect(options.expireAfterSeconds).toBe(14 * 24 * 60 * 60);
    expect(options.partialFilterExpression).toEqual({ status: "Incomplete" });
  });

  it("Payment: order id is unique, and unpaid orders expire after 2 days (paid ones are kept)", () => {
    const [, unique] = findIndex(Payment.schema, { razorpayOrderId: 1 });
    expect(unique.unique).toBe(true);

    const [, ttl] = findIndex(Payment.schema, { createdAt: 1 });
    expect(ttl.expireAfterSeconds).toBe(2 * 24 * 60 * 60);
    expect(ttl.partialFilterExpression).toEqual({ status: "created" });

    expect(findIndex(Payment.schema, { userId: 1 })).toBeDefined();
  });

  it("User: email is unique, and the Google id is unique but optional (sparse)", () => {
    const [, email] = findIndex(User.schema, { email: 1 });
    expect(email.unique).toBe(true);

    const [, uid] = findIndex(User.schema, { googleUid: 1 });
    expect(uid).toMatchObject({ unique: true, sparse: true });
  });
});

describe("User rules", () => {
  it("fills in the defaults: 150 credits and empty photos", () => {
    const user = new User({ name: "Asha", email: "asha@example.com" });
    expect(user.credits).toBe(150);
    expect(user.photo).toBe("");
    expect(invalidFields(user)).toEqual([]);
  });

  it("needs a name and an email", () => {
    expect(invalidFields(new User({}))).toEqual(expect.arrayContaining(["name", "email"]));
  });

  it("limits the name to 60 characters", () => {
    expect(invalidFields(new User({ name: "N".repeat(60), email: "a@b.com" }))).toEqual([]);
    expect(invalidFields(new User({ name: "N".repeat(61), email: "a@b.com" }))).toEqual(["name"]);
  });

  it("limits the email to 254 characters", () => {
    const email = (length) => "a".repeat(length - "@example.com".length) + "@example.com";
    expect(invalidFields(new User({ name: "Asha", email: email(254) }))).toEqual([]);
    expect(invalidFields(new User({ name: "Asha", email: email(255) }))).toEqual(["email"]);
  });

  it("lowercases and trims the email", () => {
    expect(new User({ name: "Asha", email: "  Asha@Example.COM " }).email).toBe("asha@example.com");
  });

  it("credits can never be negative", () => {
    expect(invalidFields(new User({ name: "Asha", email: "a@b.com", credits: 0 }))).toEqual([]);
    expect(invalidFields(new User({ name: "Asha", email: "a@b.com", credits: -1 }))).toEqual(["credits"]);
  });

  it("limits photo links to 500 characters", () => {
    expect(invalidFields(new User({ name: "Asha", email: "a@b.com", photo: "p".repeat(501) }))).toEqual(["photo"]);
  });

  it("refuses to save a second user with the same email, even in different letter case", async () => {
    await User.create({ name: "First", email: "same@example.com" });

    await expect(User.create({ name: "Second", email: "SAME@example.com" })).rejects.toMatchObject({ code: 11000 });
    expect(await User.countDocuments()).toBe(1);
  });

  it("allows many users without a Google id, but not two with the same one", async () => {
    await User.create({ name: "A", email: "a@example.com" });
    await User.create({ name: "B", email: "b@example.com" });
    await User.create({ name: "C", email: "c@example.com", googleUid: "uid-1" });

    await expect(User.create({ name: "D", email: "d@example.com", googleUid: "uid-1" })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("refuses to save a user with negative credits", async () => {
    await expect(User.create({ name: "Asha", email: "neg@example.com", credits: -5 })).rejects.toThrow(/credits/i);
  });
});

describe("Interview rules", () => {
  it("accepts a normal interview and fills in the defaults", () => {
    const interview = new Interview(validInterview());
    expect(invalidFields(interview)).toEqual([]);
    expect(interview.status).toBe("Incomplete");
    expect(interview.finalScore).toBe(0);
    expect(interview.questions[0]).toMatchObject({
      submitted: false,
      isFollowUp: false,
      score: 0,
      confidence: 0,
      communication: 0,
      correctness: 0,
    });
  });

  it("needs a user, a role, an experience and a mode", () => {
    expect(invalidFields(new Interview({}))).toEqual(
      expect.arrayContaining(["userId", "role", "experience", "mode"]),
    );
  });

  it("only allows the modes HR and Technical, and the statuses Incomplete and Completed", () => {
    expect(invalidFields(new Interview(validInterview({ mode: "Casual" })))).toEqual(["mode"]);
    expect(invalidFields(new Interview(validInterview({ status: "Done" })))).toEqual(["status"]);
    expect(invalidFields(new Interview(validInterview({ mode: "HR", status: "Completed" })))).toEqual([]);
  });

  it.each([
    ["role", 100, 101],
    ["experience", 50, 51],
    ["resumeText", 8000, 8001],
    ["jobDescription", 4000, 4001],
  ])("limits %s to %i characters", (field, ok, tooLong) => {
    expect(invalidFields(new Interview(validInterview({ [field]: "x".repeat(ok) })))).toEqual([]);
    expect(invalidFields(new Interview(validInterview({ [field]: "x".repeat(tooLong) })))).toEqual([field]);
  });

  it.each([
    ["question", 2000, 2001],
    ["answer", 5000, 5001],
    ["feedback", 2000, 2001],
    ["modelAnswer", 3000, 3001],
  ])("limits a question's %s to %i characters", (field, ok, tooLong) => {
    const withText = (length) =>
      validInterview({ questions: [{ question: "A normal question?", [field]: "x".repeat(length) }] });

    expect(invalidFields(new Interview(withText(ok)))).toEqual([]);
    expect(invalidFields(new Interview(withText(tooLong)))).toEqual([`questions.0.${field}`]);
  });

  it("allows at most 10 questions", () => {
    const questions = (n) => Array.from({ length: n }, (_, i) => ({ question: `Question number ${i + 1}?` }));

    expect(invalidFields(new Interview(validInterview({ questions: questions(10) })))).toEqual([]);
    expect(invalidFields(new Interview(validInterview({ questions: questions(11) })))).toEqual(["questions"]);
  });

  it("refuses to save an interview that breaks a rule", async () => {
    await expect(Interview.create(validInterview({ mode: "Casual" }))).rejects.toThrow(/mode/i);
    expect(await Interview.countDocuments()).toBe(0);
  });
});

describe("Payment rules", () => {
  const validPayment = (overrides = {}) => ({
    userId: "507f1f77bcf86cd799439011",
    packId: "popular",
    credits: 250,
    amount: 19900,
    razorpayOrderId: "order_1",
    ...overrides,
  });

  it("fills in INR and the 'created' status, and only knows 'created' and 'paid'", () => {
    const payment = new Payment(validPayment());
    expect(payment.currency).toBe("INR");
    expect(payment.status).toBe("created");
    expect(invalidFields(new Payment(validPayment({ status: "refunded" })))).toEqual(["status"]);
  });

  it("needs a user, pack, credits, amount and order id", () => {
    expect(invalidFields(new Payment({}))).toEqual(
      expect.arrayContaining(["userId", "packId", "credits", "amount", "razorpayOrderId"]),
    );
  });

  it("refuses two payments for the same Razorpay order", async () => {
    await Payment.create(validPayment());

    await expect(Payment.create(validPayment())).rejects.toMatchObject({ code: 11000 });
    expect(await Payment.countDocuments()).toBe(1);
  });
});

describe("GET /api/interview/stats (aggregation)", () => {
  const completed = (user, finalScore, createdAt) =>
    validInterview({ userId: user._id, status: "Completed", finalScore, createdAt });
  const open = (user, createdAt = daysAgo(1)) => validInterview({ userId: user._id, finalScore: 0, createdAt });
  const stats = async (user) =>
    (await request(app).get("/api/interview/stats").set("Cookie", await authCookie(user))).body;

  it("returns zeros for a user with no interviews", async () => {
    const user = await makeUser();
    expect(await stats(user)).toEqual({ completed: 0, incomplete: 0, avgScore: 0, bestScore: 0, recentScores: [] });
  });

  it("counts finished and unfinished interviews, and only averages the finished ones", async () => {
    const user = await makeUser();
    await Interview.insertMany([
      completed(user, 6, daysAgo(5)),
      completed(user, 9, daysAgo(4)),
      completed(user, 6, daysAgo(3)),
      open(user),
      open(user),
    ]);

    const body = await stats(user);

    expect(body.completed).toBe(3);
    expect(body.incomplete).toBe(2);
    expect(body.avgScore).toBe(7); // (6 + 9 + 6) / 3, the two unfinished 0s are ignored
    expect(body.bestScore).toBe(9);
    expect(body.recentScores).toHaveLength(3); // unfinished interviews are not listed
  });

  it("rounds the average and the best score to one decimal", async () => {
    const user = await makeUser();
    await Interview.insertMany([
      completed(user, 7, daysAgo(3)),
      completed(user, 8, daysAgo(2)),
      completed(user, 8.46, daysAgo(1)),
    ]);

    const body = await stats(user);

    expect(body.avgScore).toBe(7.8); // 7.82
    expect(body.bestScore).toBe(8.5);
  });

  it("lists the last 8 finished scores, oldest to newest", async () => {
    const user = await makeUser();
    // 10 finished interviews, scores 1..10, the score 10 being the newest
    await Interview.insertMany(
      Array.from({ length: 10 }, (_, i) => completed(user, i + 1, daysAgo(10 - i))),
    );

    const body = await stats(user);

    expect(body.recentScores.map((s) => s.finalScore)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    const dates = body.recentScores.map((s) => new Date(s.createdAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it("ignores other users' interviews", async () => {
    const user = await makeUser();
    const other = await makeUser();
    await Interview.insertMany([completed(user, 5, daysAgo(2)), completed(other, 10, daysAgo(1)), open(other)]);

    const body = await stats(user);

    expect(body).toMatchObject({ completed: 1, incomplete: 0, avgScore: 5, bestScore: 5 });
    expect(body.recentScores).toHaveLength(1);
  });
});

describe("GET /api/interview/progress (aggregation)", () => {
  const spoken = (durationSec, wordCount, fillerCount) => ({ durationSec, wordCount, fillerCount });
  const q = (confidence, communication, correctness, delivery) => ({
    question: "A question that was answered?",
    confidence,
    communication,
    correctness,
    ...(delivery ? { delivery } : {}),
  });
  const done = (user, createdAt, extra = {}) =>
    validInterview({ userId: user._id, status: "Completed", finalScore: 7, createdAt, ...extra });
  const progress = async (user) =>
    (await request(app).get("/api/interview/progress").set("Cookie", await authCookie(user))).body.points;

  it("returns an empty list when nothing is finished", async () => {
    const user = await makeUser();
    await Interview.create(validInterview({ userId: user._id })); // still Incomplete
    expect(await progress(user)).toEqual([]);
  });

  it("averages each score per interview and rounds to one decimal", async () => {
    const user = await makeUser();
    await Interview.create(
      done(user, daysAgo(1), { role: "Backend Dev", mode: "HR", finalScore: 7.46, questions: [q(8, 6, 7), q(7, 7, 8), q(7, 6, 8)] }),
    );

    const [point] = await progress(user);

    expect(point).toMatchObject({
      role: "Backend Dev",
      mode: "HR",
      finalScore: 7.5,
      confidence: 7.3, // (8 + 7 + 7) / 3
      communication: 6.3, // (6 + 7 + 6) / 3
      correctness: 7.7, // (7 + 8 + 8) / 3
    });
    expect(point.id).toBeDefined();
  });

  it("works out speaking pace and fillers from the spoken answers only", async () => {
    const user = await makeUser();
    await Interview.create(
      done(user, daysAgo(1), {
        questions: [q(7, 7, 7, spoken(30, 60, 3)), q(7, 7, 7, spoken(30, 60, 1)), q(7, 7, 7)], // last one was typed
      }),
    );

    const [point] = await progress(user);

    expect(point.wpm).toBe(120); // 120 words in 60 seconds
    expect(point.fillersPerAnswer).toBe(2); // 4 fillers over the 2 spoken answers
  });

  it("gives no pace when there is under 5 seconds of speech, and nothing when nothing was spoken", async () => {
    const user = await makeUser();
    await Interview.create(done(user, daysAgo(2), { questions: [q(7, 7, 7, spoken(3, 9, 2))] }));
    await Interview.create(done(user, daysAgo(1), { questions: [q(7, 7, 7)] }));

    const [short, typed] = await progress(user);

    expect(short.wpm).toBeNull();
    expect(short.fillersPerAnswer).toBe(2);
    expect(typed.wpm).toBeNull();
    expect(typed.fillersPerAnswer).toBeNull();
  });

  it("handles a finished interview with no questions", async () => {
    const user = await makeUser();
    await Interview.create(done(user, daysAgo(1), { questions: [] }));

    const [point] = await progress(user);

    expect(point).toMatchObject({ confidence: 0, communication: 0, correctness: 0, wpm: null });
  });

  it("returns the newest 20 interviews, oldest first", async () => {
    const user = await makeUser();
    await Interview.insertMany(
      Array.from({ length: 22 }, (_, i) =>
        done(user, daysAgo(22 - i), { finalScore: i + 1, questions: [] }),
      ),
    );

    const points = await progress(user);

    expect(points).toHaveLength(20);
    expect(points.map((p) => p.finalScore)).toEqual(Array.from({ length: 20 }, (_, i) => i + 3));
  });

  it("only shows the caller's own finished interviews", async () => {
    const user = await makeUser();
    const other = await makeUser();
    await Interview.insertMany([done(user, daysAgo(2), { questions: [] }), done(other, daysAgo(1), { questions: [] })]);

    expect(await progress(user)).toHaveLength(1);
  });
});