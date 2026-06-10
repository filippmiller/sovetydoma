# Security Audit — 2026-06-10

Scope: workers/subscriptions, workers/photo-upload, supabase/migrations, src/app/auth, .github/workflows, secrets scan, client-side XSS.

## CRITICAL

1. **Live production secrets on disk in plaintext** — `.env.local` (untracked, but on disk): `SUPABASE_SERVICE_ROLE_KEY` (bypasses all RLS), `RESEND_API_KEY`, `YANDEX_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_CLIENT_SECRET`. Fix: rotate all, move to secrets manager / OS keyring.
2. **Unsplash API key in `HANDOFF-RESUME.md`** (gitignored but on disk, key inline). Fix: revoke key, keep keys only in `.secrets/`. (Related bead: sovetydoma-csv.)
3. **CORS wildcard fallback** — `workers/photo-upload/src/index.ts:37`: `env.ALLOWED_ORIGIN || '*'` on authenticated upload/file routes. Fix: fail closed (503) when unset.

## HIGH

4. **Non-timing-safe token comparison** — `workers/photo-upload/src/index.ts:164`: `expected !== signature` for HMAC contact token. Fix: use `timingSafeEqual` (as in subscriptions worker).
5. **RLS enabled, zero policies** — `notification_rate_limits`, `recipient_social_actions` (202606021300), `social_publications` (202606061300). Fix: explicit `for all to service_role` policies; document anon deny.
6. **Analytics tables: RLS, no policies; admin functions not SECURITY DEFINER** — `analytics_sessions/pageviews/events` (202606020015). Fix: service_role policies + `security definer` on admin functions.
7. **GitHub Actions script injection** — `telegram-notify.yml:31`: `${{ steps.articles.outputs.files }}` interpolated into `