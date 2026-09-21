# MyWords

A tool for rewriting someone else's text into your own words, showing at a glance how much of their wording survives.

## Language

**Original**:
The source text pasted in at the start. Fixed for the life of a Document; never edited.
_Avoid_: source, input, "the original text" when referring to a span rather than the whole

**Draft**:
The single editable body of text the writer works in, seeded with a copy of the Original.
_Avoid_: my text, new text, output, rewrite

**Document**:
An Original paired with the Draft being written from it. Only one exists at a time.

**Borrowed**:
A span of the Draft that still carries the Original's wording — a run of consecutive words appearing in both. Marked in the editor.
_Avoid_: original text, unchanged, untouched, plagiarised

**Run threshold**:
The minimum number of consecutive matching words for a span to count as Borrowed. Exists so that incidental matches on common words are not counted.

**Redaction**:
A paragraph of the Draft painted over so its words cannot be read, so the writer cannot crib from wording they are in the middle of replacing. Toggled per paragraph by the writer, never automatic.
_Avoid_: blackout, hidden, masked, censored

**Rewritten**:
The share of the Original's words no longer Borrowed anywhere in the Draft. What the progress bar shows.
_Avoid_: progress, completion, done
