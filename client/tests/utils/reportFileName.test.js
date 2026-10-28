import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportFileName } from "../../src/utils/generateReportPdf.js";

describe("reportFileName", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("uses the role and the interview date", () => {
    expect(reportFileName({ role: "Frontend Developer", createdAt: "2026-03-05T08:00:00Z" })).toBe(
      "InterviewFlow-Report-Frontend-Developer-2026-03-05.pdf",
    );
  });

  it("removes characters that are not safe in a file name", () => {
    const name = reportFileName({ role: "C++ / Node.js: \"Lead\"", createdAt: "2026-03-05T08:00:00Z" });
    expect(name).toBe("InterviewFlow-Report-C-Node-js-Lead-2026-03-05.pdf");
    expect(name).not.toMatch(/[\\/:*?"<>|+ ]/);
  });

  it("falls back to 'Interview' when the role is missing or only symbols", () => {
    expect(reportFileName({ createdAt: "2026-03-05T08:00:00Z" })).toContain("-Report-Interview-");
    expect(reportFileName({ role: "///", createdAt: "2026-03-05T08:00:00Z" })).toContain("-Report-Interview-");
    expect(reportFileName(undefined)).toBe("InterviewFlow-Report-Interview-2026-10-26.pdf");
  });

  it("uses today when there is no date, and 'report' when the date is invalid", () => {
    expect(reportFileName({ role: "QA" })).toBe("InterviewFlow-Report-QA-2026-10-26.pdf");
    expect(reportFileName({ role: "QA", createdAt: "not a date" })).toBe("InterviewFlow-Report-QA-report.pdf");
  });
});