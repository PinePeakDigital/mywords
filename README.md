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

Pushing to `main` deploys to `mywords.nathanarthur.com`, as a Cloudflare Worker
serving static assets (`.github/workflows/ci.yml`, gated on the tests and a clean
build). The Worker is configured in `wrangler.jsonc`; the deploy reads the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. No
environment variables, no backend.
