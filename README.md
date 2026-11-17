# loccit web frontend

The browser UI of loccit: the thesis on the left, the cited paper on the
right. It talks to the [backend](../loccit-backend) only through its HTTP API
(`/api`, schema at `/api/openapi.json`).

Stack: Vite, React, TypeScript, Chakra UI, PDF.js (`pdfjs-dist`) for both
viewers.

## Development

Two processes:

```sh
# 1. backend, in loccit-backend (conda env loccit-backend)
python -m loccit

# 2. frontend, in this folder
npm install
npm run dev        # http://localhost:5173, forwards /api to 127.0.0.1:8765
```

## Build

```sh
npm run build      # writes dist/
python -m loccit --frontend /path/to/loccit-web-frontend/dist
```

`--frontend` is needed once; the backend remembers the folder in
`~/.loccit/settings.toml` and serves it from then on, so `python -m loccit`
alone starts everything and opens the browser. Rebuild after pulling changes.

Other scripts: `npm run lint`, `npm run format`.

## Structure

- `src/api.ts` – the only place that knows the backend; types mirror its
  OpenAPI schema. `VITE_API_BASE` points it at another origin (e.g. for a
  desktop shell).
- `src/pdf/` – `PdfViewer`, a wrapper around the PDF.js viewer components
  (lazy page rendering, text layer, internal links, zoom). Clicks on link
  annotations can be intercepted, which is how citations are caught. It marks
  rectangles given in PDF coordinates and scrolls to a passage.
- `src/pages/` – start page (upload, recent documents) and document page
  (the two columns).
- `src/components/` – what the right column shows: the result of the check
  (verdict, passages, run details), the paper, "Paper nicht gefunden", or the
  choice between versions.
- `src/useCheck.ts` – keeps the check of the open citation group in step with
  the selected model and thinking level, and decides when a check starts.
- `src/labels.ts` – German wording for the codes the backend reports.
- `scripts/copy-pdfjs-assets.mjs` – copies the files PDF.js loads at runtime
  into `public/pdfjs` (runs before `dev` and `build`).

Routes are hash routes (`#/doc/<id>`) and asset URLs are relative, so the
build needs no server-side routing.

Keyboard: `J` / `K` (or Alt+↓ / Alt+↑) step through the passages in reading
order (sources as in the citation group, then page, then sentence), `S`
returns to the strongest passage, `←` / `→` step through the sources of a
citation group. Pinch on the trackpad or Cmd/Ctrl+wheel zooms a viewer
around the pointer.

Other scripts: `npm test` runs the unit tests in `tests/` with Node's own
test runner.
