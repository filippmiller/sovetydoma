# Plan — Growth Features 6, 7, 8, 10 for SovetyDoma

## Branch
`feat/growth-6-7-8-10` off latest master (already created, local stash held WIP).

## Constraints
- One migration per feature in `supabase/migrations/` (timestamp AFTER 202606161200).
- Default-deny RLS; copy UGC rate-limit trigger pattern from `202606102100_ugc_rate_limit_triggers.sql`.
- NEVER hardcode secrets; use `wrangler secret` / env vars. Document names only.
- DUAL rendering: static MDX page + `content_matrix`/`workers/renderer` path.
- Russian UI text, English code. No deploy, no merge.

---

## Feature 6 — `/q/` Q&A Flywheel (article_questions)

### Migration
- `supabase/migrations/202606161300_article_questions.sql`
- Table `article_questions`:
  - `id uuid primary key default gen_random_uuid()`
  - `article_slug text not null`
  - `question text not null`
  - `status text not null default 'pending' check (status in ('pending','approved','rejected'))`
  - `answer text null`
  - `created_at timestamptz default now()`
  - `ip_hash text null` (sha256 of IP for rate-limiting)
- Enable RLS.
- Policies:
  - `service_role all`
  - `anon INSERT` with `status = 'pending'`
  - `public SELECT` only `status = 'approved'`
  - `authenticated SELECT own` (if we add user_id later; skip for now, keep minimal)
- Rate-limit trigger via `enforce_ugc_rate_limit` with scope `article_question`.

### Worker endpoint
- In `workers/photo-upload/src/index.ts` (or new worker? Reuse photo-upload since it already has public POSTs, CORS, Turnstile, rate-limit infra).
- `POST /article-question`:
  - Validate Turnstile token.
  - Validate input: `article_slug` (exists in content_matrix or article-index), `question` (1–500 chars, strip HTML).
  - Compute `ip_hash` = SHA-256 of `CF-Connecting-IP`.
  - Rate-limit via `check_ingestion_rate_limit` (scope `article_question:ip_hash`).
  - Insert into `article_questions` via service-role Supabase REST.
  - Return `{success:true, id}`.
- `GET /article-questions?article_slug=xxx` (public):
  - Select `status='approved'` rows via anon key (or service-role + filter, but better use public policy).
  - Rate-limit: none for reads (cache-friendly).

### Frontend
- `src/components/ArticleQaBlock.tsx` — article-footer block:
  - Lists approved questions/answers for the article.
  - Prompt "Есть вопрос по теме?" + form (Turnstile, question textarea, submit).
  - No auth required for asking (anon insert via worker).
- `src/app/q/page.tsx` — listing page of all approved article questions (SSG-friendly, client-fetched or generateStaticParams from a new index).
- Admin panel: `src/components/admin/AdminArticleQuestions.tsx`
  - Table of all rows, approve/reject buttons, inline answer textarea.
  - Uses `getServiceClient` pattern (server-side in admin page, or client with admin auth).
- Add nav item in `AdminShell`.

### Renderer coverage
- Worker `workers/renderer/src/index.ts` injects `ArticleQaBlock` into template pages (like other article widgets).

---

## Feature 7 — VK Mini-App Checklist Mode

### VK mini-app changes
- Modify `vk-miniapp/src/App.tsx` / article panel to detect procedural content:
  - Check `frontmatter.recipeSteps` (array of strings) OR parse markdown for numbered H2s (`## 1. ...`, `## 2. ...`).
- If procedural, render a "Checklist mode" toggle/button.
- Checklist UI: tickable items with `Checkbox` from VKUI, progress bar, "Share completion" button.
- Store progress in `localStorage` (key: `sovetydoma_checklist_${articleSlug}`).
- Share via `VKWebAppShare` with text showing completion %.

### No new secrets.

---

## Feature 8 — Favorites 2.0 Named Collections

### Migration
- `supabase/migrations/202606161400_collections.sql`
- Table `collections`:
  - `id uuid primary key default gen_random_uuid()`
  - `owner_id uuid not null references auth.users(id) on delete cascade`
  - `name text not null`
  - `slug text not null` (auto-generated from name, unique per owner)
  - `is_public boolean not null default false`
  - `created_at timestamptz default now()`
  - Unique: `(owner_id, slug)`
- Table `collection_items`:
  - `collection_id uuid not null references collections(id) on delete cascade`
  - `article_slug text not null`
  - Primary key: `(collection_id, article_slug)`
- Enable RLS on both.
- Policies:
  - `collections`: owner full CRUD; public SELECT only `is_public = true`; service_role all.
  - `collection_items`: owner full CRUD via collection ownership; public SELECT only via public collection; service_role all.
- Rate-limit triggers on `collections` (owner scope) and `collection_items` (moderate).

### Frontend
- Upgrade `src/components/FavoriteButton.tsx` and `CardFavoriteButton.tsx`:
  - On click for authenticated users: show a popover/dropdown to choose a collection (or create new).
  - Also support legacy "just favorite" (default collection or saved_articles).
- Upgrade `src/app/izbrannoe/page.tsx`:
  - Show user's collections + articles.
  - Allow CRUD of collections.
- New page `src/app/kollekcii/[userId]/[slug]/page.tsx`:
  - Public collection page (SSG not possible with static export for dynamic user IDs; use client-rendered from Supabase or document SSR limitation).
  - Given static export constraints, this must be a client-side page that fetches the collection by owner+slug and renders articles.

### Renderer coverage
- Worker injects collection-related metadata if needed (optional).

---

## Feature 10 — Web Push for Followed Categories

### Migration
- `supabase/migrations/202606161500_push_subscriptions.sql`
- Table `push_subscriptions`:
  - `endpoint text primary key`
  - `p256dh text not null`
  - `auth text not null`
  - `category text not null` (or `text[]` for multiple categories? The task says "category", singular per row. Use multiple rows for multiple categories.)
  - `created_at timestamptz default now()`
- Enable RLS.
- Policies:
  - `anon INSERT` (anyone can subscribe).
  - `anon DELETE` where endpoint matches (self-unsubscribe; no auth uid, so we use endpoint itself as the key — no strict ownership, but anon can only delete by exact endpoint which is effectively a secret).
  - `service_role SELECT all` (for fan-out).

### Service Worker
- Extend `public/sw.js`:
  - Listen for `push` event.
  - Show notification with title/body/icon from payload.
  - Handle `notificationclick` to open the article URL.
- Add `subscribeToCategory(category)` and `unsubscribeFromCategory(endpoint)` functions exposed to the page.

### Frontend
- `src/components/CategoryPushSubscribe.tsx` — opt-in UI on category pages (and article pages, showing the article's category).
  - Button: "Уведомлять о новых статьях" / "Отключить уведомления".
  - Uses `navigator.serviceWorker.ready` to get the registration, then `pushManager.subscribe()`.
  - Sends subscription to worker endpoint `POST /push/subscribe`.
- No login required.

### Worker endpoint
- In `workers/subscriptions/src/index.ts`:
  - `POST /push/subscribe`:
    - Store subscription in `push_subscriptions` via service-role.
    - Validate `endpoint`, `p256dh`, `auth`, `category`.
    - Return `{success:true}`.
  - `POST /push/unsubscribe`:
    - Delete by `endpoint`.
    - Return `{success:true}`.
  - `POST /admin/push/fan-out` (or hook into existing publish flow):
    - When a new article publishes (in `content_matrix` or static), query all `push_subscriptions` for that category.
    - Send Web Push via VAPID using `web-push` or Cloudflare Workers `crypto.subtle` + manual VAPID JWT + HTTP POST to each endpoint.
    - Document required secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (names only).

### Secrets
- `VAPID_PUBLIC_KEY` — used in frontend `applicationServerKey`.
- `VAPID_PRIVATE_KEY` — used in worker to sign VAPID JWT.
- `VAPID_SUBJECT` — mailto: or https: contact (optional, can be hardcoded as site URL since it's public info, but better as env var).

---

## Green Gates (run after all features)
1. `npx tsc --noEmit` (strict, no errors)
2. `pnpm lint` (no errors)
3. `pnpm test` (all pass)
4. `pnpm build` with `NODE_OPTIONS=--max-old-space-size=6144` (static export succeeds)
5. `npx wrangler deploy --dry-run` for each touched worker.

---

## Deliverable
- Branch `feat/growth-6-7-8-10` with commits per feature.
- `HANDOFF-growth-6-7-8-10.md` with:
  - Per-feature: what changed, files touched, test steps, renderer coverage.
  - Per-table RLS proof (anon / authenticated / service_role can/cannot).
  - Self code-review P0–P3 table (all fixed).
  - Gate results (tsc, lint, test, build, dry-run).
  - New migration list.
  - Secrets/manual steps before deploy (VAPID, Turnstile, KV).

## Stage Plan

### Stage 1 — Migrations & DB Schema
Implement all 4 migrations in parallel (no interdependencies). Validate with `npx tsc --noEmit` (migrations are SQL, so just ensure no TypeScript breakage).

### Stage 2 — Feature 6 (Q&A flywheel)
Implement migration, worker endpoint, frontend block, admin panel, `/q/` page. Test.

### Stage 3 — Feature 8 (Collections)
Implement migration, frontend upgrades, public collection page. Test.

### Stage 4 — Feature 7 (VK checklist) & Feature 10 (Web Push) in parallel
Both are isolated from each other and from 6/8.

### Stage 5 — Self Review & Fix
Spawn adversarial reviewers per feature. Fix P0–P3. Re-run gates.

### Stage 6 — Handoff Document
Write `HANDOFF-growth-6-7-8-10.md`.

## Skill Loading
- `swarm-coding` at Stage 2–4 for parallel subagent implementation.
- `secure-code-review` at Stage 5 for adversarial review.
- No artifact skills needed (no docx/pdf/pptx).
