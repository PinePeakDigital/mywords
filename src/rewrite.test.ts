import { expect, test } from "vitest";
import { analyze } from "./rewrite";

const ORIGINAL = "the quick brown fox jumps over the lazy dog";

test("an untouched draft is entirely borrowed", () => {
  const s = analyze(ORIGINAL, ORIGINAL);
  expect(s.rewrittenPct).toBe(0);
  expect(s.originalWordsRemaining).toBe(9);
  expect(s.ranges).toEqual([{ from: 0, to: ORIGINAL.length }]);
});

test("wording retyped verbatim still counts as borrowed", () => {
  // Same words, arrived at by typing rather than by surviving: still theirs.
  const s = analyze(ORIGINAL, ["the quick brown fox", "jumps over the lazy dog"].join(" "));
  expect(s.rewrittenPct).toBe(0);
});

test("deleting the original counts as progress", () => {
  const s = analyze(ORIGINAL, "");
  expect(s.rewrittenPct).toBe(100);
  expect(s.draftWordCount).toBe(0);
});

test("a rewrite that keeps a long run highlights only that run", () => {
  const draft = "a sluggish hound was cleared by the quick brown fox jumps over nothing";
  const s = analyze(ORIGINAL, draft);
  expect(s.ranges.map((r) => draft.slice(r.from, r.to))).toEqual([
    "the quick brown fox jumps over",
  ]);
  expect(s.originalWordsRemaining).toBe(6);
  expect(s.rewrittenPct).toBe(33);
});

test("matches shorter than the run threshold are not borrowed", () => {
  const s = analyze(ORIGINAL, "a hare bolted over the hedge");
  expect(s.ranges).toEqual([]);
  expect(s.rewrittenPct).toBe(100);
});

test("the threshold is adjustable", () => {
  const s = analyze(ORIGINAL, "a hare bolted over the hedge", 2);
  expect(s.originalWordsRemaining).toBe(2);
});

test("an empty original does not divide by zero", () => {
  expect(analyze("", "brand new words").rewrittenPct).toBe(0);
});

test("a run does not start or end on stray punctuation", () => {
  // The rewritten sentence happens to end in the original's full stop.
  const draft = "Foxes bolt at dawn. the lazy dog sleeps beneath the oak";
  const s = analyze("the fox jumps. the lazy dog sleeps beneath the oak", draft);
  expect(s.ranges.map((r) => draft.slice(r.from, r.to))).toEqual([
    "the lazy dog sleeps beneath the oak",
  ]);
  expect(s.originalWordsRemaining).toBe(7);
});

test("punctuation alone is never borrowed", () => {
  expect(analyze("a. b. c. d.", "z. y. x. w.").ranges).toEqual([]);
});
