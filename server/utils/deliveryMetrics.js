const LONG_PAUSE_SEC = 1.5;
const HARD_FILLERS = new Set(["um", "umm", "uh", "uhh", "er", "erm", "ah", "hmm", "mm"]);
const SOFT_FILLERS = new Set(["basically", "literally"]);
const PHRASE_FILLERS = [
  ["you", "know"],
  ["i", "mean"],
];

const norm = (w) => String(w).toLowerCase().replace(/[^a-z']/g, "");
const round1 = (n) => Math.round(n * 10) / 10;

export const computeDelivery = (words) => {
  const tokens = words
    .map((w) => ({ t: norm(w.word), start: w.start, end: w.end }))
    .filter((w) => w.t);
  if (tokens.length === 0) return null;

  const counts = new Map();
  const bump = (name) => counts.set(name, (counts.get(name) || 0) + 1);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].t;
    if (HARD_FILLERS.has(t) || SOFT_FILLERS.has(t)) {
      bump(t);
      continue;
    }
    for (const [a, b] of PHRASE_FILLERS) {
      if (t === a && tokens[i + 1]?.t === b) {
        bump(`${a} ${b}`);
        i += 1;
        break;
      }
    }
  }

  let longPauseCount = 0;
  let longestPause = 0;
  for (let i = 1; i < tokens.length; i++) {
    const gap = tokens[i].start - tokens[i - 1].end;
    if (gap > longestPause) longestPause = gap;
    if (gap >= LONG_PAUSE_SEC) longPauseCount += 1;
  }

  const span = tokens[tokens.length - 1].end - tokens[0].start;
  const wpm =
    span >= 5 && tokens.length >= 10 ? Math.round(tokens.length / (span / 60)) : 0;

  const fillers = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));

  return {
    durationSec: round1(Math.max(0, span)),
    wordCount: tokens.length,
    wpm,
    fillerCount: [...counts.values()].reduce((s, n) => s + n, 0),
    fillers,
    longPauseCount,
    longestPauseSec: round1(Math.max(0, longestPause)),
  };
};