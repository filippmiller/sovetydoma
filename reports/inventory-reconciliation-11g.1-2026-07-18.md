# Inventory reconciliation discovery report — bead sovetydoma-11g.1

Date: 2026-07-18. Read-only investigation. No files modified except this report; no production mutations.
DB counts obtained live via PostgREST (`Prefer: count=exact`, service key from `.env.local`, values never printed).

---

## 1. STATIC CORPUS (MDX on disk)

| Location | .mdx count | Role |
|---|---|---|
| `src/content/articles/` (flat, no subdirs) | **486** | The live static corpus, baked into `out/` at build |
| `incoming-articles/` | 261 | Staging inbox (not built, not in DB necessarily) |
| `matrix-exports/` | 100 (+ `images-unassigned/` dir) | Matrix pipeline exports |

### `getAllArticles()` — `src/lib/articles.ts`
- Scans `src/content/articles/*.mdx` (top-level only), parses each with `gray-matter`, caches in a module-level `_cache` for the build-process lifetime.
- Returns `ArticleFrontmatter & { wordCount }` sorted by `date` desc. Keyed by `category/slug` (`getArticle(category, slug)`).
- Frontmatter fields: `title, slug, category, categoryName, description, date, updated?, image, tags[], sponsored?, schemaType?(Recipe|HowTo), prepTime/cookTime/recipeYield/recipeIngredient/recipeSteps, difficulty, cost, seriesName/seriesOrder, quickAnswer, time, needs[], forWhom, seasonalMonths[], author`.
- **No status field.** Every file in the directory is implicitly "published at next build". There is no draft/unpublished concept in the static corpus.
- `LEGACY_ARTICLE_MOVES` maps 40+ slugs from old categories to new ones (category migrations already applied to URLs).

## 2. DYNAMIC CORPUS — `public.content_matrix` (Supabase, self-hosted at api.1001sovet.ru)

Schema: `supabase/migrations/20260604105305_content_matrix.sql` (+ category expansions `202606051715`, `202606101800` +avto; anon revoke `202606161300`).

### Columns (abridged)
`id uuid PK`, `domain` (default '1001sovet.ru'), `kb_source`, `taxonomy_path`, `vertical`,
**three orthogonal state axes**: `text_status` (`idea|outlined|draft|reviewed|approved|published`), `image_status` (`none|prompt_ready|generated|approved`), `disposition` (`active|needs_rework|rejected|on_hold`),
`needs_human_review`, `priority`, `title`, `slug`, `category` (CHECK: 12 categories after expansions), `description`, `tags[]`,
`body_md`, `outline jsonb`, `word_count`, `frontmatter jsonb` (lossless MDX frontmatter mirror incl. `published_via`),
image set (`image_prompt, image_filename, image_url, image_source, image_model, image_generated_at, image_meta`),
quality (`quality_score 0..1, fact_check_status, review_*, revision_count int, human_edited`),
cost (`cost_estimate_usd, tokens_used`), agent claims (`agent_claimed_by/at/expires_at`),
lifecycle (`scheduled_for, published_at, first_seen_at, created_at, updated_at`),
links (`source_article_slug, superseded_by uuid self-FK`).
**UNIQUE (domain, slug)**. Audit: `content_matrix_events(matrix_id FK, axis, from_value, to_value, agent, notes, payload)`.
Views: `v_images_to_generate`, `v_ready_to_write`, `v_publish_queue`.
RLS: service_role-only policies; anon/authenticated **fully revoked** (202606161300) — runtime admin reads need JWT+role policy or a BFF.

### Live row counts (2026-07-18, PostgREST count=exact)
| Slice | Count |
|---|---|
| total | **2495** |
| text_status=published | **2204** |
| — published & frontmatter->>published_via='dynamic' | **1718** |
| — published & published_via IS NULL | **486** (474 disposition=active, 12 needs_rework) |
| idea | 284 |
| approved | 5 (none with scheduled_for set) |
| draft | 2 |
| `articles_publication_index` total | **481** |

Published by category (DB): dacha-i-ogorod 1071, kulinaria 497, dom-i-uborka 385, layfkhaki 57, avto 57, ekonomiya 49, rybalka 43, zdorovie-i-bezopasnost 11, semya-i-deti 10, pokupki-i-tehnika 8, krasota-i-uhod 8, otdyh-i-puteshestviya 8.

### Static↔DB overlap analysis (computed by joining live DB rows against the 486 MDX frontmatters)
- DB published set has **0 duplicate (category,slug) keys** internally.
- Static↔dynamic slug collisions: **0** (no `published_via='dynamic'` row shares a slug with any static MDX, in any category).
- The 486 `published_via`-less rows (seeded by `scripts/matrix/seed-from-current.mjs` with `text_status='published'`): only **194 match a current static slug** (157 match on category+slug exactly); **292 are ghosts** — published in DB, absent from the static corpus (stale seed from an older corpus / pre-rename slugs).

## 3. PUBLICATION INDEX — `public.articles_publication_index`

Schema (`202606021300_omnichannel_subscriptions.sql`): `article_slug text PK`, `category_slug` (CHECK 12 cats), `title`, `canonical_path`, `description`, `published_at`, `first_seen_at`, `updated_at`. Public SELECT policy; FK target of `notification_delivery_items.article_slug` (ON DELETE RESTRICT).

Purpose: feed the subscriptions/social worker (VK/FB autopost candidates, digests) — NOT used by the renderer.

Writers:
1. `scripts/sync-subscription-publication-index.mjs` → `build-subscription-publication-index.mjs` — **build/deploy-time, scans MDX only** (486 static; index holds 481 → ~5 rows dropped, likely invalid dates/categories).
2. `scripts/matrix/publish-dynamic.mjs` — upserts each dynamically-published article (failure = degraded exit 1, "live but NOT autopost-eligible").

→ Two writers, two triggers, no reconciliation; PK on `article_slug` alone cannot represent a future cross-category slug collision.

## 4. RENDERER WORKER — `workers/renderer/src/index.ts` (RENDER_VERSION = **'9'**; doc `NO-REDEPLOY-PUBLISHING.md` still says 7 — stale)

### Exact article query (`fetchArticle`)
```
GET {SUPABASE_URL}/rest/v1/content_matrix
  ?slug=eq.{slug}&category=eq.{category}&text_status=eq.published&domain=eq.1001sovet.ru
  &select=slug,category,title,description,body_md,tags,image_filename,frontmatter,published_at,updated_at,word_count
  &limit=1   (service_role key, 5 s AbortController timeout; DB error → 503, miss → 404)
```
**Note:** filters on `text_status` only — **no `disposition` filter, no `published_via` filter**. The 292 ghost rows ARE served by the renderer (12 of them are `needs_rework` and still served).

Other queries:
- `fetchCategoryRows` (related links + hubs): `category=eq.X & text_status=eq.published & disposition=eq.active & domain=eq.…`, paginated 1 000/page up to 10 000, cached in Cache API 600 s (key includes `?render=9`).
- UGC: `questions` (status=approved), `comments` (is_approved, not deleted) by `article_slug`.
- Sitemap `/sitemap-dynamic.xml`: `text_status=eq.published & frontmatter->>published_via=eq.dynamic & domain=…`, paginated, cap 50 000, cached 3 600 s (key `?generator=v3`).

### Caching
- Rendered article HTML: Cache API, key `{site}/{cat}/{slug}/?render={RENDER_VERSION}`, `Cache-Control: public, max-age=300, s-maxage=600`. Hub pages: 600/1200. Images from R2: `max-age=86400, immutable`. Template shell (`TEMPLATE_URL`) cached 10 min.
- Invalidation story today: **none** — bump `RENDER_VERSION` + redeploy worker, or wait ≤10 min.

## 5. SPLIT BRAIN (docs/NO-REDEPLOY-PUBLISHING.md + Caddy)

Caddy vhost: named matcher `@dynamic` = NOT a static file AND (`/images/*` OR `/sitemap-dynamic.xml` OR `/stati/*` OR `/{category}/{slug}` for the 12 known categories). **Static files always win**; no match → reverse-proxy to `sovetydoma-renderer.filippmiller.workers.dev`.

Consequences today:
- An article existing **both** as static MDX and published in DB is served from `out/`; DB edits to it are **invisible** until a rebuild folds it in (the "nightly fold-in" is still future work). 157 such (category,slug) overlaps exist right now.
- Unpublish story: **there is none.** No script sets `text_status` back from `published`; no 'unpublished' state exists in the CHECK. Unpublishing a dynamic article = manual SQL + wait for ≤10 min cache; unpublishing a static article = delete MDX + full rebuild. The 292 ghost rows are served at live URLs yet appear in **no** sitemap, hub, or static listing (true orphans; `scripts/audit-dynamic-orphans.mjs` exists but only audits dynamic-flagged rows).

## 6. SITEMAPS & HUBS

| Surface | Source | Generator |
|---|---|---|
| `public/sitemap.xml` (static, 215 KB) | 486 MDX | `scripts/generate-sitemap.mjs` (build-time) |
| `public/feed*.xml`, `turbo.xml`, `zen.xml` | MDX only | `scripts/generate-rss.mjs`, `generate-turbo.mjs`, `generate-zen.mjs` |
| `/sitemap-dynamic.xml` | DB rows `published_via='dynamic'` | renderer worker, incl. `/stati/` hub URLs |
| Category hubs `/{category}/` | static MDX | `src/app/[category]/page.tsx` (`getArticlesByCategory`), links to `/stati/{category}/` |
| Dynamic hubs `/stati/…` (40/page) | DB published+active, `published_via='dynamic'` | renderer worker `handleHub` |

→ No single sitemap index merges the two; feeds/turbo/zen silently exclude all 1 718 dynamic articles.

## 7. ADMIN & API SURFACE

`src/app/admin/`: `page.tsx` (dashboard), `layout.tsx`, `login/`, `articles/page.tsx`, `analytics/`, `photos/`, `push/`, `questions/`, `responder/`.
`src/components/admin/`: AdminShell, AdminLoginForm, AdminDashboard, AdminArticlesList, AdminArticleDetail, AdminAnalyticsDashboard, AdminPhotoModeration, AdminPushNotifications, AdminArticleQuestions, AdminResponder.

| Admin surface | Data path |
|---|---|
| `admin/articles` list (**AdminArticlesList**) | **BUILD-TIME** `getAllArticles()` → 486 static MDX baked into HTML; all 1 718 dynamic + 284 ideas + drafts invisible |
| **AdminArticleDetail** | build-time `Article` prop; per bead 11g.3 the detail routes are missing/broken |
| Photos moderation | runtime Supabase client (`photos` table) |
| Article questions | runtime Supabase client (`article_questions`) |
| Analytics | runtime fetch → analytics worker `/analytics/summary` (admin key) |
| Push | runtime fetch → subscriptions worker `/admin/push/fan-out` |
| Responder | runtime fetch → subscriptions worker `/admin/responder/*` with `x-admin-key` |

- **No `src/app/api/` routes exist** (static export). `public/api/` contains only a static VK-callback placeholder HTML. Privileged admin API today = `workers/subscriptions/src/admin.ts` (`x-admin-key`, not Supabase JWT) — does not satisfy 11g.2.
- Auth: Supabase JWT + `profiles.role` checked client-side (`AdminShell`, `useAdminAuth`) — gate only, no server-side enforcement for content mutations.

## 8. CONTRADICTIONS / DUPLICATION RISKS

1. **292 ghost published rows** (no `published_via`, no static MDX) — served by renderer, orphaned from every index; 12 are `needs_rework` and still public.
2. **157 static↔DB (category,slug) overlaps** — DB copy is dead weight; any edit to the DB row is silently ignored (static wins at Caddy).
3. **fetchArticle lacks `disposition`/`published_via` filters** — inconsistent with hub/sitemap queries (which filter both).
4. **Two publication indexes**: `content_matrix` (renderer) vs `articles_publication_index` (autopost/digests, PK slug-only, 481 vs 486 rows, fed by 2 unsynced writers).
5. **`published_via` is buried in `frontmatter` jsonb** — the single most routing-relevant flag is unindexed, nullable, and unset on 486 rows.
6. **State machine gap**: no `unpublished`/`scheduled` in `text_status` CHECK; `scheduled_for` exists but `v_publish_queue` is the only consumer; `revision_count` is a bare counter — **no revision content storage anywhere** (rollback impossible).
7. **Feeds (RSS/turbo/zen) and static sitemap exclude dynamic corpus**; two parallel sitemap files with no sitemap index.
8. **RENDER_VERSION doc drift** (doc says 7, code says 9). Cache invalidation = redeploy worker or wait.
9. Admin sees 486 of 2495 rows (18 % of inventory); no runtime article API exists.
10. `incoming-articles/` (261) and `matrix-exports/` (100) overlap the pipeline with unclear promotion status — potential double-ingest source.

## 9. PROPOSAL — canonical runtime model (smallest migration surface)

Keep **`content_matrix` as the single canonical article table** (it already stores the full corpus: 2204 published = 100 % of live URLs). Add, don't rebuild:

### 9.1 Schema deltas (one migration)
```sql
-- 1) promote routing flag
alter table content_matrix add column published_via text
  check (published_via in ('static','dynamic'));
update content_matrix set published_via = frontmatter->>'published_via'
  where published_via is null;  -- then reconcile (see 9.2)
create index on content_matrix (domain, text_status, published_via);

-- 2) complete the state machine
alter table content_matrix drop constraint content_matrix_text_status_check;
alter table content_matrix add constraint content_matrix_text_status_check
  check (text_status in ('idea','outlined','draft','reviewed','approved',
                         'scheduled','published','unpublished'));
-- publish → text_status='published' (+published_at); schedule → 'scheduled' (+scheduled_for);
-- unpublish → 'unpublished' (keep published_at for audit); republish → 'published'.

-- 3) revisions (new table — the only new table)
create table article_revisions (
  id uuid pk default gen_random_uuid(),
  article_id uuid not null references content_matrix(id) on delete cascade,
  revision_no int not null,
  title text, description text, body_md text, frontmatter jsonb,
  image_filename text, image_url text,
  actor text, source text,          -- 'admin-api' | 'factory' | 'seed'
  created_at timestamptz not null default now(),
  unique (article_id, revision_no)
);

-- 4) kill the second index: replace articles_publication_index table with a
--    trigger-maintained projection (or a view + INSTEAD OF trigger keeping the
--    same name, so the social worker and its FK keep working).
```

### 9.2 Idempotent reconciliation backfill (dry-run first, per 11g.1 AC)
1. Match DB rows ↔ MDX by `slug` (194 rows) → `published_via='static'`.
2. 292 ghosts → decide per-row: set `published_via='dynamic'` (they ARE live dynamic URLs) or `text_status='unpublished'`; write `content_matrix_events` for every decision.
3. Backfill 5 missing `articles_publication_index` rows.
4. Initial `article_revisions` snapshot (revision_no=1, source='seed') for every row.

### 9.3 Renderer/query alignment
- `fetchArticle` gains `disposition=eq.active` (parity with hubs/sitemap).
- Long-term split-brain fix (feeds 11g.5): flip Caddy article routes to worker-first once the static corpus is fully represented in DB (it already is, minus ghost reconciliation) — static MDX becomes a build artifact, not a source of truth.

### 9.4 State machine (canonical)
```
idea → outlined → draft → reviewed → approved → scheduled → published
                                    ↖ any state → unpublished → (republish|draft)
disposition (active|needs_rework|rejected|on_hold) stays orthogonal.
Every transition: row in content_matrix_events + new article_revisions snapshot.
```

### Why this is minimal
- 1 new table, 2 ALTERs, 1 index, 1 projection swap; no data leaves `content_matrix`; renderer, publish-dynamic, social worker keep their table names; MDX build path untouched until Caddy flip.
