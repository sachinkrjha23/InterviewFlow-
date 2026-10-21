// Shared scoring logic. The server uses it for the before/after scores and the
// client uses it for the live score while the user edits. Keep both copies identical.

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasTerm = (haystack, variant) =>
  new RegExp(`(^|[^a-z0-9])${escapeRegex(variant)}(?![a-z0-9+#])`).test(haystack);

export const scoreKeywords = (text, keywords) => {
  const haystack = String(text || "").toLowerCase();
  const matched = [];
  const missing = [];
  let got = 0;
  let total = 0;

  for (const k of keywords) {
    const weight = k.importance === "must" ? 2 : 1;
    total += weight;
    if (k.variants.some((v) => hasTerm(haystack, v))) {
      matched.push(k.term);
      got += weight;
    } else {
      missing.push(k.term);
    }
  }

  return {
    score: total ? Math.round((got / total) * 100) : 0,
    matched,
    missing,
  };
};