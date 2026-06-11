# Publishing policy: NO REDEPLOY for content

**Rule:** Publishing or updating an **article** must NOT trigger a full site
rebuild/redeploy. Routine content goes live via **dynamic rendering** from the
database. A full static rebuild (`deploy.yml`) is for **code / template / design**
changes only.

## Why
The site is a static export served by Caddy from `/srv/apps/1001sovet/current`.
The legacy publish flow rebuilds the whole site and tars all of `out/` (HTML + every
image) to the `/__deploy/upload` webhook — which **413s** once the corpus grows
(hit at ~486 articles) and re-uploads everything on every article. That does not
scale and is the wrong path for content.

## The model (target)
1. A new/updated article is written to the DB (`content_matrix`, published) and its
   image is stored in **R2** (not in the deploy tarball).
2. A **Cloudflare renderer worker** serves `GET /:category/:slug/` from the DB as
   full server-rendered HTML (Article+NewsArticle JSON-LD with true image dims,
   canonical, `max-image-preview:large`, OG/Twitter, site header/footer/CSS).
3. **Caddy** serves the static file if it exists, otherwise reverse-proxies the
   article route to the renderer worker. New articles are live in seconds, no build.
4. Optional: a periodic rebuild folds DB articles into static for speed. This is an
   optimization only — the site works without it.

## Implementation status
Tracked in bead **`sovetydoma-289`** (epic) and `reports/HANDOFF-no-redeploy-factory-2026-06-11.md`.
Until the renderer lands, content has been shipped by streaming the prebuilt `dist`
branch over SSH (bypassing the 413 webhook) — a stopgap, not the model.

## For contributors / agents
- Do **not** add "rebuild to publish an article" workflows. If you find one, it's a bug.
- `scripts/matrix/auto-publish.mjs` currently commits MDX + pushes (legacy rebuild path);
  it is being replaced by a DB+R2 dynamic publish path. Prefer the dynamic path.
