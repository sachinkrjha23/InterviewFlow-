import { describe, expect, it, vi } from "vitest";
import * as jspdfModule from "jspdf";
import { buildReportPdf, generateReportPdf } from "../../src/utils/generateReportPdf.js";

// the real jsPDF, except save() only remembers the file name (jsdom cannot download files)
vi.mock("jspdf", async (importOriginal) => {
  const real = await importOriginal();
  const savedNames = [];
  class JsPdfWithoutDownload extends real.jsPDF {
    constructor(...args) {
      super(...args);
      this.save = (name) => savedNames.push(name);
    }
  }
  return { ...real, jsPDF: JsPdfWithoutDownload, default: JsPdfWithoutDownload, savedNames };
});

const { jsPDF } = jspdfModule;

const report = {
  role: "Frontend Developer",
  experience: "Fresher",
  mode: "Technical",
  createdAt: "2026-03-05T08:00:00Z",
  status: "Completed",
  totalQuestions: 3,
  finalScore: 7.5,
  confidence: 7,
  communication: 8,
  correctness: 7,
  questionWiseScore: [
    { question: "What is a closure?", answer: "A function with its scope.", score: 8, feedback: "Clear.", modelAnswer: "A closure is...", confidence: 8, communication: 8, correctness: 8 },
    { question: "Can you give an example?", answer: "", isFollowUp: true, score: 3, confidence: 3, communication: 3, correctness: 3 },
    { question: "What is the event loop?", answer: "It runs tasks \uD83D\uDE00", score: 6, confidence: 6, communication: 6, correctness: 6 },
  ],
};

// One smoke test only: we check the PDF is produced and the key text is in it, not how it looks.
describe("report PDF (smoke test)", () => {
  it("builds a real PDF with numbered questions that skip follow-ups", () => {
    const doc = buildReportPdf(report, jsPDF);
    const raw = doc.output();

    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw).toContain("Frontend Developer");
    expect(raw).toContain("QUESTION 1");
    expect(raw).toContain("FOLLOW-UP");
    expect(raw).toContain("QUESTION 2");
    expect(raw).not.toContain("QUESTION 3");
    expect(raw).toContain("Page 1 of 1");
  });

  it("generateReportPdf saves the file under the report's file name", async () => {
    await generateReportPdf(report);
    expect(jspdfModule.savedNames).toEqual(["InterviewFlow-Report-Frontend-Developer-2026-03-05.pdf"]);
  });
});