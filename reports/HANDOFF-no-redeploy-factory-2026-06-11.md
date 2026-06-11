# HANDOFF — Content factory WITHOUT redeploy (dynamic article rendering)

**Date:** 2026-06-11 · **Author:** previous Claude session (very long, context exhausted)
**Read this first. Then `bd show <epic>` (see end). Then start at "WHAT TO BUILD".**

---

## 0. THE ONE RULE (what the owner wants)

> **Publishing a new article must NOT trigger a site rebuild/redeploy.** A new article
> is written to the DB and appears on the live site immediately via **dynamic
> rendering**. Full static rebuilds are a legacy fallback for code/template changes
> only — never the path for routine content. Treat "rebuild to publish an article"
> as a BUG to remove, not a workflow.

Everything below serves that rule.

---

## 1. WHAT THIS SESSION DID (context)

- **Security:** version-controlled RLS for 9 UGC tables (`202606102000`), DB-trigger
  rate limiting (`202606102100`), function-execute lockdown (`202606110000`). Live DB
  verified clean (0 RLS gaps, 0 anon-callable functions). Closed beads 39y, gx3, xoq,
  5sn, 98c. Photo-upload CORS/timing already fixed earlier.
- **Auth:** custom **Yandex OAuth** flow shipped (worker `auth/yandex.ts` + `/auth/yandex/exchange`,
  client in AuthModal + `/auth/callback/`); secrets set, redirect whitelisted. **Fixed VK app id**
  54625895→**54626241** (root cause of VK ID widget failure, bead 1fc).
- **VK Mini App:** built from scratch in `vk-miniapp/` (Vite+VKUI+vk-bridge), live at
  **https://1001sovet.ru/vk-app/**, placement set, **moderation submitted** (status «В процессе»,
  legal docs = standard VK → compliant). Created FB page «1001совет — Дача и огород» (others
  ready as blocks in a bead).
- **SEO:** truthful JSON-LD image dims; image generator default → 1280×960 (Discover ≥1200px).
- **Images goblin-free:** reworked `lib.buildImagePrompt` (strip people/hands, ban figurines,
  per-category scene anchor); regenerated ~296 published images; abstract prompts LLM-rewritten
  by a subagent. Verified visually.
- **Article factory exercised end-to-end:** published 6 dacha + **50 АВТО summer articles**
  (category Авто 0→50, site 436→486). Drafts written by **Claude subagents** (see §2).
  Fixed 3 auto-publish bugs (Windows commit, missing preview gen, stale sitemap regen).

## 2. HOW WE WORK (infra + gotchas — SAVE TIME)

- **Live DB = self-hosted Supabase on the RU host** `89.169.44.37` (Timeweb, 152-ФЗ).
  App/worker point at `https://api.1001sovet.ru`. Introspect/patch via:
  `ssh -i ~/.ssh/timeweb_1001sovet root@89.169.44.37 "echo <base64-SQL> | base64 -d | docker exec -i supabase-db psql -U postgres -d postgres"`
  (base64-encode SQL to survive SSH quoting). EU `plwkjd…supabase.co` is rollback-only.
- **Workers:** Cloudflare, `cd workers/subscriptions && npx wrangler deploy`. `wrangler secret bulk`
  (NOT `secret put` — PowerShell adds a BOM; see memory `wrangler-secret-bom-gotcha`).
- **Site serving:** Caddy on the RU host, vhost `1001sovet.ru` → static files in
  `/srv/apps/1001sovet/current` (symlink to a release dir). `/etc/caddy/Caddyfile`. The VPS
  **never builds** (2026-06-04 incident); it serves prebuilt static.
- **Deploy model (the thing we're replacing):** push to master → GH Actions `deploy.yml`
  builds `out/`, pushes to `dist` branch, then **tars ALL of `out/` and POSTs it to
  `https://1001sovet.ru/__deploy/upload`** (Caddy route → `127.0.0.1:9101`). Caddy body cap
  raised to 600MB (`Caddyfile.bak-deploysize`). **This 413s once the site+images exceed the cap**
  — happened at 486 articles. Root cause: images shipped in the tarball.
- **Manual deploy that bypasses the webhook (USE WHEN 413):**
  `git fetch origin dist && git archive origin/dist | ssh … "mkdir rel; tar -x -C rel; ln -sfn rel current.new; mv -Tf current.new current"` (SSH has no body cap). Did this to ship the 50 avto.
- **Content factory pipeline (scripts/matrix/):**
  ideas (`insert-ideas.mjs`, JSON array; `ALLOWED_CATEGORIES` now includes `avto`)
  → **images first** (`gen-images-fal.mjs`, fal Flux schnell, `lib.buildImagePrompt`)
  → drafts (`gen-drafts-grok.mjs`=WSL grok / `gen-drafts-kimi.mjs`=kimi.exe — **BOTH BROKEN in this
  env**: WSL grok gone, kimi.exe missing, Windows grok unresponsive. We used **Claude subagents**
  to write `.matrix-ideas/drafts/<slug>.md`) → `ingest-drafts-batch.mjs` (idea→draft)
  → `promote-drafts.mjs` (draft→approved, 300–2500 words gate, needs image-ready)
  → `auto-publish.mjs` (approved+image → MDX → previews → regen sitemap/index/feeds → commit → push).
  `auto-publish` now supports `--category` and regenerates sitemap/previews itself.
- **Content gates that fail deploys (watch these):** image audit `--fail-on-missing-previews`,
  SEO audit (description 70–180 chars), sitemap pagination test (`/articles/page/N/`), style gate
  (`validate-style.mjs --fail 6`, AI-tone). The first two/three are now auto-handled by auto-publish.
- **tsconfig excludes `vk-miniapp`** (its TS deps aren't in root node_modules — would break `tsc`).
- Windows/git: CRLF warnings are harmless; `auto-publish` commits via `git commit -F` (shell:true
  splits `-m`). Node-on-Windows prints a libuv assertion on exit (cosmetic, after work done).

## 3. WHAT TO BUILD (the no-redeploy renderer)

**Goal:** new article in DB → live in seconds, zero rebuild. SEO-safe (server-rendered HTML).

**Design (recommended):**
1. **Source of truth:** `content_matrix` published rows in the RU DB (already has body_md, title,
   description, image_filename, category, tags, date). Add a read path: either a Postgres VIEW
   `published_articles` or query content_matrix directly with the service role (read-only).
2. **Renderer worker (Cloudflare):** new worker (or extend subscriptions worker) handling
   `GET /:category/:slug/`. It:
   - looks up the article by category+slug;
   - renders FULL HTML matching the site: `<head>` (title, description, canonical,
     `max-image-preview:large`, OG/Twitter, **Article+NewsArticle JSON-LD with TRUE image dims**),
     site header/footer, article body (markdown→HTML), related links;
   - links the site's existing CSS chunk(s) so styling matches the static pages;
   - sets `Cache-Control` + uses Cloudflare cache/KV so repeat hits are cheap;
   - 404s cleanly for unknown slugs.
3. **Caddy fallback:** for the article routes, serve the static file if present, else
   `reverse_proxy` to the renderer worker (instead of the current SPA `/index.html` fallback —
   that's why missing articles currently show the homepage). Sketch:
   ```
   handle /:cat/:slug/* {            # articles
     @static file
     file_server @static
     reverse_proxy @notstatic <renderer-worker>   # when no static file
   }
   ```
   (Caddy: use `try_files` + a `not file` matcher to split static vs proxy.)
4. **Images out of the deploy tarball (fixes 413 + shrinks rebuilds):** publish article images to
   **R2** (reuse photo-upload bucket/worker) or a persistent `/srv/apps/1001sovet/images` mount
   served by Caddy and NOT included in `out/`. Then `out/` is HTML+JS only (~small), and the
   webhook never 413s. (Bead already filed for R2 image move.)
5. **New publish path:** `auto-publish` (or a new `publish-dynamic.mjs`) writes the article to the
   DB as published + uploads the image to R2 — **no MDX commit, no git push, no rebuild.** Article
   is instantly live via the worker. Optional nightly rebuild folds DB articles into static for
   speed (purely an optimization; site works without it).

**Test runs to do:** publish 1 test article via the dynamic path → confirm it's live (real title,
JSON-LD, image) with NO GH Actions run firing → publish a small batch → confirm listing/sitemap
behavior (sitemap can be served dynamically too, or regenerated cheaply).

## 4. DOCS + CODE COMMENTS TO ADD (owner asked)

- A `docs/NO-REDEPLOY-PUBLISHING.md` stating the rule + the architecture.
- Comments in `.github/workflows/deploy.yml`, `scripts/matrix/auto-publish.mjs`, and the Caddyfile:
  "Publishing content must NOT rebuild. Routine articles go live via the dynamic renderer
  (workers/<renderer>). Full rebuild is for code/template changes only."

## 5. OPERATOR-BLOCKED (need the owner — not code)

- **`CONTENT_PUBLISH_PAT`** repo secret (fine-grained, contents:write) — for any GH-Actions push to
  trigger deploy; less relevant once dynamic publishing lands.
- **Rotate exposed keys** (bead csv): Anthropic/Unsplash → `.secrets`.
- **FB pages:** create per-category (blocks saved in a bead) → then wire `FB_PAGES_BY_CATEGORY`
  (get page tokens via `/me/accounts`).
- **VK mini-app:** moderation «В процессе» — just wait.
- **Supabase dashboard:** SMTP + recovery template + redirect allowlist to finish auth E2E (bead 0h3).
- **Yandex app:** redirect URI + `NEXT_PUBLIC_YANDEX_OAUTH_CLIENT_ID` already set; verify on real login.

## 6. KEY POINTERS

- Memory: `C:\Users\filip\.claude\projects\C--DEV-sovetydoma\memory\MEMORY.md` (RU DB, autopost,
  goblin-free images + the 413 gotcha, VK app, Yandex flow, UGC security).
- Caddyfile: `/etc/caddy/Caddyfile` on 89.169.44.37 (backups `*.bak-*`).
- SSH key: `~/.ssh/timeweb_1001sovet`.
- Factory: `scripts/matrix/*`, ideas in `.matrix-ideas/`, drafts in `.matrix-ideas/drafts/`.
- Image prompt logic: `scripts/matrix/lib.mjs` (`buildImagePrompt`, `sanitizeImagePrompt`, `IMAGE_STYLE_SUFFIX`, `CATEGORY_SCENE`).
