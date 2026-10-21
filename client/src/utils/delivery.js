export const paceLabel = (wpm) =>
  wpm >= 165 ? "fast" : wpm >= 110 ? "good pace" : wpm > 0 ? "slow" : "";

export const deliverySummary = (d) => {
  const parts = [];
  if (d.wpm > 0) parts.push(`${d.wpm} wpm (${paceLabel(d.wpm)})`);
  parts.push(`${d.fillerCount} filler word${d.fillerCount === 1 ? "" : "s"}`);
  parts.push(`${d.longPauseCount} long pause${d.longPauseCount === 1 ? "" : "s"}`);
  return parts.join(" · ");
};

// combines the per-answer stats for the report
export const summarizeDelivery = (questions) => {
  const items = questions.map((q) => q.delivery).filter((d) => d && d.wordCount > 0);
  if (items.length === 0) return null;

  const words = items.reduce((s, d) => s + d.wordCount, 0);
  const seconds = items.reduce((s, d) => s + d.durationSec, 0);
  const counts = {};
  items.forEach((d) =>
    (d.fillers || []).forEach((f) => {
      counts[f.word] = (counts[f.word] || 0) + f.count;
    }),
  );

  return {
    answers: items.length,
    wpm: seconds >= 5 ? Math.round(words / (seconds / 60)) : 0,
    fillerCount: items.reduce((s, d) => s + d.fillerCount, 0),
    topFillers: Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word, count]) => `${word} ×${count}`),
    longPauseCount: items.reduce((s, d) => s + d.longPauseCount, 0),
  };
};