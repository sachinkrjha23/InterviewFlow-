import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

vi.mock("../services/AiService.js", () => ({ askAi: vi.fn() }));

import { askAi } from "../services/AiService.js";
import app from "../app.js";
import genToken from "../config/token.js";
import { makePdf } from "./helpers/pdf.js";

// these routes only need a valid login cookie, not a database
const cookie = async () => `token=${await genToken("507f1f77bcf86cd799439011")}`;

const RESUME_LINES = [
  "Asha Verma - Full Stack Developer",
  "Built REST APIs with Node.js and Express for a payments dashboard.",
  "Skills: JavaScript, React, MongoDB, Docker",
];

const upload = async (path, buffer, { filename = "cv.pdf", contentType = "application/pdf" } = {}) =>
  request(app)
    .post(path)
    .set("Cookie", await cookie())
    .attach("resume", buffer, { filename, contentType });

beforeEach(() => {
  askAi.mockReset();
});

describe("POST /api/interview/resume (analyzeResume)", () => {
  it("reads the PDF and returns the fields the AI found", async () => {
    askAi.mockResolvedValue(
      '```json\n{"role":"Full Stack Developer","experience":"2 years","projects":["Payments dashboard"],"skills":["react","node.js"]}\n```',
    );

    const res = await upload("/api/interview/resume", makePdf(RESUME_LINES));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      role: "Full Stack Developer",
      experience: "2 years",
      projects: ["Payments dashboard"],
      skills: ["react", "node.js"],
    });
    expect(res.body.resumeText).toContain("Built REST APIs with Node.js");
    // the AI got the resume text, not the file
    expect(askAi.mock.calls[0][0][1].content).toContain("Docker");
  });

  it("rejects a fake PDF (right type header, wrong file contents)", async () => {
    const res = await upload("/api/interview/resume", Buffer.from("this is just text, not a pdf"));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/isn't a valid pdf/i);
    expect(askAi).not.toHaveBeenCalled();
  });

  it("rejects a file that isn't sent as a PDF", async () => {
    const res = await upload("/api/interview/resume", makePdf(RESUME_LINES), {
      filename: "cv.png",
      contentType: "image/png",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only pdf/i);
  });

  it("asks for a file when none is sent", async () => {
    const res = await request(app)
      .post("/api/interview/resume")
      .set("Cookie", await cookie())
      .field("note", "no file here");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/resume required/i);
  });

  it("says so when the PDF has no readable text", async () => {
    const res = await upload("/api/interview/resume", makePdf(["Hi"]));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/scanned|image/i);
  });

  it("answers 500 with a short message when the AI reply is not JSON", async () => {
    askAi.mockResolvedValue("Sorry, I cannot help with that.");
    const res = await upload("/api/interview/resume", makePdf(RESUME_LINES));
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/invalid json/i);
  });

  it("needs a login", async () => {
    const res = await request(app)
      .post("/api/interview/resume")
      .attach("resume", makePdf(RESUME_LINES), { filename: "cv.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/resume/extract (extractResumeText)", () => {
  it("returns the text and keeps the line breaks", async () => {
    const res = await upload("/api/resume/extract", makePdf(RESUME_LINES));
    expect(res.status).toBe(200);
    expect(res.body.resumeText).toContain("Built REST APIs with Node.js");
    expect(res.body.resumeText.length).toBeGreaterThan(50);
  });

  it("rejects a non-PDF", async () => {
    const res = await upload("/api/resume/extract", Buffer.from("plain text"));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/isn't a valid pdf/i);
  });
});