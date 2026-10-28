import { describe, expect, it } from "vitest";
import { scoreKeywords } from "../utils/keywordMatch.js";

const kw = (term, variants, importance = "nice") => ({ term, variants, importance });

describe("scoreKeywords", () => {
  it("finds a keyword through one of its variants and reports the rest as missing", () => {
    const keywords = [kw("React", ["react", "reactjs"], "must"), kw("Docker", ["docker"])];
    const result = scoreKeywords("Built the UI with ReactJS", keywords);
    expect(result.matched).toEqual(["React"]);
    expect(result.missing).toEqual(["Docker"]);
    expect(result.score).toBe(67); // 2 of 3 points, because must-have counts double
  });

  it("is not case sensitive", () => {
    const result = scoreKeywords("MONGODB and mongodb", [kw("MongoDB", ["mongodb"])]);
    expect(result.score).toBe(100);
  });

  it("does not match a keyword inside a longer word", () => {
    const result = scoreKeywords("I know JavaScript well", [kw("Java", ["java"])]);
    expect(result.matched).toEqual([]);
    expect(result.score).toBe(0);
  });

  it("handles keywords with special characters", () => {
    const result = scoreKeywords("Wrote C++ services", [kw("C++", ["c++", "cpp"])]);
    expect(result.matched).toEqual(["C++"]);
  });

  it("returns 0 when there are no keywords", () => {
    expect(scoreKeywords("anything", []).score).toBe(0);
  });

  it("weights must-have keywords double", () => {
    const keywords = [kw("A", ["aaa"], "must"), kw("B", ["bbb"], "nice")];
    expect(scoreKeywords("aaa", keywords).score).toBe(67);
    expect(scoreKeywords("bbb", keywords).score).toBe(33);
  });
});