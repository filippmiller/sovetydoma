# Security Audit (follow-up) — 2026-06-10 — subscriptions worker, RLS, OAuth, deploy, admin

**Bead:** sovetydoma-u15. **Supersedes/extends:** `reports/security-audit-2026-06-10.md` (earlier pass).
**Scope:** `workers/subscriptions/src/**`, Supabase RLS + advisors, `src/app/admin/**` + `src/lib/admin-auth.ts`, `.github/workflows/{deploy,content-autopublish,telegram-notify}.yml`, tracked-file secret scan.
**Method:** source review + live DB inspection (pg_policy, triggers, advisors) on project `plwkjdpuxjkmpkqiqzkk`.

## Headline
One **P0 privilege-escalation** was found **and fixed + verified** during this audit (see C1). Everything else is solid; remaining items are P1–P3 defense-in-depth / config / off-repo verification. Prior-audit HIGH findings are now resolved.

---

## 🔴 C1 (P0) — Self-escalation to admin via `profiles.role` — FIXED 2026-06-10
**Issue:** RLS policy "Users can update own profile" was `UPDATE USING (auth.uid()=id)` with **no WITH CHECK and no column/trigger guard**. Any authenticated user could `update profiles set role='admin' where id=auth.uid()` and then pass the admin gate (`useAdminAuth` → `profiles.role==='admin'`) → full admin access.
**Fix (applied, migration `202606101900_guard_profiles_role_escalation.sql`):** `before update` trigger `guard_profiles_role()` reverts any `role` change made by a browser-facing JWT role (`authenticated`/`anon`); `service_role` and direct SQL can still assign roles. JSON-claims parse hardened against unset/empty/invalid values.
**Verified:** authenticated `set role='admin'` → row stays `user`; direct-SQL changes still apply. ✅
**Residual:** consider also revoking column-level `update(role)` from `authenticated` as defense-in-depth, and tightening "Profiles viewable by everyone" (currently any role is world-readable — low-risk info disclosure).

---

## ✅ Prior-audit findings — current status (re-verified)
| Prior item | Status |
|---|---|
| HIGH#4 photo-upload non-timing-safe token compare | **FIXED** — now `timingSafeEqual` (`workers/photo-upload/src/index.ts:180`) |
| CRIT#3 photo-upload CORS `|| '*'` wildcard | **FIXED** — defaults to `https://1001sovet.ru`; wildcard only if explicitly configured |
| HIGH#7 telegram-notify.yml script injection | **FIXED** — filename passed via `env: FILES`, not inline `${{ }}` |
| HIGH#5 RLS enabled / zero policies on `notification_rate_limits`, `recipient_social_actions`, `social_publications` | **FIXED** — each now has a `service_role`-only policy (verified via pg_policy) |
| HIGH#6 SECURITY DEFINER admin funcs / EXECUTE grants | **ADDRESSED** — migration `202606101500` restricts EXECUTE to service_role |
| CRIT#1/#2 live secrets on disk / Unsplash key in HANDOFF | **OPEN (ops)** — not in tracked files, but rotate + Vault (bead sovetydoma-csv) |

---

## ✅ Verified strengths (subscriptions worker)
- Admin auth `requireAdmin` — constant-time `timingSafeEqual`, fail-closed 503 when key unset.
- Webhooks all authenticated & fail-closed: Telegram (secret header), Max (secret), WhatsApp (HMAC body sig + GET verify token), Resend (Svix sig **+ ±5-min timestamp = replay protection**).
- Rate limits: atomic DB RPC on start/manage/vk-id/social-track.
- Service-role used server-side only; **no `SERVICE_ROLE` in `src/`**, client gets only safe `NEXT_PUBLIC_*` (anon key + URLs).
- PII: IPs HMAC-hashed; contacts masked; tokens are CSPRNG + stored as SHA-256 hashes; unsubscribe tokens HMAC-signed.
- Static export (`output:'export'`) → no web-tier server runtime / no API routes.
- Admin gate validates token via `getUser()` (server-side), not just local session.
- RLS advisor clean except `pg_trgm` in `public` (WARN). No committed secrets in tracked files.

---

## ⚠️ Remaining findings
- **F1 (P1) — deploy webhook handler is off-repo.** `deploy.yml` POSTs the release tarball to `https://1001sovet.ru/__deploy/upload` (Bearer `DEPLOY_WEBHOOK_TOKEN`). Verify the VPS handler: constant-time token compare, body-size cap, tar path-traversal/symlink protection, auth-before-spool, least privilege. Not reviewable from this repo.
- **F2 (P2) — admin enforcement is client-side; relies on RLS.** Static site → `/admin/*` JS gate is bypassable; the real boundary is RLS. C1 closed the `profiles` escalation; still confirm admin-writable tables (e.g. `content_matrix` is correctly `service_role`-only; any future admin-write tables) never grant privileged writes to plain `authenticated`.
- **F3 (P2) — `isAllowedOrigin` returns true when `Origin` absent** (`index.ts:62`); non-browser clients bypass the allowlist. Mitigated by Turnstile/rate-limit/tokens. Prefer requiring origin on state-changing POSTs.
- **F4 (P2) — Turnstile config bypass.** If `TURNSTILE_SECRET_KEY` unset, start accepts unverified when `SUBSCRIPTIONS_ALLOW_UNVERIFIED_TURNSTILE='true'`. Confirm prod has the secret set and the bypass flag off.
- **F5 (P1, ops) — rotate exposed Anthropic/Unsplash keys** (bead sovetydoma-csv). Not in tracked files; rotate + Vault.
- **F6 (P3) — `pg_trgm` in `public` schema** (advisor WARN). Move to a dedicated schema.
- **F7 (P3) — confirm prod channel secrets** set for every live channel (webhooks fail-closed if missing).

## Priority summary
| ID | Item | Priority | Status |
|----|------|----------|--------|
| C1 | profiles role self-escalation | **P0** | **FIXED ✅** |
| F1 | VPS `__deploy/upload` handler review | P1 | open (infra) |
| F5 | rotate exposed keys | P1 | open (user) |
| F2 | admin-table RLS correctness | P2 | partly closed by C1 |
| F3 | origin check without header | P2 | open |
| F4 | Turnstile prod config | P2 | verify |
| F6 | pg_trgm out of public | P3 | open |
| F7 | prod channel secrets | P3 | verify |
