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

## Architecture (live since 2026-06-11)

**Cloudflare Worker** (`workers/renderer/`) serves `GET /:category/:slug/` for articles in the DB that don't exist as static files:
- Fetches a live static article page as an HTML shell (via `TEMPLATE_URL` env var, cached 10 min)
- Transforms with HTMLRewriter: title/meta/canonical/OG/JSON-LD (Article+NewsArticle+BreadcrumbList)/h1/breadcrumbs/hero image/date/category/tags
- Renders `body_md` with a built-in markdown renderer
- **Strips all Next.js scripts + Flight payload** — dynamic pages are pure static HTML (no hydration; ratings/comments/interactive widgets remain disabled until the nightly fold-in is implemented; this is deliberate)
- Also serves `/images/*` from R2 bucket `sovetydoma-article-images` (incl. 240px previews) and `/sitemap-dynamic.xml` (rows where `frontmatter.published_via='dynamic'`)

**Caddy on the VPS** (1001sovet.ru vhost) routes:
- Named matcher `@dynamic` = not a static file AND (images/* OR sitemap-dynamic.xml OR category/slug for the 12 known categories)
- Static files **always** win; no match → reverse-proxy to `https://sovetydoma-renderer.filippmiller.workers.dev`
- DB reads via Supabase REST at `https://api.1001sovet.ru` (service-role key, set via `wrangler secret bulk` — never `secret put`, PowerShell BOM)

**Publishing runbook** (the new way):
1. `node scripts/matrix/regen-images-fal.mjs --slugs a,b,c` (if images missing locally)
2. `node scripts/matrix/publish-dynamic.mjs --slugs a,b,c` (or `--category X --limit N`; supports `--dry-run`)
   - Generates 240px preview
   - Uploads image + preview to R2 via `wrangler`
   - Sets `text_status='published'` + `published_at` + `image_url` + `frontmatter.published_via='dynamic'`
   - Logs a `content_matrix_events` record
   - **No git, no rebuild, zero GitHub Actions runs**
3. Article is live within seconds; verify with curl

**Verified 2026-06-11:** 1 article + batch of 3 published this way; live with correct SEO HTML, images from R2, sitemap-dynamic listing them, GH Actions baseline unchanged.

## Still rebuild-based (legacy, for code/template changes only)
- `deploy.yml` path; 413 tarball gotcha and SSH dist-stream workaround remain until images are removed from the tarball (bead `sovetydoma-rih`)
- Nightly/periodic fold-in (DB→MDX→static) is a future optimization that restores interactive widgets for dynamic articles — when it runs, static files take precedence automatically

## For contributors / agents
- Do **not** add "rebuild to publish an article" workflows. If you find one, it's a bug.
- Use `scripts/matrix/publish-dynamic.mjs` for all content publishing (no rebuild path needed).
- Legacy `scripts/matrix/auto-publish.mjs` (commits MDX + pushes) is deprecated for content; only use for code/template changes.
