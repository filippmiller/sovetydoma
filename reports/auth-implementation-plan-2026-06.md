# Auth Implementation Plan — Registration, Login, Password Reset (2026-06)

**Epic:** sovetydoma-0h3  
**Based on:** 
- `reports/auth-audit-registration-login-2026-06.md`
- User-provided detailed Grok prompt (2026-06)

**Philosophy (strict):**
- Keep **Supabase Auth** as the provider. No migration to Clerk, Auth.js, or full OSS auth starter.
- Use open-source only as **reference/patterns** (e.g. shadcn/ui PasswordInput patterns, Supabase official examples, accessibility best practices). Always attribute if copying significant code.
- Work in vertical slices (one flow at a time).
- Everything tracked in beads.
- Document Supabase dashboard requirements explicitly when we cannot do them from code.

**Current state summary (from reconnaissance):**
- Core logic: `src/components/auth/AuthModal.tsx` (very inline-styled, no reset, weak password UX, generic "Продолжить" buttons, no terms).
- `src/components/auth/AuthButton.tsx` (header + dropdown + onAuthStateChange + profile loading with `.single()`).
- Admin has a decent show/hide password example in `AdminLoginForm.tsx`.
- Turnstile already exists and is used in subscriptions (`src/components/TurnstileWidget.tsx` + `turnstileConfigured()`).
- No `resetPasswordForEmail`, no recovery flow anywhere.
- No confirm password, minLength only 6 in HTML.
- `profiles` table exists in prod + some RLS (per forensic review), but **no creation migration or trigger visible in `supabase/migrations/`**. Previous reports mention a signup trigger, but it's not versioned.
- No dedicated reset or callback routes (static export + client Supabase).
- Tests: mostly Node + worker tests. No Playwright/E2E browser tests currently in package.json.
- Favorites: heavy localStorage + best-effort DB merge on login (CardFavoriteButton, FavoriteButton, izbrannoe page).

---

## Phase 0 — Recon & Planning (this document)

**Completed in this session (2026-06-05/06):**
- Read both audit reports.
- Inspected core auth files, supabase client, Turnstile, migrations (no profiles definition), package.json.
- Confirmed zero reset/recovery code.
- Created epic bead `sovetydoma-0h3`.
- Created detailed implementation plan (this file) + subtasks.
- **P0 Forgot request slice done**:
  - Forgot password link + form in AuthModal.
  - `handleForgotPassword` + `resetPasswordForEmail`.
  - Non-enumerating success message.
  - Back to login, hidden tabs during flow.
  - Updated titles/subtitles.
  - Registration button text improved.
  - `reports/auth-supabase-dashboard-checklist.md` created.
  - Clean commit for the slice.
- **Next immediate**: P0 completion flow (this is the current vertical slice).

**Next in Phase 0:**
- Create subtasks under the epic (see below).
- Explore more if needed (RLS on profiles, how favorites intent is currently handled, moy-kabinet profile handling).

---

## Phase 1 — P0: Password Reset + Email Confirmation UX (highest priority)

**Goal:** Users can recover accounts and understand email flows. No more "письмо не пришло и непонятно почему".

**Subtasks (tracked in beads under sovetydoma-0h3):**
1. ✓ Forgot password entry point + request flow (no enumeration) — DONE (see commit and code in AuthModal).
2. ✓ Supabase recovery token/session detection + new password form (with confirm + visibility + validation) — implemented in this slice (AuthModal + AuthButton listener). Needs full email link test (see blockers).
3. ✓ Improve existing email confirmation "verify" state (resend with 60s cooldown, "Изменить email", "Назад к входу", better Russian copy per prompt: "Проверьте почту для подтверждения аккаунта", spam note, etc.) — implemented in this slice.
4. ✓ `reports/auth-supabase-dashboard-checklist.md` created and expanded with full 8-point verification checklist, owner actions, current code status, and explicit blockers for real email testing.
5. Basic error/success states and Russian copy (partially in progress with reset form).

**Technical notes:**
- Use `supabase.auth.resetPasswordForEmail(email, { redirectTo: ... })`
- On the reset page / in modal: listen for `PASSWORD_RECOVERY` event or check `getSession()` after redirect with recovery params.
- For confirmation resend: already partially exists — make it robust with cooldown.
- Success messages must not leak existence of accounts.

---

## Phase 2 — Registration UX Rewrite

**Must haves:**
- Name, Email, Password (show/hide), Confirm password.
- Visible password requirements (min 8, case, number/symbol recommendation, reject very weak).
- Terms + privacy consent checkbox (required) with links.
- Excellent Russian copy (no more generic "Продолжить").
- Proper loading/disabled/success/error.
- Accessible modal behavior (labels, focus, escape, semantics).

**Reuse / extract:**
- New `PasswordInput` component (used by both user modal and admin). ✓ Extracted minimal reusable PasswordInput.tsx (show/hide, accessible, used in reset/login/register for P0/P1 consistency). Not full refactor.

---

## Phase 3 — Shared Components, Intent & Profile

- Extract `PasswordInput`.
- Preserve action intent (favorite/comment while logged out → after successful auth, either auto-complete or easy return to the article).
- Fix profile creation reliably:
  - Preferred: versioned migration + trigger (or SECURITY DEFINER function).
  - Fallback: safe repair in `moy-kabinet` and after login.
- Make `moy-kabinet` and profile loading robust (`maybeSingle`, upsert repair).
- Improve favorites merge after login (no data loss, predictable).

---

## Phase 4 — Security & Abuse Controls

- Wire Turnstile into registration and password reset request (if `turnstileConfigured()`).
- Enforce no email enumeration in all error paths.
- Client cooldowns for resend/reset.
- Review/create versioned RLS for `profiles`, `saved_articles`, etc. (coordinate with existing beads 39y etc.).
- If high-risk writes are still direct from browser, note them (future proxy work).

---

## Phase 5 — Tests

**Verification performed for this P0 completion slice (2026-06):**
- `pnpm exec tsc --noEmit --skipLibCheck` — clean (no errors on auth files).
- `pnpm exec eslint src/components/auth/AuthModal.tsx src/components/auth/AuthButton.tsx` — clean.
- Code review: recovery listener, form, validation, updateUser, success states, no enumeration.
- Manual code path simulation for reset form (states, handlers).
- Full browser E2E with real reset email link **not yet possible** in this environment without:
  1. Sending a real reset email (requires working SMTP + recovery template in Supabase dashboard).
  2. Clicking the link and landing with tokens.

**Recommended manual browser QA steps (owner/agent with access):**
1. In dev or prod: open site, click Войти → login tab → "Забыли пароль?" → enter known test/QA email → success non-enumerating message.
2. (Requires dashboard) Trigger or wait for reset email, click the link.
3. Should land (on /moy-kabinet/ or wherever), auth modal should open or switch to "Новый пароль" form (two fields + show/hide).
4. Enter matching passwords >=8 chars → submit → success "Пароль успешно изменён" + buttons.
5. Check console for no Supabase/auth errors.
6. Verify old password no longer works, new one does.
7. Test mismatch / short password errors are shown in Russian.

Record results in `reports/auth-implementation-results-2026-06.md` when done.

## Phase 6 — Verification & Final Report

- Component/unit for new validation + PasswordInput (if test runner allows easy React testing).
- Focused E2E-style manual + scripted checks (document commands).
- Update `reports/test-accounts-and-seed-data.md` for any QA accounts created during work (prefix + explicit delete instruction).

**Reality check:** Current test setup is Node-based. We will add what is practical and document browser QA steps thoroughly.

---

## Phase 6 — Verification & Final Report

**Before marking complete:**
- `pnpm lint`, typecheck, build.
- Manual browser QA on desktop + mobile viewports (390px, 768px, desktop).
- Verify no console errors during flows.
- Test happy + error paths for register, login, forgot, reset, resend, post-login favorite.
- Produce `reports/auth-implementation-results-2026-06.md` with:
  - Exact files changed
  - What works now
  - Remaining dashboard/SMTP/DNS blockers (with checklist)
  - Test commands + results
  - Notes on production deploy

---

## Beads Structure (to create)

Epic: `sovetydoma-0h3` — [epic] Rewrite auth...

Subtasks (priority order):
- `sovetydoma-???` P0 Password reset request flow
- `sovetydoma-???` P0 Password reset completion flow + token handling
- `sovetydoma-???` P0 Improve email confirmation UX + resend + diagnostics checklist
- `sovetydoma-???` P1 Registration form rewrite (fields + validation + terms)
- `sovetydoma-???` P1 Extract reusable PasswordInput component
- `sovetydoma-???` P1 Profile creation guarantee + robust loading
- `sovetydoma-???` P2 Preserve auth intent for favorites/comments
- `sovetydoma-???` P2 Turnstile + rate/cooldown protections on auth
- `sovetydoma-???` P2 Versioned RLS/migrations for profiles + related (if missing)
- `sovetydoma-???` Tests + verification
- `sovetydoma-???` Final results report + cleanup

(Actual IDs will be assigned when creating with `bd`.)

---

## Open Questions / Risks (to track)

1. Is the profiles creation trigger still present and working in production Supabase? (We need to verify + version it.)
2. Current state of SMTP / from address / rate limits in the real Supabase project dashboard.
3. DKIM/DMARC status for the sending domain (`1001sovet.ru` or `filippmiller.com`).
4. Whether we can/should add a lightweight `/auth/reset` or handle everything inside the modal + hash/query params.
5. Exact current RLS on `profiles` table (read from prod or previous E2E reports).

---

**Status:** Plan written. Next: create subtasks in beads, then start Phase 1 vertical slice (forgot password request).

Owner must be involved for any Supabase dashboard / DNS / SMTP changes. Code changes stay safe.