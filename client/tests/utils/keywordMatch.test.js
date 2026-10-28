import { describe, expect, it } from "vitest";
import { scoreKeywords } from "../../src/utils/keywordMatch.js";
import { scoreKeywords as sharedScoreKeywords } from "../../../shared/keywordMatch.js";

const kw = (term, variants, importance = "nice") => ({ term, variants, importance });

describe("client keywordMatch (re-exported from /shared)", () => {
  it("is the very same function the server uses, so the two can never drift", () => {
    expect(scoreKeywords).toBe(sharedScoreKeywords);
  });

  it("gives the live score used while the user edits their resume", () => {
    const keywords = [kw("React", ["react", "reactjs"], "must"), kw("Docker", ["docker"])];
    expect(scoreKeywords("Built the UI with ReactJS", keywords)).toEqual({
      score: 67,
      matched: ["React"],
      missing: ["Docker"],
    });
    expect(scoreKeywords("Built the UI with ReactJS and Docker", keywords).score).toBe(100);
  });
});