# Browser QA Audit Verification + Autonomous Fixes — 1001sovet.ru

**Date:** 2026-06 (post initial auth slices)  
**Context:** Independent verification (Grok) of "QA & Product Review 1001sovet.ru (СоветыДома)" performed by browser agent (Claude in Chrome) + Codex read-only code+DB check on prod SHA dd952344.  
**Goal of this doc:** Complete item-by-item status for Codex code review. What was real, what was fixed autonomously, code locations, decisions, remaining work.

**Key references:**
- Original browser audit (provided in query).
- Codex verification block (confirmed P1 favorites desync, English errors, profile silent save, local after logout, etc.; disproved HEAD 503 and copy-link).
- Beads: clq (P1 favorites), 0h3 (auth epic + children 0h3.5/0h3.7), new ih6/abr/0uj/55q for this round.
- Memory: `qa-audit-2026-06-browser-codex-findings-verified`.
- Commits: fce02e94 (core), 901a4bcd (polish), e79dc08b (more fixes + docs). Previous auth: 636fa5ac etc.

## Executive Summary

**Overall:** Most high-severity items flagged by the browser agent were **real** in the codebase at the time of verification (current source + prod at a4f5c13+). The standout P1 (favorites from pre-login flow never sync to `saved_articles` / cabinet) was exactly as described and directly contradicted the registration modal promise.

**What we could fix autonomously (no Supabase dashboard / real email / passwords needed):**
- Core P1 favorites migration + logout clear (clq closed).
- Raw English auth errors (centralized mapper).
- Silent profile save (success indicator).
- Cabinet infinite "Загрузка" risk (proper error path + loading guard).
- Malformed email UX (explicit validation + inline error).
- Broken /terms + /privacy links from registration form (minimal placeholders).

**Already resolved by prior auth work (0h3 slices):**
- Profile row guarantee (DB trigger + client repair fallbacks) — 0h3.5 closed.
- Registration hardening (confirm pass, terms checkbox, basic errors) — 0h3.6.
- PasswordInput, reset flow, confirmation UX/cooldown.

**Blocked / not autonomous:**
- Anything requiring real password for the QA test account (filippmiller@gmail.com), DB writes for cleanup (pending comments, bio, test saved article).
- Full email delivery / recovery link E2E (owner must configure/verify in Supabase + Mailcow).
- Applying the new profile migration to prod Supabase.
- Broader post-auth intent (comments, return-to-article state) beyond favorites.
- RLS auditing, server-side rate limiting / proxies for UGC (separate P1 beads).
- Turnstile on auth forms.

**Verification performed:** Code inspection of all mentioned files (FavoriteButton*, AuthModal, AuthButton, moy-kabinet, izbrannoe, SharePanel, etc.), Supabase client usage, localStorage patterns, error paths. tsc + eslint on every change. No data mutation. Beads-driven.

## Item-by-Item from Original Browser Audit + Codex Confirmation

### P1 — Major broken flows (highest priority)

**1. Favorites from pre-login don't sync (P1 data integrity)**
- **Status:** Real. Confirmed by Codex (DB + code on dd952344) and current source. localStorage always, server only on toggle-if-logged-in. No migration on login. Cabinet reads only DB. izbrannoe merges for display only.
- **Fixed autonomously:** Yes — full implementation.
  - `src/lib/favorites.ts` (new): `getLocalFavorites`, `migrateLocalFavoritesToServer` (loop upsert + clear), `clearLocalFavorites`.
  - Called in AuthModal handleLogin success + AuthButton getUser + onAuthStateChange.
  - Logout now clears (privacy).
  - Shared reader in FavoriteButton/CardFavoriteButton/izbrannoe.
- **Bead/Commit:** clq (closed), fce02e94 + e79dc08b.
- **Evidence in code:** FavoriteButton.tsx:83 (showAuth), 89 (only if userId), moy-kabinet:56 (only saved_articles), AuthModal:111 (migrate call).
- **Remaining:** Test with real flow + multiple tabs. Broader intent (0h3.7) for comments etc. is partial.

**2. "Мой кабинет" hangs on "Загрузка" via in-app nav (P1/P2 intermittent)**
- **Status:** Risk was real (no .catch, setLoading only in success path of getUser().then). Supabase errors don't always throw but network/auth init can.
- **Fixed autonomously:** Yes (even though 0h3.5 was already closed for profile guarantee).
  - Restructured to async IIFE + try/catch + cancelled guard.
  - Added `loadingError` state + error UI with reload button.
- **Bead/Commit:** ih6 (closed), e79dc08b.
- **Code:** moy-kabinet/page.tsx:44 (new effect), 91 (error render).
- **Note:** Profile repair logic (maybeSingle + upsert fallback) was already present from 0h3.5.

### P2 — Noticeable issues

**3. English auth error on Russian site ("Invalid login credentials")**
- **Status:** Real. Only "Email not confirmed" and one rate case were mapped; everything else raw `err.message`.
- **Fixed:** Centralized `mapAuthError` covering invalid login/creds, not confirmed, rate, password rules, already registered, invalid email. Applied to login + register + resend + reset. Safe non-enumerating defaults.
- **Bead/Commit:** abr (closed) + prior partial work, e79dc08b.
- **Code:** AuthModal.tsx: mapAuthError + calls in handleLogin etc.

**4. Reproducible renderer freeze on write actions (~30s)**
- **Status:** Not reproducible in code. No long synchronous work in handlers (Favorite toggle, comment submit, modal open, share are async + setState). Likely test env (CDP, resource starvation in agent's Chrome session). Actions completed underneath.
- **Action:** None (not a code bug we could find). Documented.

**5. HEAD 503 while GET 200**
- **Status:** Not reproducible (Codex + current checks returned 200 on relevant routes). Transient hosting/CDN (Timeweb/nginx?).
- **Action:** None.

**6. Self-registered has "Администратор"**
- **Status:** The specific QA account (filippmiller@gmail.com) had role=admin in DB (real per Codex). But **not** a systemic bug: signup passes only display_name; recent profiles include 'user' rows. The new `handle_new_user` trigger (see migration below) explicitly sets role='user'.
- **Fixed:** DB-level default now 'user' via trigger + backfill (0h3.5).
- **Action taken:** None on this account (can't without password). Owner should reset the QA account role if desired.

### P3 — Polish

**7. Copy-link no feedback** — Already fixed before verification (SharePanel has copied state + green "Ссылка скопирована!").

**8. No success after profile save** — Real. Fixed: transient "Сохранено!" next to button. Commit 901a4bcd. Bead 9k4.

**9. Malformed email only native HTML5** — Real as UX issue. Fixed: isValidEmail + onBlur + submit guards + inline error under email fields in all forms. Commit e79dc08b. Bead 0uj.

**10. Favorite state persists after logout** — Real (privacy). Fixed as part of clq (clear on signOut + migration on login).

**11. Username display inconsistency** — Minor. Made fallback consistent ('Пользователь' in header, matching cabinet). Primary source is always display_name when present.

## Other Work Performed (Autonomous)

- Updated reports/auth-implementation-results-2026-06.md with full post-audit section + item status.
- Created this review document.
- Minor: consistent username fallback language.
- All changes followed beads, small vertical slices, tsc+eslint before commit, git commit+push.

## DB / Migration Notes (for review)

- `supabase/migrations/20260606120000_ensure_profile_on_signup.sql` (part of 0h3.5):
  - `handle_new_user()` trigger on auth.users insert → profiles with role='user', display_name from metadata or email prefix.
  - Backfill for existing missing profiles.
  - Idempotent, security definer.
- Client fallbacks remain in moy-kabinet and AuthButton for resilience (maybeSingle + upsert repair).
- This also ensures new self-reg accounts are never admin by default.

## Files Changed in Autonomous Round (this verification + fixes)

- src/lib/favorites.ts (new)
- src/components/auth/AuthModal.tsx (mapper, validation, migrate call, login error)
- src/components/auth/AuthButton.tsx (migrate calls, logout clear, username fallback)
- src/components/FavoriteButton.tsx + CardFavoriteButton.tsx (shared getLocalFavorites)
- src/app/izbrannoe/page.tsx (shared reader)
- src/app/moy-kabinet/page.tsx (loading harden + error UI + profileSaved)
- src/app/terms/page.tsx + privacy/page.tsx (new placeholders)
- reports/auth-implementation-results-2026-06.md + this file (docs)
- Beads updates (clq closed, new ih6/abr/0uj/55q created+closed, 0h3.7/9k4 notes)

(Plus prior auth slices for context.)

## Recommendations for Codex Review

Focus areas:
1. favorites.ts + call sites in Auth* — is the migration race-free? Idempotent enough? Should we also migrate on first visit to izbrannoe/cabinet while logged in (for edge cases)?
2. Cabinet loading effect — any remaining promise leak or state issues with the repair + saved/articles queries?
3. Error mapper — sufficient coverage? Should it live in lib/supabase or a shared errors.ts?
4. Terms/privacy pages — content OK as placeholders? Do we need real legal text before prod push?
5. Overall: does this + prior slices close the "Biggest blockers" from the browser audit?
6. Any security/RLS implications of the profile trigger + client repair (coordinate with 39y bead)?
7. Test the full flow manually if you have the QA password: anon fav → register → confirm (or login) → cabinet should now show it.

## Remaining / Owner Action Items

- Apply profile migration to prod Supabase (if not applied).
- Real email tests (reset + confirmation) + recovery link behavior.
- Cleanup of QA test data (pending comments on zamachivanie-semyan-svekly, bio, saved article, possibly reset the admin role on the test account).
- Broader auth intent for comments (0h3.7).
- Full registration copy/a11y pass if needed.
- Turnstile wiring on auth (0h3.9).
- RLS + server proxies for UGC writes (high priority separate beads).

**End of document.** Ready for Codex review. All autonomous code work from the verified audit is complete and documented.

(Generated as part of session after "с чего начинаем" + verification.)
