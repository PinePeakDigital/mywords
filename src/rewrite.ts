import { diffWords } from "diff";

export type Range = { from: number; to: number };

export type Stats = {
  /** Spans of the draft still carrying the original's wording. */
  ranges: Range[];
  rewrittenPct: number;
  originalWordsRemaining: number;
  originalWordCount: number;
  draftWordCount: number;
};

/**
 * Consecutive matching words needed before a span counts as borrowed, so that
 * incidental hits on "the" and "and" don't inflate the number.
 */
export const RUN_THRESHOLD = 3; // ponytail: a knob, tune once real numbers show up

const hasWordChar = (token: string) => /[\p{L}\p{N}]/u.test(token);

const countWords = (text: string) =>
  text.split(/\s+/).filter(hasWordChar).length;

/**
 * The span of `value` running from its first word-bearing token to its last, so
 * that a run neither starts nor ends on stray punctuation the diff happened to
 * match. Null when there is nothing but punctuation.
 */
function wordSpan(value: string) {
  const tokens = [...value.matchAll(/\S+/g)];
  let first = 0;
  let last = tokens.length - 1;
  while (first <= last && !hasWordChar(tokens[first][0])) first++;
  while (last >= first && !hasWordChar(tokens[last][0])) last--;
  if (first > last) return null;
  const start = tokens[first].index;
  const end = tokens[last].index + tokens[last][0].length;
  const words = tokens
    .slice(first, last + 1)
    .filter((token) => hasWordChar(token[0])).length;
  return { start, end, words };
}

export function analyze(
  original: string,
  draft: string,
  runThreshold = RUN_THRESHOLD,
): Stats {
  const originalWordCount = countWords(original);
  const ranges: Range[] = [];
  let borrowedWords = 0;
  let pos = 0;

  for (const part of diffWords(original, draft)) {
    if (part.removed) continue; // original only: already gone from the draft
    if (!part.added) {
      const span = wordSpan(part.value);
      if (span && span.words >= runThreshold) {
        borrowedWords += span.words;
        ranges.push({ from: pos + span.start, to: pos + span.end });
      }
    }
    pos += part.value.length;
  }

  return {
    ranges,
    rewrittenPct: originalWordCount
      ? Math.round((1 - borrowedWords / originalWordCount) * 100)
      : 0,
    originalWordsRemaining: borrowedWords,
    originalWordCount,
    draftWordCount: countWords(draft),
  };
}
