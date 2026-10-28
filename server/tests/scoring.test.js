import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/AiService.js", () => ({ askAi: vi.fn() }));

import { askAi } from "../services/AiService.js";
import { buildFollowUpRules, parseScoring, scoreAnswer } from "../services/scoring.js";

const validJson = JSON.stringify({
  confidence: 7,
  communication: 6,
  correctness: 8,
  finalscore: 7,
  feedback: "Good use of examples.",
  followup: "",
});

describe("parseScoring", () => {
  it("reads plain JSON and works out the final score itself", () => {
    const r = parseScoring(validJson);
    expect(r.confidence).toBe(7);
    expect(r.score).toBe(7);
    expect(r.feedback).toBe("Good use of examples.");
  });

  it("reads JSON inside a markdown fence", () => {
    expect(parseScoring("```json\n" + validJson + "\n```").score).toBe(7);
  });

  it("finds JSON surrounded by other text", () => {
    expect(parseScoring("Here is the result: " + validJson + " Done.").score).toBe(7);
  });

  it("keeps every score between 0 and 10", () => {
    const r = parseScoring(
      JSON.stringify({ confidence: 15, communication: -3, correctness: "x", feedback: "" }),
    );
    expect(r.confidence).toBe(10);
    expect(r.communication).toBe(0);
    expect(r.correctness).toBe(0);
  });

  it("throws on a reply that is not scoring JSON", () => {
    expect(() => parseScoring("User Safety: safe")).toThrow("AI returned invalid JSON");
  });
});

describe("buildFollowUpRules", () => {
  it("tells the AI to leave the follow-up empty when none is allowed", () => {
    expect(buildFollowUpRules("Technical", false)).toContain("empty string");
  });

  it("asks for a mode-specific follow-up when allowed", () => {
    expect(buildFollowUpRules("HR", true)).toContain("HR mode");
    expect(buildFollowUpRules("Technical", true)).toContain("Technical mode");
  });
});

describe("scoreAnswer", () => {
  const input = {
    role: "Developer",
    experience: "Fresher",
    mode: "Technical",
    question: "What is a closure?",
    difficulty: "medium",
    timeLimit: 90,
    timeTaken: 30,
    answer: "A function that remembers its scope.",
  };

  beforeEach(() => {
    askAi.mockReset();
  });

  it("retries when the AI replies with something that is not JSON", async () => {
    askAi.mockResolvedValueOnce("User Safety: safe").mockResolvedValueOnce(validJson);
    const meta = {};
    const result = await scoreAnswer(input, meta);
    expect(result.score).toBe(7);
    expect(askAi).toHaveBeenCalledTimes(2);
    expect(meta.badReplies).toBe(1);
  });

  it("gives up after three bad replies", async () => {
    askAi.mockResolvedValue("nonsense");
    await expect(scoreAnswer(input)).rejects.toThrow();
    expect(askAi).toHaveBeenCalledTimes(3);
  });
});