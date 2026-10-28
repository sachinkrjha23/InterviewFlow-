import { describe, expect, it } from "vitest";
import { pdfText } from "../../src/utils/generateReportPdf.js";

describe("pdfText (makes text safe for the built-in PDF fonts)", () => {
  it("turns null and undefined into an empty string", () => {
    expect(pdfText(null)).toBe("");
    expect(pdfText(undefined)).toBe("");
  });

  it("replaces smart quotes, dashes, ellipsis and bullets with plain ones", () => {
    expect(pdfText("\u201CHi\u201D \u2018there\u2019 \u2013 ok\u2026")).toBe("\"Hi\" 'there' - ok...");
    expect(pdfText("\u2022 one\n\u25CF two")).toBe("- one\n- two");
  });

  it("removes markdown bold, inline code and code fences", () => {
    expect(pdfText("**Strong** and `code`")).toBe("Strong and code");
    expect(pdfText("```js\nconst a = 1;\n```")).toBe("const a = 1;\n");
  });

  it("drops emoji and other characters the font cannot draw", () => {
    expect(pdfText("Great job \uD83D\uDE00 team \u4E2D")).toBe("Great job  team ");
  });

  it("keeps accented Latin letters", () => {
    expect(pdfText("caf\u00E9 r\u00E9sum\u00E9")).toBe("caf\u00E9 r\u00E9sum\u00E9");
  });

  it("makes Windows line endings plain and turns tabs into spaces", () => {
    expect(pdfText("a\r\nb\rc\td")).toBe("a\nb\nc    d");
  });
});