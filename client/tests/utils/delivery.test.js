import { describe, expect, it } from "vitest";
import { deliverySummary, paceLabel, summarizeDelivery } from "../../src/utils/delivery.js";

const d = (over = {}) => ({
  wordCount: 100,
  durationSec: 60,
  fillerCount: 0,
  fillers: [],
  longPauseCount: 0,
  ...over,
});

describe("paceLabel", () => {
  it("labels slow, good and fast at the boundaries", () => {
    expect(paceLabel(0)).toBe("");
    expect(paceLabel(1)).toBe("slow");
    expect(paceLabel(109)).toBe("slow");
    expect(paceLabel(110)).toBe("good pace");
    expect(paceLabel(164)).toBe("good pace");
    expect(paceLabel(165)).toBe("fast");
  });
});

describe("deliverySummary", () => {
  it("joins pace, filler words and long pauses", () => {
    expect(deliverySummary({ wpm: 130, fillerCount: 3, longPauseCount: 2 })).toBe(
      "130 wpm (good pace) · 3 filler words · 2 long pauses",
    );
  });

  it("uses singular words for 1 and leaves out the pace when wpm is 0", () => {
    expect(deliverySummary({ wpm: 0, fillerCount: 1, longPauseCount: 1 })).toBe("1 filler word · 1 long pause");
  });

  it("uses plural words for 0", () => {
    expect(deliverySummary({ wpm: 0, fillerCount: 0, longPauseCount: 0 })).toBe("0 filler words · 0 long pauses");
  });
});

describe("summarizeDelivery", () => {
  it("returns null when no answer has voice data", () => {
    expect(summarizeDelivery([])).toBeNull();
    expect(summarizeDelivery([{ delivery: null }, {}, { delivery: d({ wordCount: 0 }) }])).toBeNull();
  });

  it("ignores typed answers and adds up the voice ones", () => {
    const result = summarizeDelivery([
      { delivery: d({ wordCount: 120, durationSec: 60, fillerCount: 2, longPauseCount: 1 }) },
      { delivery: null },
      { delivery: d({ wordCount: 60, durationSec: 30, fillerCount: 1, longPauseCount: 2 }) },
    ]);
    expect(result.answers).toBe(2);
    expect(result.wpm).toBe(120); // 180 words in 90 seconds
    expect(result.fillerCount).toBe(3);
    expect(result.longPauseCount).toBe(3);
  });

  it("gives wpm 0 when there is too little speaking time to trust", () => {
    const result = summarizeDelivery([{ delivery: d({ wordCount: 10, durationSec: 4 }) }]);
    expect(result.wpm).toBe(0);
  });

  it("lists the three most used filler words, most used first", () => {
    const result = summarizeDelivery([
      {
        delivery: d({
          fillerCount: 10,
          fillers: [
            { word: "um", count: 2 },
            { word: "like", count: 5 },
            { word: "basically", count: 1 },
            { word: "you know", count: 2 },
          ],
        }),
      },
      { delivery: d({ fillerCount: 3, fillers: [{ word: "um", count: 3 }] }) },
    ]);
    expect(result.topFillers).toEqual(["um ×5", "like ×5", "you know ×2"]);
  });
});