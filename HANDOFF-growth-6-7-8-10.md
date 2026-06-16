# HANDOFF: Growth features 6, 7, 8, 10 — `feat/growth-6-7-8-10`

Implemented by a Kimi subagent, **audited + integrated + deployed by Claude** (2026-06-16).

## Status: LIVE & functional

All 4 features implemented, audited, migrations applied to the live RU DB, workers
deployed, VAPID provisioned, gates green.

---

## Per-feature

### F6 — Q&A flywheel
- Client: `ArticleQaBlock` on every article (asks + shows approved Q&A), `/q/` page.
- Worker (photo-upload): `POST /article-question` (validates, per-IP KV rate-limit
  4/min+30/hr, HTML-strips, inserts `status='pending'` via service role), `GET
  /article-questions?article_slug=` (approved only).
- Admin: `AdminArticleQuestions` (approve/reject + write answers), `/admin/questions`.
- **Verified live:** real question POST → `{"success":true}` 200, row inserted pending.
- **Turnstile is progressive** (audit change): enforced only when `TURNSTILE_SECRET_KEY`
  is set. The site has no Turnstile widget yet, so questions are currently protected by
  the per-IP rate-limit + the pending-moderation gate. Set up a Cloudflare Turnstile
  widget (see Secrets) to enable the bot challenge.

### F7 — VK mini-app checklist
- `vk-miniapp/`: tickable checklist for procedural articles (recipeSteps / numbered H2),
  progress, share via VKWebAppShare. Build-time content pipeline updated.

### F8 — Collections 2.0
- `FavoriteButton` + `CollectionDropdown` (pick/create named collection), `/izbrannoe`
  shows collections, public collections at `/kollekcii/{user}/{slug}` (client-rendered
  under static export). `src/lib/collections.ts` = client CRUD via the authenticated
  Supabase session (RLS-gated).

### F10 — Web Push
- `public/sw.js`: push + notificationclick. `CategoryPushSubscribe` on category/article
  pages (anonymous opt-in). Worker (subscriptions): `/push/subscribe`, `/push/unsubscribe`
  (service role), `/admin/push/fan-out` (admin-only, VAPID JWT + aes128gcm via crypto.subtle).
  Admin sender UI at `/admin/push`.
- **VAPID provisioned:** keypair generated; `VAPID_PRIVATE_KEY` set as a subscriptions
  wrangler secret; `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `.env.local` + inlined in deploy.yml
  (public key). `VAPID_SUBJECT=mailto:admin@1001sovet.ru`.

---

## RLS proof (applied to live RU DB, verified via pg_policies + grants)

| Table | anon | authenticated | service_role |
|---|---|---|---|
| `article_questions` | SELECT approved only. **No INSERT** (audit fix — submissions go through the Turnstile/rate-limited worker via service role). | same as anon + moderator policy (role∈{moderator,admin}) can manage all. | ALL. |
| `collections` | SELECT where `is_public`. | full CRUD on own (`auth.uid()=owner_id`, with-check); moderators manage all. | ALL. |
| `collection_items` | SELECT items of public collections. | CRUD on items of own collections. | ALL. |
| `push_subscriptions` | **none** (audit fix — removed `anon DELETE USING(true)` that allowed wiping the whole table; grants revoked). | none. | ALL (worker is sole gateway). |

Rate-limit triggers (`enforce_ugc_rate_limit`, keyed by `auth.uid()`, no-ops for
service-role/anon): collections 2/10min+10/day, collection_items 12/10min+50/day,
article_questions defined but no-op (worker inserts as service role → worker rate-limits).

---

## AUDIT findings (Claude) — bugs the self-review missed, all FIXED

| Sev | Issue | Fix |
|---|---|---|
| **P0** | `push_subscriptions` had `FOR DELETE TO anon USING (true)` — anyone with the public anon key could `DELETE FROM push_subscriptions` and wipe every subscription. | Removed both anon policies; service_role-only; `revoke all from anon, authenticated`. |
| **P1** | photo-upload worker `SUPABASE_URL` pointed at the **old EU Supabase** → Q&A inserts 502'd, and views/analytics were silently written to the wrong DB (split-brain vs the RU DB the app reads). | Switched worker to `https://api.1001sovet.ru`; set RU service+anon keys; applied the missing `ingest_analytics_event` RPC to RU + reloaded PostgREST. |
| **P2** | `article_questions` `anon INSERT` policy let bots bypass the worker's Turnstile by POSTing directly with the anon key. | Removed the anon INSERT policy; inserts only via the worker. |

Kimi's own self-review fixes (verified present): CategorySubscriptionCta restored next to
CategoryPushSubscribe (P0); fan-out DELETE for stale subs (P2); avto category in admin (P3).

---

## Gates (run by Claude)
- `npx tsc --noEmit` ✅ 0 · `pnpm lint` ✅ 0 errors 0 warnings · `next build` ✅ (out/ + new
  routes /q /kollekcii /admin/push /admin/questions) · worker tests ✅ · all 3 migrations
  applied + RLS verified · both workers deployed + smoke (Q&A insert 200).

## Migrations applied to live RU DB
- `202606161301_article_questions.sql`, `202606161400_collections.sql`,
  `202606161500_push_subscriptions.sql` (+ re-applied `202606020025_analytics_ingest_rpc.sql`).

## Secrets / manual steps
- **Done:** VAPID keypair (private→worker secret, public→.env.local+CI), photo-upload RU
  `SUPABASE_URL` + service/anon keys, KV namespace for contact rate-limit (earlier).
- **Optional (to enable Turnstile bot-challenge on Q&A):** create a Cloudflare Turnstile
  widget → set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (CI/build) + `TURNSTILE_SECRET_KEY`
  (`wrangler secret put` on photo-upload). Until then Q&A relies on rate-limit + moderation.
- **Web Push** also needs HTTPS + a service worker (present) and works on supported browsers.
