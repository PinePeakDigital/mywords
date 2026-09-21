import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  EditorState,
  StateEffect,
  StateField,
  type Range as CmRange,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  type DecorationSet,
} from "@codemirror/view";
import { analyze, type Range } from "./rewrite";

const STORE_KEY = "mywords";
const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

/* --- borrowed spans: recomputed from the diff, never tracked per character --- */

const borrowedMark = Decoration.mark({ class: "cm-borrowed" });
const setBorrowed = StateEffect.define<Range[]>();

const borrowed = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(spans, tr) {
    spans = spans.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setBorrowed)) {
        spans = Decoration.set(
          effect.value.map((r) => borrowedMark.range(r.from, r.to)),
        );
      }
    }
    return spans;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/* --- redaction: paints over a paragraph, leaves the text in place --- */

const redactedLine = Decoration.line({ class: "cm-redacted" });
const toggleRedaction = StateEffect.define<Range>();

/**
 * A redaction is stored as the span of text it covers, not as the line it
 * started on, so it follows that text through edits: split the paragraph and
 * both halves stay covered, delete the text and the bar goes with it.
 */
const redactions = StateField.define<Range[]>({
  create: () => [],
  update(spans, tr) {
    if (tr.docChanged) {
      spans = spans
        .map((span) => ({
          // Bias outwards-in, so text typed at either edge is the writer's own
          // replacement and stays readable.
          from: tr.changes.mapPos(span.from, 1),
          to: tr.changes.mapPos(span.to, -1),
        }))
        .filter((span) => span.to > span.from);
    }
    for (const effect of tr.effects) {
      if (!effect.is(toggleRedaction)) continue;
      const { from, to } = effect.value;
      const overlapping = spans.filter((s) => s.from < to && from < s.to);
      spans = overlapping.length
        ? spans.filter((s) => !overlapping.includes(s))
        : [...spans, effect.value];
    }
    return spans;
  },
});

const redactionDecorations = EditorView.decorations.compute(
  [redactions, "doc"],
  (state) => {
    const lines = new Set<number>();
    for (const span of state.field(redactions)) {
      for (let pos = span.from; ; ) {
        const line = state.doc.lineAt(pos);
        lines.add(line.from);
        if (line.to >= span.to) break;
        pos = line.to + 1;
      }
    }
    const decorations: CmRange<Decoration>[] = [...lines]
      .sort((a, b) => a - b)
      .map((at) => redactedLine.range(at));
    return Decoration.set(decorations);
  },
);

/**
 * The span of the paragraph containing `pos` — a run of consecutive non-blank
 * lines, so that text pasted with hard line wraps redacts as one block rather
 * than one wrapped line at a time.
 */
function paragraphAt(state: EditorState, pos: number): Range {
  const { doc } = state;
  let first = doc.lineAt(pos);
  let last = first;
  if (!first.text.trim()) return { from: first.from, to: first.to };
  while (first.number > 1 && doc.line(first.number - 1).text.trim()) {
    first = doc.line(first.number - 1);
  }
  while (last.number < doc.lines && doc.line(last.number + 1).text.trim()) {
    last = doc.line(last.number + 1);
  }
  return { from: first.from, to: last.to };
}

// One span for the whole selection, so a multi-paragraph selection ends up
// uniformly redacted rather than flipping each paragraph independently.
const redactParagraph = (view: EditorView) => {
  const selection = view.state.selection.main;
  const span = {
    from: paragraphAt(view.state, selection.from).from,
    to: paragraphAt(view.state, selection.to).to,
  };
  // A blank line spans nothing, and an empty span could never be toggled back
  // off: the overlap test below would not even match it against itself.
  if (span.to > span.from) view.dispatch({ effects: toggleRedaction.of(span) });
  return true;
};

/* --- storage: the draft is the only thing the user can't get back --- */

type Saved = { original: string; draft: string };

function restore(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const { original, draft } = JSON.parse(raw) as Partial<Saved>;
    if (typeof original !== "string" || typeof draft !== "string") return null;
    return { original, draft };
  } catch {
    // Unreadable or corrupt: fall back to the paste screen rather than
    // throwing on every load. The bad value is left alone, not deleted.
    return null;
  }
}

const save = (saved: Saved) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(saved));
    return true;
  } catch {
    // Quota exceeded, or storage denied. Keep working, but say so.
    return false;
  }
};

/* --- wiring --- */

let original = "";
let view: EditorView | undefined;

function render(view: EditorView) {
  const draft = view.state.doc.toString();
  const stats = analyze(original, draft);
  view.dispatch({ effects: setBorrowed.of(stats.ranges) });
  el<HTMLProgressElement>("bar").value = stats.rewrittenPct;
  el("stats").textContent =
    `${stats.rewrittenPct}% rewritten · ` +
    `${stats.originalWordsRemaining} of ${stats.originalWordCount} original words remain · ` +
    `${stats.draftWordCount} words total` +
    (save({ original, draft }) ? "" : " · NOT SAVED");
}

// Diffing on every keystroke would put the whole document on the typing path.
let pending: ReturnType<typeof setTimeout>;
const scheduleRender = (view: EditorView) => {
  clearTimeout(pending);
  pending = setTimeout(() => render(view), 150);
};

function openEditor(source: Saved) {
  original = source.original;
  el("paste").hidden = true;
  el("rewrite").hidden = false;

  view = new EditorView({
    parent: el("editor"),
    state: EditorState.create({
      doc: source.draft,
      extensions: [
        history(),
        keymap.of([
          { key: "Mod-Shift-x", run: redactParagraph },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.lineWrapping,
        // The base theme sets a monospace font on the scroller; this is prose.
        EditorView.theme({
          "&": { fontSize: "1.05rem" },
          ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.7" },
          ".cm-content": { padding: "0" },
        }),
        borrowed,
        redactions,
        redactionDecorations,
        EditorView.updateListener.of(
          (u) => u.docChanged && scheduleRender(u.view),
        ),
        // Press and hold to peek. CSS :active would be the natural fit, but
        // CodeMirror's contenteditable mousedown handling suppresses it, so
        // this is hand-rolled. The release is caught on window, because it
        // often lands outside the editor and would otherwise be missed,
        // leaving the peek stuck on.
        EditorView.domEventHandlers({
          mousedown: (event, view) => {
            if (!(event.target as HTMLElement).closest(".cm-redacted")) return;
            view.dom.classList.add("peeking");
            window.addEventListener(
              "mouseup",
              () => view.dom.classList.remove("peeking"),
              { once: true },
            );
          },
        }),
      ],
    }),
  });

  render(view);
  view.focus();
}

el("start").addEventListener("click", () => {
  const original = el<HTMLTextAreaElement>("original").value.trim();
  if (original) openEditor({ original, draft: original });
});

el("redact").addEventListener("click", () => {
  if (!view) return;
  redactParagraph(view);
  view.focus();
});

el("copy").addEventListener("click", async () => {
  const button = el("copy");
  try {
    await navigator.clipboard.writeText(view!.state.doc.toString());
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy failed";
  }
  setTimeout(() => (button.textContent = "Copy all"), 1500);
});

el("restart").addEventListener("click", () => {
  if (!confirm("Discard this rewrite and start over?")) return;
  localStorage.removeItem(STORE_KEY);
  location.reload();
});

const saved = restore();
if (saved) openEditor(saved);
