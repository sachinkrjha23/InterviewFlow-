import { describe, it, expect } from "vitest";
import {
  parseQuestions,
  cleanDelivery,
  toPlainText,
  parseModelAnswers,
} from "../controllers/interviewController.js";

describe("parseQuestions", () => {
  it("reads one question per line", () => {
    const reply = "What is a closure in JavaScript?\nHow does React batch state updates?";
    expect(parseQuestions(reply)).toEqual([
      "What is a closure in JavaScript?",
      "How does React batch state updates?",
    ]);
  });

  it("removes list markers: numbers, brackets, dashes, stars and bullets", () => {
    const reply = [
      "1. What is a closure in JavaScript?",
      "2) How does React batch state updates?",
      "3: Explain the event loop in simple words.",
      "- Why would you choose MongoDB here?",
      "* How do you handle errors in Express?",
      "\u2022 What does the useEffect cleanup do?",
    ].join("\n");

    expect(parseQuestions(reply)).toEqual([
      "What is a closure in JavaScript?",
      "How does React batch state updates?",
      "Explain the event loop in simple words.",
      "Why would you choose MongoDB here?",
      "How do you handle errors in Express?",
      "What does the useEffect cleanup do?",
    ]);
  });

  it("removes bold marks and quotation marks around a question", () => {
    const reply = [
      "**1. What is a closure in JavaScript?**",
      '"How does React batch state updates?"',
      "\u201CExplain the event loop in simple words.\u201D",
    ].join("\n");

    expect(parseQuestions(reply)).toEqual([
      "What is a closure in JavaScript?",
      "How does React batch state updates?",
      "Explain the event loop in simple words.",
    ]);
  });

  it("drops intro lines, lines ending with a colon, blank lines and very short lines", () => {
    const reply = [
      "Here are your questions:",
      "Sure, happy to help with that today",
      "Certainly! These should work well",
      "Below you will find the list",
      "",
      "Technical questions for you:",
      "Too short",
      "What is a closure in JavaScript?",
    ].join("\n");

    expect(parseQuestions(reply)).toEqual(["What is a closure in JavaScript?"]);
  });

  it("keeps only the first 6 questions", () => {
    const reply = Array.from({ length: 9 }, (_, i) => `Question number ${i + 1} about JavaScript?`).join("\n");
    const result = parseQuestions(reply);
    expect(result).toHaveLength(6);
    expect(result[5]).toBe("Question number 6 about JavaScript?");
  });

  it("does not cut a question that starts with a year", () => {
    expect(parseQuestions("2024 brought many React changes, which matter most?")).toEqual([
      "2024 brought many React changes, which matter most?",
    ]);
  });

  it("returns an empty list for nothing usable", () => {
    expect(parseQuestions("")).toEqual([]);
    expect(parseQuestions(undefined)).toEqual([]);
    expect(parseQuestions(null)).toEqual([]);
  });
});

describe("cleanDelivery (speaking stats sent by the browser)", () => {
  const good = {
    durationSec: 42.5,
    wordCount: 90,
    wpm: 130,
    fillerCount: 4,
    fillers: [{ word: "um", count: 3 }],
    longPauseCount: 1,
    longestPauseSec: 2.5,
  };

  it("keeps sensible numbers as they are", () => {
    expect(cleanDelivery(good)).toEqual(good);
  });

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["a string", "fast"],
    ["a number", 5],
    ["no word count", { wpm: 120 }],
    ["a zero word count", { wordCount: 0, wpm: 120 }],
    ["a negative word count", { wordCount: -5 }],
    ["a word count that is not a number", { wordCount: "abc" }],
  ])("returns null for %s", (_name, input) => {
    expect(cleanDelivery(input)).toBeNull();
  });

  it("caps every number at a sane maximum", () => {
    const result = cleanDelivery({
      durationSec: 99999,
      wordCount: 99999,
      wpm: 99999,
      fillerCount: 99999,
      longPauseCount: 99999,
      longestPauseSec: 99999,
    });

    expect(result).toMatchObject({
      durationSec: 600,
      wordCount: 2000,
      wpm: 400,
      fillerCount: 500,
      longPauseCount: 100,
      longestPauseSec: 600,
    });
  });

  it("turns negative or non-numeric values into 0", () => {
    const result = cleanDelivery({ wordCount: 10, durationSec: -3, wpm: "fast", fillerCount: -1, longestPauseSec: NaN });
    expect(result).toMatchObject({ durationSec: 0, wpm: 0, fillerCount: 0, longestPauseSec: 0 });
  });

  it("accepts numbers sent as text, and rounds whole-number fields", () => {
    const result = cleanDelivery({ wordCount: "50.6", wpm: "120.4", fillerCount: "2.5" });
    expect(result).toMatchObject({ wordCount: 51, wpm: 120, fillerCount: 3 });
  });

  it("keeps at most 5 filler words, each cut to 20 characters", () => {
    const fillers = Array.from({ length: 8 }, (_, i) => ({ word: "um".repeat(15) + i, count: 2 }));
    const result = cleanDelivery({ wordCount: 10, fillers });

    expect(result.fillers).toHaveLength(5);
    expect(result.fillers.every((f) => f.word.length <= 20)).toBe(true);
  });

  it("copes with missing or broken filler entries", () => {
    expect(cleanDelivery({ wordCount: 10, fillers: "um" }).fillers).toEqual([]);
    expect(cleanDelivery({ wordCount: 10 }).fillers).toEqual([]);
    expect(cleanDelivery({ wordCount: 10, fillers: [null, { count: 9999 }] }).fillers).toEqual([
      { word: "", count: 0 },
      { word: "", count: 500 },
    ]);
  });
});

describe("toPlainText (model answers shown and saved as plain text)", () => {
  it("replaces curly quotes, dashes and the ellipsis with plain ones", () => {
    expect(toPlainText("It\u2019s \u201Cgood\u201D \u2013 really \u2014 so\u2026")).toBe('It\'s "good" - really - so...');
  });

  it("removes markdown marks and list markers at the start of a line", () => {
    expect(toPlainText("**Bold** and `code` and # heading\n- first\n\u2022 second\n> quoted")).toBe(
      "Bold and code and heading first second quoted",
    );
  });

  it("keeps hyphens and dashes that are part of the sentence", () => {
    expect(toPlainText("A well-known fix - and -5 degrees")).toBe("A well-known fix - and -5 degrees");
  });

  it("drops emoji and accented characters, then tidies the spaces", () => {
    expect(toPlainText("Hello \uD83D\uDE00 world caf\u00E9")).toBe("Hello world caf");
  });

  it("joins lines and collapses extra spaces", () => {
    expect(toPlainText("  one\n\n  two   three \n")).toBe("one two three");
  });

  it("cuts the text to 1500 characters", () => {
    expect(toPlainText("a".repeat(2000))).toHaveLength(1500);
  });

  it("gives an empty string for nothing", () => {
    expect(toPlainText(undefined)).toBe("");
    expect(toPlainText(null)).toBe("");
  });
});

describe("parseModelAnswers", () => {
  const targets = (...indexes) => indexes.map((index) => ({ index, q: { question: `Question ${index}?` } }));
  // the function returns the raw text of each section, so compare it trimmed
  const trimmed = (found) => Object.fromEntries(Object.entries(found).map(([k, v]) => [k, String(v).trim()]));

  it("reads '### n' sections", () => {
    const reply = "### 0\nAnswer zero.\n\n### 1\nAnswer one.";
    expect(trimmed(parseModelAnswers(reply, targets(0, 1)))).toEqual({ 0: "Answer zero.", 1: "Answer one." });
  });

  it.each([
    ["## Question 2:", 2],
    ["### [3]", 3],
    ["#### 4.", 4],
    ["### 5)", 5],
  ])("understands the heading style '%s'", (heading, index) => {
    const found = parseModelAnswers(`${heading}\nThe answer text.`, targets(index));
    expect(trimmed(found)).toEqual({ [index]: "The answer text." });
  });

  it("only returns the questions that were asked for", () => {
    const reply = "### 0\nAnswer zero.\n\n### 7\nAnswer for a question nobody asked.";
    expect(trimmed(parseModelAnswers(reply, targets(0)))).toEqual({ 0: "Answer zero." });
  });

  it("ignores code fences around the reply", () => {
    const reply = "```\n### 0\nAnswer zero.\n```";
    expect(trimmed(parseModelAnswers(reply, targets(0)))).toEqual({ 0: "Answer zero." });
  });

  it("falls back to JSON: an answers object, a plain array, or JSON inside other text", () => {
    const asObject = JSON.stringify({ answers: [{ index: 0, answer: "A" }, { index: 1, answer: "B" }] });
    expect(parseModelAnswers(asObject, targets(0, 1))).toEqual({ 0: "A", 1: "B" });

    const asArray = JSON.stringify([{ index: 1, answer: "B" }]);
    expect(parseModelAnswers(asArray, targets(1))).toEqual({ 1: "B" });

    expect(parseModelAnswers(`Here you go: ${asObject} Hope it helps!`, targets(0))).toEqual({ 0: "A" });
  });

  it("accepts an index sent as text in JSON and skips indexes nobody asked for", () => {
    const reply = JSON.stringify({ answers: [{ index: "1", answer: "B" }, { index: 9, answer: "X" }] });
    expect(parseModelAnswers(reply, targets(1))).toEqual({ 1: "B" });
  });

  it("with one question, treats plain text as the answer", () => {
    expect(parseModelAnswers("Just a plain answer.", targets(4))).toEqual({ 4: "Just a plain answer." });
    // broken JSON-looking text is treated the same way
    expect(parseModelAnswers("{ not really json }", targets(4))).toEqual({ 4: "{ not really json }" });
  });

  it("with several questions, plain text works only if the paragraph count matches", () => {
    expect(parseModelAnswers("First answer.\n\nSecond answer.", targets(2, 5))).toEqual({
      2: "First answer.",
      5: "Second answer.",
    });
    expect(parseModelAnswers("Only one paragraph.", targets(2, 5))).toEqual({});
    expect(parseModelAnswers("A.\n\nB.\n\nC.", targets(2, 5))).toEqual({});
  });

  it("gives an empty answer for an empty reply (the caller rejects it as too short)", () => {
    expect(parseModelAnswers(null, targets(0))).toEqual({ 0: "" });
    expect(parseModelAnswers("", targets(0, 1))).toEqual({});
  });
});