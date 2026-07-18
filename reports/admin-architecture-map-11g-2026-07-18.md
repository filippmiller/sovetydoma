# Admin Control-Plane Architecture Map — beads sovetydoma-11g.2/.3/.4/.5
Date: 2026-07-18 · Read-only research · No secrets disclosed

---

## 0. Executive summary / key recommendation

- **The admin API MUST be a Cloudflare Worker.** The site is a Next.js static export (`next.config.ts` `output: 'export'`) served by Caddy on the VPS; `src/app/api/**` does not exist; `out/api/` contains exactly one pre-rendered HTML stub (`/api/auth/vk/callback/index.html`) that client-side-forwards to the subscriptions worker. There is no Next server in production, and Caddy does NOT proxy `/api/*` to any worker.
- **Recommended: a NEW worker `sovetydoma-admin-api`**, not bolted onto an existing one. It binds the same R2 bucket `sovetydoma-article-images` (admin upload endpoint, replacing the shared-secret `PUT /__r2/` flow for humans), talks to Supabase REST at `https://api.1001sovet.ru` with the service-role key, and owns renderer cache invalidation by calling a new authenticated purge endpoint on `sovetydoma-renderer`.
- **JWT validation pattern already exists in-repo**: `workers/photo-upload/src/index.ts` `validateAdmin()` = `GET {SUPABASE_URL}/auth/v1/user` (with anon apikey) → user id, then `GET /rest/v1/profiles?id=eq.<uid>&select=role` via service role → `role === 'admin'`. Reuse verbatim.
- **Audit trail half-exists**: `content_matrix_events` (append-only event log) is already written by `publish-dynamic.mjs`. Extend it (or add `admin_audit_events`) with actor/action/before-after/idempotency-key.
- **Optimistic concurrency**: `content_matrix.updated_at` is auto-maintained by trigger `trg_content_matrix_updated` — PATCH with `updated_at=eq.<lastSeen>` and check affected row count → 409 on mismatch. A monotonic `revision_count` column already exists.
- **Cache invalidation**: renderer cache keys are deterministic (`{SITE_URL}/{category}/{slug}/?render=9`, `/__internal/cat-rows/{category}?render=9`, `/stati/...`, `sitemap-dynamic.xml?generator=v3`). Add a secret-gated `POST /__purge` on the renderer that `caches.default.delete()`s the exact keys for a slug+category. That gives instant targeted invalidation without redeploys or bumping `RENDER_VERSION`.

---

## 1. AUTH — how admin auth works today

### Client side
- `src/lib/supabase.ts` — browser client, `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)`, singleton pinned on `globalThis` (comment explains multi-chunk GoTrue breakage). Types: `UserRole = 'user' | 'moderator' | 'admin'`; `Profile.role`.
- `src/lib/admin-auth.ts` — `useAdminAuth()` hook: `sb.auth.getUser()` (server-validated token, fallback to `getSession()` on transient null), then `profiles.role === 'admin'` via the anon client (RLS allows reading own profile). States `checking | authed | denied`; denial redirects to `/admin/login/`. **Client-side gate only** — UX, not security.
- `src/components/admin/AdminLoginForm.tsx` — email+password via `sb.auth.signInWithPassword`, then role check, else `signOut()`. Deliberately no auto-redirect (documented redirect-loop history).
- JWT obtained client-side via standard supabase-js session (`getSession().session.access_token`); persisted in localStorage by GoTrue. Example of attaching it to a worker call: `src/lib/photos.ts uploadToR2()` sends `Authorization: Bearer <access_token>` to the photo worker.
- `src/components/auth/AuthButton.tsx` (288 lines) — public-site login UI; not admin-specific.
- Middleware: none (static export has no middleware runtime).

### Server side (workers)
- `workers/photo-upload/src/index.ts`:
  - `validateUser(env, authHeader)` → `GET {SUPABASE_URL}/auth/v1/user` with `apikey: SUPABASE_ANON_KEY` — GoTrue validates the JWT, returns user id.
  - `validateAdmin(env, authHeader)` → validateUser + `GET /rest/v1/profiles?id=eq.<uid>&select=role` with service-role headers, `role === 'admin'`. Used by `GET /analytics/summary`. **This is the exact pattern 11g.2 needs.**
  - `POST /upload` (UGC photos) validates user JWT only.
- `workers/subscriptions/src/admin.ts` — `requireAdmin()`: static shared secret `ADMIN_API_KEY` via `x-admin-key`/Bearer with `timingSafeEqual` (`security.ts`). Used for diagnostics, dry-run, test-send, push fan-out, responder queue. **Weaker than JWT+role; the admin UI makes the operator paste this key manually (AdminPushNotifications, AdminResponder have `adminKey` input fields).**
- `workers/renderer/src/index.ts` — no user auth; only `R2_UPLOAD_SECRET` shared secret on `PUT /__r2/<key>` (regex-validated image keys, ≤10 MB).
- Supabase access everywhere is REST/PostgREST at `https://api.1001sovet.ru` (Caddy → 127.0.0.1:8100 self-hosted Supabase) with `apikey` + `Authorization: Bearer <service_role>` headers. No direct PG connections anywhere.

### Static-export verification
- `next.config.ts`: `output: 'export'`, `trailingSlash: true`, `images.unoptimized`. Redirects are advisory only (comment says host must implement 301s).
- `src/app/api/**` — **does not exist**. `out/api/auth/vk/callback/index.html` is a static stub that JS-posts the VK code to `https://sovetydoma-subscriptions.filippmiller.workers.dev` (`/auth/vk/exchange`).
- Caddy vhost (per passport bead `sovetydoma-fr9`): `/__deploy/*` → :9101, `/vk-app/*` → vk-miniapp, `@dynamic` matcher → renderer worker, else static file_server. **No `/api/*` proxy to a worker** — all worker APIs are called cross-origin from the browser via `NEXT_PUBLIC_*_API_URL` envs (subscriptions, photo-upload) with per-route CORS.

## 2. WORKERS — inventory

| Worker | Framework | Auth patterns | Supabase access | Secrets | Notes |
|---|---|---|---|---|---|
| `sovetydoma-renderer` (`workers/renderer`) | plain fetch handler, HTMLRewriter, zod dep; `npm` | `R2_UPLOAD_SECRET` header only | REST, service-role key | `SUPABASE_SERVICE_ROLE_KEY`, `R2_UPLOAD_SECRET` (`wrangler secret bulk`) | R2 binding `ARTICLE_IMAGES` → bucket `sovetydoma-article-images`. No routes in wrangler.toml — reached only via Caddy reverse_proxy. |
| `sovetydoma-subscriptions` (`workers/subscriptions`) | plain fetch handler, cron `0 * * * *` | `ADMIN_API_KEY` shared secret (timing-safe); VK/Yandex OAuth exchanges; webhook signature checks (Svix/WhatsApp HMAC); Turnstile | REST helpers `src/supabase.ts` (select/insert/upsert/update/delete/rpc), service-role | many (VK/Yandex/Anthropic/Turnstile/VAPID/…) | Largest worker; already owns push, social, responder. Called directly from browser (`NEXT_PUBLIC_SUBSCRIPTIONS_API_URL`). |
| `sovetydoma-photo-upload` (`workers/photo-upload`) | plain fetch handler | **Supabase JWT + profiles.role=admin** (`validateAdmin`), user JWT for uploads, contact challenge tokens, Turnstile, KV rate limits | REST service-role + anon | `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CONTACT_FORM_SECRET`, `TURNSTILE_SECRET_KEY` | R2 `PHOTOS` → `sovetydoma-photos`; KV `RATE_LIMIT_KV`; send_email binding. Hosts `/analytics/*`, `/view`, `/contact`, `/article-question(s)`. |

**Home for the admin API:** subscriptions is already overloaded (push/social/responder/cron) and uses the weaker shared-secret admin model; renderer is public-facing SEO-critical and should only gain the tiny purge endpoint; photo-upload has the right auth helper but the wrong domain (UGC). **A new worker `sovetydoma-admin-api` is cleaner**: separate deploy blast radius, its own secrets, R2 binding for hero uploads, and a single responsibility matching bead 11g.2.

## 3. RENDERER CACHE MODEL (`workers/renderer/src/index.ts`)

- `RENDER_VERSION = '9'` — manual cache-bust constant; folded into every internal cache key. Bumping it invalidates everything at once (requires worker redeploy).
- Article pages: `cacheKey = {SITE_URL}/{category}/{slug}/?render={RENDER_VERSION}` in `caches.default`. TTL: response `Cache-Control: public, max-age=300, s-maxage=600` (`ARTICLE_RESPONSE_CACHE_TTL = 300`). Cache API entry respects the response's Cache-Control.
- Category rows (for related links + hubs): `{SITE_URL}/__internal/cat-rows/{category}?render={RENDER_VERSION}`, TTL 600 s.
- Hub pages: `{SITE_URL}/stati/{category}/{page}?render={RENDER_VERSION}`, TTL 600 s.
- Sitemap: `{SITE_URL}/sitemap-dynamic.xml?generator=v3`, TTL 3600 s.
- Template shell: `{TEMPLATE_URL}?renderer-shell={RENDER_VERSION}`, TTL 3600 s (`workers/renderer/src/template.ts`).
- Images from R2: `Cache-Control: public, max-age=86400, immutable` + ETag. **Immutable → replacement media MUST use a new key** (the `-no-person.jpg` incident: first replacement reused the immutable URL and browsers kept showing the old image; fix was a new key plus a per-slug `IMAGE_REPLACEMENTS` map in `src/jsonld.ts` — exactly the "manual per-slug code map" 11g.5 must eliminate).
- Caddy adds nothing cache-wise for dynamic routes (plain `reverse_proxy`); static files always win at Caddy (`not file` matcher).
- **Targeted invalidation needs**: delete keys `{cat}/{slug}/?render=*`, `__internal/cat-rows/{cat}`, `stati/{cat}/*` pages, `sitemap-dynamic.xml`. Cache API delete is exact-key; RENDER_VERSION is known to the worker itself, so a purge endpoint inside the renderer can construct all keys. Note: Cache API is per-datacenter — a purge endpoint deletes only in the colo that receives it; mitigations: (a) accept short residual staleness (max TTL 600 s), (b) version-bump a KV-stored per-slug `v=` included in future cache keys (KV is eventually consistent globally, ~60 s), or (c) both.
- Media URLs embedded by the renderer: hero `<img src="/images/<file>">`, `og:image`, `twitter:image`, JSON-LD `image` — all `{SITE_URL}/images/{articleImageFilename(row)}` served from R2 via Caddy fallback (static `public/images/*` wins if present).
- `src/ugc.ts`: server-renders approved questions/comments HTML (honest empty/error states) into `[data-dynamic-widget="questions|comments"]` because hydration is stripped.
- `src/jsonld.ts`: Article/NewsArticle/Breadcrumb/FAQ JSON-LD builders, category names, persona resolution, and the `IMAGE_REPLACEMENTS` per-slug override map (the thing to retire).

## 4. MEDIA PIPELINE

- **R2 bucket `sovetydoma-article-images`** (binding `ARTICLE_IMAGES` in renderer): dynamic-article heroes at `<filename>.jpg`, previews at `previews/<slug>.jpg` (240×240 q72). No public bucket domain — served at `https://1001sovet.ru/images/...` via Caddy `@dynamic` → renderer R2 stream (86400 immutable).
- **R2 bucket `sovetydoma-photos`**: private UGC reader photos via photo-upload worker (`POST /upload` JWT-gated, `GET /file/<key>`).
- Static-corpus images (~486) still live in `public/images/` and ship in the deploy tarball (cause of the deploy 413; bead `sovetydoma-rih`).
- Generation: `scripts/matrix/gen-images-fal.mjs` / `regen-images-fal.mjs` / `gen-images-openai.mjs` (fal.ai Flux Schnell 1280×960, no-people prompt hygiene in `scripts/matrix/lib.mjs buildImagePrompt/sanitizeImagePrompt`). Upload: `publish-dynamic.mjs` via renderer `PUT /__r2/<key>` with `R2_UPLOAD_SECRET` (previously `wrangler r2 object put`). Previews: `scripts/generate-image-previews.py --slug X`.
- `public/images/.sources.json` (731 entries, keyed by slug): provenance of legacy images — `{provider, id, query, alt, userName, ...}` (unsplash etc.). Contains mojibake in some strings; static-corpus attribution record only, not used at runtime by the renderer.

## 5. EXISTING MUTATION PATHS

- `scripts/matrix/publish-dynamic.mjs` — the canonical no-redeploy publisher. Credentials: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`/`process.env` (`scripts/matrix/lib.mjs getServiceClient()`, BOM-stripped). Writes: `content_matrix` update (`text_status='published'`, `published_at`, `image_url`, `frontmatter.published_via='dynamic'`, `frontmatter.date`), insert into `content_matrix_events` (axis/from/to/agent/notes/payload), upsert into `articles_publication_index` (autopost seam). Quality gate `quality-gate.mjs`; R2 via worker PUT.
- Other matrix scripts (`ingest-draft(s)`, `mark.mjs`, `promote-drafts.mjs`, `auto-publish.mjs` legacy git path) use the same `getServiceClient()`. Fields touched: text/image status axes, disposition, frontmatter, quality scores.
- **Revision/audit**: `content_matrix_events` (migration `20260604105305_content_matrix.sql`): `id, matrix_id FK cascade, axis, from_value, to_value, agent, notes, payload jsonb, created_at` + index `(matrix_id, created_at desc)`. RLS: service-role only. It is an event log, **not** a full before/after snapshot — no actor user id, no idempotency key, no request correlation. `content_matrix.updated_at` is trigger-maintained (`set_updated_at()`); `revision_count int` exists but is pipeline-oriented.
- Admin UI mutations today go **directly from the browser via the anon client + RLS** (photos status updates, article_questions approve/answer in `AdminPhotoModeration`/`AdminArticleQuestions`) — RLS policies allow it for admin role, but there is no audit, no concurrency control, and errors are swallowed (`catch { /* */ }`).

## 6. ADMIN UI inventory

`src/app/admin/**` (all static-exported; auth gate is client-side only; layout sets `robots: noindex`):
- `layout.tsx` — shared shell wrapper + noindex metadata.
- `page.tsx` — dashboard: `getAllArticles()` at **build time** (MDX only, ~486; the ~1700 dynamic DB articles are invisible — 11g.1) → `AdminDashboard`.
- `login/page.tsx` — `AdminLoginForm`.
- `articles/page.tsx` — build-time MDX list → `AdminArticlesList`. **No `articles/[slug]/` route exists** — `AdminArticlesList` links every row to `/admin/articles/<slug>/` which 404s; `AdminArticleDetail.tsx` is orphaned (never routed).
- `analytics/page.tsx` → `AdminAnalyticsDashboard` (calls photo-upload `/analytics/summary` with user JWT).
- `photos/page.tsx` → `AdminPhotoModeration` (direct Supabase anon-client reads/updates of `photos`; empty catch blocks).
- `questions/page.tsx` → `AdminArticleQuestions` (direct anon-client updates of `article_questions`; empty catch blocks).
- `push/page.tsx` → `AdminPushNotifications` (posts to subscriptions `/admin/push/fan-out`; **admin pastes ADMIN_API_KEY into a form field**).
- `responder/page.tsx` → `AdminResponder` (subscriptions `/admin/responder/*`; same pasted-key pattern).

`src/components/admin/**`:
- `AdminShell.tsx` — sidebar/topbar; **dead links `href="#"`**: Категории, Теги, Настройки (11g.6); swallows profile-fetch errors silently.
- `AdminDashboard.tsx` — overview cards from build-time articles.
- `AdminArticlesList.tsx` — sort/filter/search table; broken detail links (above); read-only.
- `AdminArticleDetail.tsx` — metadata + MDX viewer w/ copy button; unrouted.
- `AdminLoginForm.tsx` — password login + role gate.
- `AdminPhotoModeration.tsx` — reader-photo moderation; direct DB writes; silent catches.
- `AdminArticleQuestions.tsx` — Q&A moderation + answers; direct DB writes; silent catches.
- `AdminAnalyticsDashboard.tsx` — analytics from worker `/analytics/summary`.
- `AdminPushNotifications.tsx` — push fan-out form w/ manual admin key.
- `AdminResponder.tsx` — VK/FB draft review queue w/ manual admin key.

## 7. PROPOSED ARCHITECTURE

### 7.1 New worker: `sovetydoma-admin-api` (`workers/admin-api/`)
Plain fetch handler (matches house style), no routes in wrangler.toml; reached directly from the browser (`NEXT_PUBLIC_ADMIN_API_URL=https://sovetydoma-admin-api.filippmiller.workers.dev`) with CORS restricted to `https://1001sovet.ru` (+ localhost dev). Bindings: `ARTICLE_IMAGES` R2 (bucket `sovetydoma-article-images`), optional KV `ADMIN_RATE_LIMIT_KV`. Secrets via `wrangler secret bulk`: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `RENDERER_PURGE_SECRET` (shared with renderer), image-gen provider keys later (11g.4). Vars: `SUPABASE_URL=https://api.1001sovet.ru`, `RENDERER_URL`, `SITE_URL`, `ALLOWED_ORIGINS`.

**AuthN/AuthZ on every request (except CORS preflight):** copy `validateAdmin()` from photo-upload — `GET /auth/v1/user` (anon apikey, Bearer = caller JWT) → `GET /rest/v1/profiles?select=role` (service role) → require `admin`. Fail closed 401/403. Cache the role verdict per-token-hash in KV for ≤5 min to avoid 2 upstream calls per click. Never expose service-role to the client; the browser only ever holds the user's own GoTrue JWT (same as today's photo upload).

### 7.2 Route table
| Method & path | Purpose |
|---|---|
| `GET /admin/articles` | Paginated list over `content_matrix` (+ later MDX reconciliation per 11g.1): filters `text_status`, `category`, `disposition`, `published_via`, search (trgm indexes exist), `updated_at` sort |
| `GET /admin/articles/:id` | Full row incl. `body_md`, `frontmatter`, quality fields, `updated_at`, `revision_count` |
| `PATCH /admin/articles/:id` | Metadata/body edit. Requires `If-Match`/`updated_at` (optimistic concurrency) + `Idempotency-Key` header; PATCH PostgREST with `id=eq.&updated_at=eq.` → 0 rows ⇒ 409 |
| `POST /admin/articles/:id/publish` | approved→published: sets status/published_at/image_url/`published_via`, upserts `articles_publication_index`, purges renderer caches, audit event (mirrors publish-dynamic.mjs semantics minus local files) |
| `POST /admin/articles/:id/unpublish` | published→approved (or new `unpublished` state per 11g.1); purges article+sitemap+hub caches → URL starts 404ing (renderer only serves `text_status=published`); agreed 404/410 behavior per 11g.5 |
| `POST /admin/articles/:id/republish` / `schedule` | status flips + `scheduled_for` |
| `GET /admin/articles/:id/revisions` + `POST /admin/articles/:id/rollback` | revision snapshots (see audit schema) |
| `GET /admin/media?prefix=` | R2 list (heroes/previews) joined with `content_matrix.image_filename` |
| `POST /admin/media/upload` | Raw bytes + key; same key regex as renderer `PUT /__r2/`; **always writes a new versioned key** (`<slug>-v<n>.jpg` or content-hash suffix) — never overwrites immutable URLs; updates `image_filename` atomically |
| `POST /admin/media/generate` (11g.4) | Async job row (`admin_jobs` table) → provider call → candidate keys → assign/rollback; candidates also new immutable keys |
| `GET/POST /admin/audit` | Searchable audit read |
| `GET /admin/health` | config/version |

Renderer addition (11g.5): `POST /__purge` on `sovetydoma-renderer`, gated by `x-purge-secret` (timing-safe compare), body `{category, slug}` → `caches.default.delete()` for: article key, `__internal/cat-rows/{category}`, all `stati/{category}/*` hub pages (page count computable from row count), `stati` index, `sitemap-dynamic.xml?generator=v3`. Called by admin-api after every publish/unpublish/edit/media change. For cross-PoP completeness add per-slug `v=` from KV into cache keys later (accept ≤10 min residual otherwise).

### 7.3 Audit / revisions schema (new migration)
```sql
create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,            -- auth.users id from validated JWT
  actor_email text,                  -- denormalized for search
  action text not null,              -- article.update / article.publish / media.assign / ...
  target_type text not null,         -- content_matrix | media | taxonomy
  target_id text not null,           -- uuid or slug/key
  before jsonb,                      -- snapshot of changed fields
  after jsonb,
  idempotency_key text,              -- dedup retries
  request_id text,                   -- cf-ray
  created_at timestamptz not null default now()
);
-- unique partial index on idempotency_key where not null → idempotent retries
-- RLS: service_role only; append-only (no UPDATE/DELETE grants)
create table public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  matrix_id uuid not null references public.content_matrix(id) on delete cascade,
  revision int not null,             -- mirrors content_matrix.revision_count+1
  snapshot jsonb not null,           -- full row pre-update
  actor_id uuid, created_at timestamptz not null default now(),
  unique (matrix_id, revision)
);
```
Keep writing `content_matrix_events` too (factory scripts already do) so existing tooling keeps working.

### 7.4 Concurrency & idempotency
- **Optimistic concurrency:** client sends last-seen `updated_at`; PostgREST `PATCH /content_matrix?id=eq.X&updated_at=eq.T` with `Prefer: return=representation`; empty result ⇒ re-check existence ⇒ 409 `conflict` (the trigger bumps `updated_at` on every write). `revision_count` incremented in the same PATCH.
- **Idempotency:** mutating endpoints require `Idempotency-Key`; first write inserts audit row with that key (unique index); replay returns the stored result (audit-before-write pattern). Status transitions are naturally idempotent via `from_value` checks (`text_status=eq.approved` guard in the PATCH query).

### 7.5 Admin UI changes (11g.3)
- New runtime `src/lib/admin-api.ts` client: obtains token from `getSupabase().auth.getSession()`, calls admin-api; surfaces errors (kills the `catch { /* */ }` pattern).
- `AdminArticlesList` switches from build-time `getAllArticles()` to paginated admin-api list (static + dynamic corpus per 11g.1).
- Add `src/app/admin/articles/[slug]/page.tsx` with `generateStaticParams` impossible for dynamic slugs → serve a generic client detail page (e.g. `/admin/article/?slug=…` static route reading the query param — static-export-compatible) or accept Caddy fallback 404 fix; simplest static-compatible approach: query-param detail page.
- Replace `#` nav links (11g.6 scope), retire `AdminArticleDetail` MDX-only view into an editor with preview + autosave draft (frontmatter/body_md via PATCH), publish/unpublish buttons wired to admin-api.

---

## 8. Blockers / risks discovered

1. **`/admin/articles/[slug]/` route missing** — list links are broken today (11g.3 must add it).
2. **Admin list shows only ~486 MDX articles; ~1700 dynamic `content_matrix` articles invisible** (11g.1 reconciliation is a hard prerequisite for a complete manager).
3. **Static-first split-brain**: Caddy serves a static file if it exists — editing/unpublishing an article that ALSO has a static `out/<cat>/<slug>/index.html` will NOT take effect until the nightly rebuild removes it. Dynamic-only edits are instant. The unified state model (11g.1) must handle "shadowed by static" articles.
4. **Cache API purge is per-colo** — a `POST /__purge` only clears the colo it lands in; residual staleness bounded by TTLs (article 300 s, cat-rows/hubs 600 s, sitemap 3600 s). Needs either acceptance + docs or KV-versioned keys.
5. **Two admin auth models coexist** (pasted `ADMIN_API_KEY` vs Supabase JWT+role). 11g.2 should standardize on JWT+role and migrate push/responder UIs; keep `ADMIN_API_KEY` for machine callers.
6. **`IMAGE_REPLACEMENTS` per-slug code map + immutable-URL incident** (bead sovetydoma-u0l) — must be replaced by versioned keys + DB-driven `image_filename` (no worker redeploy for media swaps).
7. **Renderer fetchArticle is read-only on `text_status=published`** — an `unpublished` state value must be chosen that the renderer excludes (it already excludes anything ≠ published).
8. **PostgREST 1,000-row cap** — admin list pagination must use explicit limit/offset (pattern exists in renderer `fetchAllPages`).
9. **No Caddy changes are needed** for the admin API if the browser calls `*.workers.dev` directly (established pattern); routing `/api/admin/*` through Caddy is optional and would require VPS Caddyfile edits (out of repo).
10. Recent production incident (2026-07-18 disk exhaustion, beads 11g.8.1/.8.2) — verify Supabase REST health before integration tests.
