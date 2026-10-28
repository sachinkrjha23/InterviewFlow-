import { describe, expect, it } from "vitest";
import { computeDelivery } from "../utils/deliveryMetrics.js";

const w = (word, start, end) => ({ word, start, end });

describe("computeDelivery", () => {
  const words = [
    w("So", 0, 0.4),
    w("I", 0.5, 0.6),
    w("built", 0.7, 1.0),
    w("an", 1.1, 1.2),
    w("API", 1.3, 1.8),
    w("um,", 2.0, 2.3),
    w("with", 2.4, 2.7),
    w("Node", 2.8, 3.1),
    w("you", 3.2, 3.4),
    w("know", 3.5, 3.8),
    w("and", 6.0, 6.2), // 2.2 seconds after "know"
    w("MongoDB.", 6.3, 7.0),
  ];

  it("works out pace, fillers and long pauses", () => {
    const d = computeDelivery(words);
    expect(d.wordCount).toBe(12);
    expect(d.durationSec).toBe(7);
    expect(d.wpm).toBe(103); // 12 words over 7 seconds
    expect(d.fillerCount).toBe(2); // "um" and "you know"
    expect(d.fillers).toEqual(
      expect.arrayContaining([
        { word: "um", count: 1 },
        { word: "you know", count: 1 },
      ]),
    );
    expect(d.longPauseCount).toBe(1);
    expect(d.longestPauseSec).toBe(2.2);
  });

  it("returns null when there are no words", () => {
    expect(computeDelivery([])).toBeNull();
  });

  it("gives no pace for a very short recording", () => {
    const d = computeDelivery([w("hello", 0, 0.5), w("there", 0.6, 1.0), w("friend", 1.1, 1.6)]);
    expect(d.wpm).toBe(0);
    expect(d.wordCount).toBe(3);
  });
});