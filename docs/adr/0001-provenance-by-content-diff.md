# Borrowed spans are found by diffing, not by tracking where characters came from

The alternative was to tag the characters loaded from the Original and follow them through every edit, so that anything typed by the writer counts as theirs. We diff the Original against the Draft instead, and treat any matching run of words as Borrowed regardless of how it got there, because the question the tool answers is "whose words are these", and a sentence retyped from memory is still the Original's wording. It also means the whole document state is two strings, so undo, redo and paste need no provenance bookkeeping that could silently corrupt the number the tool exists to show.

## Consequences

Word-level matching alone would count incidental matches on common words, so a span counts as Borrowed only at or above the run threshold — a tuned knob, not a truth about the domain.
