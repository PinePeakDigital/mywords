# MyWords

A tool for rewriting someone else's text into your own words. Paste the original,
edit it in place, and watch how much of their wording survives.

- Words still carrying the original's wording are **marked**; your own are not.
- <kbd>Ctrl/⌘</kbd>+<kbd>⇧</kbd>+<kbd>X</kbd> **redacts** the paragraph you're in, so you
  can't crib from the sentence you're replacing. Press and hold a redacted line to peek.
- The bar fills as you go: the share of the original's words no longer present anywhere.

One document at a time, kept in `localStorage`. Nothing leaves the browser.

See [CONTEXT.md](./CONTEXT.md) for the vocabulary and [docs/adr](./docs/adr) for decisions.

## Development

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # the diff logic, which is where the bugs live
npm run build   # typecheck + bundle to dist/
```

## Deployment

Cloudflare Pages at `mywords.nathanarthur.com`. Build command `npm run build`,
output directory `dist`. No environment variables, no backend.
