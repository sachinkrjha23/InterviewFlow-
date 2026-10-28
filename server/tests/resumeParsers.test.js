import { describe, it, expect } from "vitest";
import { parseKeywords, parseTailored, numbersIn } from "../controllers/resumeController.js";

describe("parseKeywords (reads the AI's keyword list)", () => {
  it("reads the MUST_HAVE and NICE_TO_HAVE lines", () => {
    const reply = "MUST_HAVE: React, Node.js, MongoDB\nNICE_TO_HAVE: Docker, AWS";
    expect(parseKeywords(reply)).toEqual({
      must: ["React", "Node.js", "MongoDB"],
      nice: ["Docker", "AWS"],
    });
  });

  it("ignores letter case and accepts a space instead of an underscore", () => {
    const reply = "must have : React\nNice To Have: Docker";
    expect(parseKeywords(reply)).toEqual({ must: ["React"], nice: ["Docker"] });
  });

  it("splits on commas and semicolons and removes markdown marks and quotes", () => {
    const reply = 'MUST_HAVE: **React**; `Node.js`, "AWS"\nNICE_TO_HAVE: ';
    expect(parseKeywords(reply)).toEqual({ must: ["React", "Node.js", "AWS"], nice: [] });
  });

  it("lists each keyword once, even across both lists and in different letter case", () => {
    const reply = "MUST_HAVE: React, react, Node.js\nNICE_TO_HAVE: REACT, Docker";
    expect(parseKeywords(reply)).toEqual({ must: ["React", "Node.js"], nice: ["Docker"] });
  });

  it("skips empty items and keywords longer than 40 characters", () => {
    const reply = `MUST_HAVE: React, , ${"x".repeat(41)}, Node.js`;
    expect(parseKeywords(reply).must).toEqual(["React", "Node.js"]);
  });

  it("allows at most 15 must-have and 10 nice-to-have keywords", () => {
    const many = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(", ");
    const result = parseKeywords(`MUST_HAVE: ${many(20, "m")}\nNICE_TO_HAVE: ${many(20, "n")}`);
    expect(result.must).toHaveLength(15);
    expect(result.nice).toHaveLength(10);
  });

  it("ignores text before, between and after the two lines", () => {
    const reply = "Sure! Here you go.\nMUST_HAVE: React\nsome note\nNICE_TO_HAVE: Docker\nGood luck!";
    expect(parseKeywords(reply)).toEqual({ must: ["React"], nice: ["Docker"] });
  });

  it("returns empty lists when the labels are missing or the reply is empty", () => {
    expect(parseKeywords("no labels here")).toEqual({ must: [], nice: [] });
    expect(parseKeywords(undefined)).toEqual({ must: [], nice: [] });
  });
});

describe("parseTailored (splits the AI's reply into resume and changes)", () => {
  it("separates the resume text from the list of changes", () => {
    const reply = [
      "### RESUME",
      "ASHA VERMA",
      "SKILLS",
      "- React, Node.js",
      "### CHANGES",
      "- Moved React skills to the top",
      "- Reworded the project bullet",
    ].join("\n");

    expect(parseTailored(reply)).toEqual({
      tailored: "ASHA VERMA\nSKILLS\n- React, Node.js",
      changes: ["Moved React skills to the top", "Reworded the project bullet"],
    });
  });

  it("ignores code fences and the letter case of the headings", () => {
    const reply = "```text\n### resume\nASHA VERMA\n### changes\n- Reordered the skills section\n```";
    expect(parseTailored(reply)).toEqual({
      tailored: "ASHA VERMA",
      changes: ["Reordered the skills section"],
    });
  });

  it("uses the whole reply as the resume when there are no headings", () => {
    expect(parseTailored("  ASHA VERMA\nSKILLS  ")).toEqual({ tailored: "ASHA VERMA\nSKILLS", changes: [] });
  });

  it("returns no changes when the CHANGES part is missing", () => {
    expect(parseTailored("### RESUME\nASHA VERMA")).toEqual({ tailored: "ASHA VERMA", changes: [] });
  });

  it("removes list markers from changes but keeps numbers that are part of the text", () => {
    const reply = [
      "### RESUME",
      "ASHA VERMA",
      "### CHANGES",
      "- 40% faster page loads are now listed first",
      "2x faster builds are listed first",
      "1) Reordered skills to match the job",
      "* Reworded the project bullet",
      "\u2022 Added the missing Docker keyword",
      "   - Indented change line here",
    ].join("\n");

    expect(parseTailored(reply).changes).toEqual([
      "40% faster page loads are now listed first",
      "2x faster builds are listed first",
      "Reordered skills to match the job",
      "Reworded the project bullet",
      "Added the missing Docker keyword",
      "Indented change line here",
    ]);
  });

  it("drops very short lines and keeps at most 12 changes", () => {
    const lines = ["- ok", ...Array.from({ length: 15 }, (_, i) => `- Change number ${i + 1} was made`)];
    const { changes } = parseTailored(`### RESUME\nASHA\n### CHANGES\n${lines.join("\n")}`);

    expect(changes).toHaveLength(12);
    expect(changes[0]).toBe("Change number 1 was made");
  });

  it("gives empty results for nothing", () => {
    expect(parseTailored(null)).toEqual({ tailored: "", changes: [] });
    expect(parseTailored(undefined)).toEqual({ tailored: "", changes: [] });
  });
});

describe("numbersIn (finds numbers the AI might have invented)", () => {
  const found = (text) => [...numbersIn(text)].sort();

  it("collects percentages, multipliers, years, decimals and thousands", () => {
    expect(found("Cut load time by 40%, 3x faster, since 2023, 2.5k users, 1,000 orders, 10+ clients")).toEqual(
      ["10+", "1,000", "2.5k", "2023", "3x", "40%"].sort(),
    );
  });

  it("ignores single digits and normalizes case and spaces", () => {
    expect(found("5 years, 7 projects, 3X and 40 %")).toEqual(["3x", "40%"].sort());
  });

  it("is empty when there are no numbers", () => {
    expect(found("no numbers at all")).toEqual([]);
    expect(found(undefined)).toEqual([]);
  });

  it("makes it easy to spot a new number: present in the output but not in the original", () => {
    const original = numbersIn("Improved speed by 40% in 2023");
    const tailored = numbersIn("Improved speed by 40% in 2023 and 99% uptime");
    const added = [...tailored].filter((n) => !original.has(n));
    expect(added).toEqual(["99%"]);
  });
});