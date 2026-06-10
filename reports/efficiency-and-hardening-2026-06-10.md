# Efficiency audit + RLS/headers hardening — 2026-06-10

Covers beads **sovetydoma-wf6** (efficiency), **sovetydoma-5sn** (RLS/grants), **sovetydoma-e8r** (security headers).

## wf6 — Efficiency findings

### Finding E1 (HIGH, scaling risk) — 2.8 MB VK publication index bundled into the worker
`workers/subscriptions/src/social/vk.ts` statically imports `generated/vk-publication-index.json` (2.8 MB, 392 articles). **95% of the size (~1.42 MB) is the `plain_text` field** — the full article body of every published article, embedded in the worker bundle so `findArticleRecord()` can build full-text VK posts (VK limit is 60000 chars; avg body 3.6k, max 8.8k).

**Why it matters:** the index is regenerated from `src/content/articles/*.mdx`. As the content factory publishes the ~1700 drafted articles, this bundle grows roughly linearly → **~12 MB**, which will blow past the Cloudflare Worker script-size limit and slow cold starts. It is the single biggest scaling risk in the worker.

**Recommended fix (deliberate, do NOT hot-patch the live autopost path):**
1. Add `plain_text text` to `articles_publication_index` (DB) and backfill from the current bundle.
2. Update `scripts/sync-subscription-publication-index.mjs` to populate `plain_text` going forward.
3. In `vk-autopost.ts` / `fb-autopost.ts`, include `plain_text` in the row already fetched from the DB and pass the record into `publishArticleToVk`/`publishArticleToFacebook`; keep `findArticleRecord` (bundle) as a fallback during rollout.
4. Once verified, regenerate the bundle **without** `plain_text` (≈95% size cut, 2.8 MB → ~0.15 MB) or drop the import entirely.
Risk: touches the just-stabilised VK/FB posting path → schedule as its own change with tests, not mid-operation.

### Finding E2 (LOW) — build-time observations
- `pnpm build` runs `validate-articles → build-metadata → article-index → questions-index → sitemap → rss → next build` serially. Fine at current scale; the per-category RSS + sitemap regenerate fully each build (acceptable).
- Generated artifacts (`public/sitemap.xml`, `public/feed-*.xml`) are committed AND regenerated at build; only `lastBuildDate` churns. Consider not committing the RSS `lastBuildDate` (or committing without it) to avoid noisy diffs — minor.

## 5sn — RLS + function grants: VERIFIED COMPLETE (no change needed)
Live DB inspection on `plwkjdpuxjkmpkqiqzkk`:
- **All 32 public tables have RLS enabled and ≥1 policy.** The prior-audit "RLS on, zero policies" gaps (`notification_rate_limits`, `recipient_social_actions`, `social_publications`, analytics_*) are all closed — each has a `service_role`-only policy.
- **All 7 SECURITY DEFINER functions** (`get_secret`, `handle_new_user`, `notification_check_rate_limit`, `ingest_analytics_event`, `check_ingestion_rate_limit`, `bump_feedback_counter`, `refresh_answers_count`) grant `EXECUTE` only to `postgres` + `service_role` — PUBLIC/anon/authenticated revoked. The sensitive `get_secret` (Vault reader) is correctly locked down.
- Residual recommendation (not blocking): `profiles` SELECT policy is "viewable by everyone" → roles are world-readable (admin enumeration). Tighten if public profile display doesn't require it. (The role-escalation hole itself was fixed in `202606101900` — see security audit report.)

## e8r — Security headers: DONE (worker), TODO (nginx)
Added baseline security headers to every `sovetydoma-subscriptions` worker response (`withCors`):
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`. HTML responses (the confirm page) also get a strict CSP: `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`. Worker tests 18/18 green.
**Remaining (infra, off-repo):** add CSP + the same baseline headers to the static-site responses on the VPS (nginx/Caddy serving `1001sovet.ru`). The static site's CSP needs to allow its real script/style/img/connect sources (Yandex Metrika, Supabase, the workers) — define from the deployed `<head>` and connect targets.
