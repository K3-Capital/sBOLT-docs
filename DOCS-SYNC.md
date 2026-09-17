# Documentation sync notes

This repository holds the sBOLD documentation and builds the published site from
it. Read the three configuration layers below carefully — they are **not**
interchangeable.

## Where the content came from

The Markdown in this repository was scraped from the published GitBook site
<https://k3-capital.gitbook.io/sbold> on 2026-09-17. The published site lists
seven pages, and each one maps 1:1 onto a page here:

| Published path | Repository source |
| --- | --- |
| `/` (home) | `README.md` |
| `/introducing-sbold` | `introducing-sbold.md` |
| `/technical-details` | `technical-details/README.md` |
| `/technical-details/interactions` | `technical-details/interactions.md` |
| `/technical-details/price-oracle` | `technical-details/price-oracle.md` |
| `/audit-reports` | `audit-reports.md` |
| `/brand-assets` | `brand-assets.md` |

The source site publishes the root page under the title **"Liquity v2 Design"**,
so that is the home page and the first entry in `SUMMARY.md` — it is the
background section that the rest of the docs build on.

Scrape method: GitBook serves a Markdown export of every page by appending `.md`
to the page URL (`/sbold/<path>.md`), which was used for the text. Images live on
GitBook's storage host, which rejects direct requests; they were fetched through
the site's own signed image proxy (`/~gitbook/image?url=…&sign=…`) and are now
committed under `assets/` so the published site is self-contained.

Transformations applied while importing the content (content-preserving only):

- The GitBook link banner ("For the complete documentation index, see llms.txt…")
  was removed from the top of each page.
- Empty in-page anchor tags GitBook injects after headings
  (`<a href="#overview" id="overview"></a>`) were removed. HonKit generates those
  anchors itself and the duplicates produced invalid HTML.
- GitBook's `&#x20;` padding entities were removed.
- The LaTeX inside `$$ … $$` blocks was repaired. GitBook's Markdown export
  escapes `_`, `[`, `]` and delimiter braces, so the formulas arrived as
  `sBold\_{rate}` / `\left\[ … \right\]` / `\left{ … \right}`, which is not valid
  TeX. The escapes were undone so the equations typeset (see "Math rendering").
- The five `{% file src="…" %}` embeds on the Brand Assets page (not Markdown —
  HonKit would have printed them literally) became a download list pointing at
  the committed files under `assets/brand/`.
- Image references were rewritten to the committed `assets/` copies.

### Known gaps in the scrape

- `sBOLD-icon.pdf` (the print-ready brand asset) could not be downloaded. GitBook
  serves it from its storage host, which the scrape environment cannot reach
  (HTTP 400 for any direct file request), and only raster/vector *images* are
  reachable through the signed image proxy. `brand-assets.md` therefore lists the
  four assets that are committed and links to the source page for the PDF.
- Numbers, addresses and claims are exactly as published upstream — nothing was
  re-derived, and no facts were added.

## GitBook Git Sync configuration (what GitBook.com's Git Sync reads)

- **`gitbook-docs.yaml`** — the GitBook **site** Git Sync configuration file.
  GitBook.com's Git Sync setup looks for this exact file at the repository root
  (the site's project directory). It maps the repository's content directories
  onto the site's navigation. This repo declares a single space whose content
  lives at the repository root; within that directory GitBook reads
  **`README.md`** as the readme/first page and **`SUMMARY.md`** as the table of
  contents by default. Schema: <https://api.gitbook.com/gitbook-docs.yaml>.
- **`SUMMARY.md`** — GitBook's table of contents for a space. It mirrors the site
  navigation; every page in the site is listed here.

## Local renderer configuration (NOT read by GitBook.com)

- **`book.toml`** — configuration for the **local open-source renderer**
  (HonKit) used to build and preview this site from the command line. GitBook.com
  does **not** read this file. It must not be mistaken for GitBook configuration.
- **`book.json`** — HonKit plugin configuration.
  - `honkit-plugin-mermaid-hybrid` renders ```` ```mermaid ```` fences as static
    SVG at build time (`embed: true`). The imported content contains no Mermaid
    diagrams; the plugin is kept so the pipeline matches the K3 docs template and
    diagrams render if they are added later.
  - `honkit-plugin-katex` typesets the `$$ … $$` math blocks. GitHub Pages does
    not render LaTeX on its own — without the plugin the formulas would be
    published as literal `$$` source. See "Math rendering" below for the caveat.
- **`puppeteer-config.json`** — Chromium launch settings used by the Mermaid
  renderer in CI.
- **`scripts/set-page-titles.mjs`** — post-build step that rewrites HonKit's
  browser titles to `sBOLD - <page title>`.
- **`scripts/generate-llms.mjs`** — post-build step that generates the
  [llmstxt.org](https://llmstxt.org) files `llms.txt` (curated index) and
  `llms-full.txt` (full inlined content) into `_book/` for LLM consumers. It
  derives the page list from `SUMMARY.md`, so the LLM-facing index always mirrors
  the published table of contents, and it rewrites each page's internal relative
  `.md` links to absolute published `.html` URLs. A deterministic build-time gate
  asserts that `llms.txt` validates and that `llms-full.txt` contains **zero**
  unresolved internal `.md` links — the build fails otherwise.
  - **Navigation:** both artifacts are linked from `SUMMARY.md` by their absolute
    published URLs (`https://k3-capital.github.io/sBOLT-docs/llms.txt` and
    `https://k3-capital.github.io/sBOLT-docs/llms-full.txt`) so they appear in
    the site's left navigation. Absolute URLs are required: HonKit renders an
    absolute link as a sidebar entry from every page depth, while a bare non-page
    relative target (e.g. `llms.txt`) is silently dropped from the navigation.
    The build gate also asserts those two links stay in `SUMMARY.md`.

To reproduce the Pages build locally:

```sh
npm ci
npm run build
```

## Math rendering

`honkit-plugin-katex` is a third-party plugin (last published 2021, Apache-2.0)
that bundles KaTeX 0.13.19 and renders each `$$ … $$` block at build time; it is
the only maintained HonKit plugin that does this. Two consequences are worth
knowing:

- It calls KaTeX with default options, so a malformed formula **fails the build**
  rather than being published as source. That is why the scraped LaTeX had to be
  repaired (above) before it would build. Treat a broken build after editing a
  formula as a genuine signal.
- The plugin uses HonKit's legacy plugin API and logs `property is deprecated`
  warnings on every build. They are harmless.

## Publishing

`.github/workflows/pages.yml` builds the site with `npm ci` / `npm run build` and
deploys `_book/` to GitHub Pages (`build` job runs on pull requests, `deploy` is
skipped there). Expected URL: <https://k3-capital.github.io/sBOLT-docs/>.
Enabling Pages is a repository-admin setting (Settings → Pages → Build and
deployment → Source: GitHub Actions); this workflow cannot turn it on itself.

## Scope notes

- The imported text is the published sBOLD documentation, reproduced as-is except
  for the mechanical transformations listed above.
- Connecting this repository to a GitBook space (space URL, visibility, sync
  direction) is a product-owned decision and is intentionally **not** configured
  here — `gitbook-docs.yaml` only provides the content mapping GitBook requests,
  ready for any space to sync against it as-is.
