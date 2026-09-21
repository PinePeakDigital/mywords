import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
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
const toggleRedaction = StateEffect.define<number>();

const redactions = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(lines, tr) {
    if (tr.docChanged) {
      // Follow the redacted text rather than the offset, so splitting a
      // paragraph can't slide the bar off and reveal what it was covering.
      const starts: number[] = [];
      lines.between(0, tr.startState.doc.length, (from) => {
        const start = tr.state.doc.lineAt(tr.changes.mapPos(from, 1)).from;
        if (starts.at(-1) !== start) starts.push(start);
      });
      lines = Decoration.set(starts.map((at) => redactedLine.range(at)));
    }
    for (const effect of tr.effects) {
      if (!effect.is(toggleRedaction)) continue;
      const at = effect.value;
      let redacted = false;
      lines.between(at, at, () => {
        redacted = true;
        return false;
      });
      lines = redacted
        ? lines.update({ filter: (from) => from !== at })
        : lines.update({ add: [redactedLine.range(at)] });
    }
    return lines;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const redactParagraph = (view: EditorView) => {
  const { from, to } = view.state.selection.main;
  const effects = [];
  for (let n = view.state.doc.lineAt(from).number; n <= view.state.doc.lineAt(to).number; n++) {
    effects.push(toggleRedaction.of(view.state.doc.line(n).from));
  }
  view.dispatch({ effects });
  return true;
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
    `${stats.draftWordCount} words total`;
  localStorage.setItem(STORE_KEY, JSON.stringify({ original, draft }));
}

// Diffing on every keystroke would put the whole document on the typing path.
let pending: ReturnType<typeof setTimeout>;
const scheduleRender = (view: EditorView) => {
  clearTimeout(pending);
  pending = setTimeout(() => render(view), 150);
};

function openEditor(source: string, draft: string) {
  original = source;
  el("paste").hidden = true;
  el("rewrite").hidden = false;

  view = new EditorView({
    parent: el("editor"),
    state: EditorState.create({
      doc: draft,
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
        EditorView.updateListener.of((u) => u.docChanged && scheduleRender(u.view)),
        EditorView.domEventHandlers({
          mousedown: (e, v) => {
            if ((e.target as HTMLElement).closest(".cm-redacted")) {
              v.dom.classList.add("peeking");
            }
          },
          mouseup: (_, v) => {
            v.dom.classList.remove("peeking");
          },
          mouseleave: (_, v) => {
            v.dom.classList.remove("peeking");
          },
        }),
      ],
    }),
  });

  render(view);
  view.focus();
}

el("start").addEventListener("click", () => {
  const source = el<HTMLTextAreaElement>("source").value.trim();
  if (source) openEditor(source, source);
});

el("redact").addEventListener("click", () => {
  if (!view) return;
  redactParagraph(view);
  view.focus();
});

el("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(view!.state.doc.toString());
  el("copy").textContent = "Copied";
  setTimeout(() => (el("copy").textContent = "Copy all"), 1500);
});

el("restart").addEventListener("click", () => {
  if (!confirm("Discard this rewrite and start over?")) return;
  localStorage.removeItem(STORE_KEY);
  location.reload();
});

const saved = localStorage.getItem(STORE_KEY);
if (saved) {
  const { original, draft } = JSON.parse(saved) as {
    original: string;
    draft: string;
  };
  openEditor(original, draft);
}
