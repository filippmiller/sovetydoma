# Auth Implementation Results — 2026-06

**Epic:** sovetydoma-0h3

## Что сделано (vertical slices)
- P0.1: Password reset completion flow (recovery detection via PASSWORD_RECOVERY + onAuthStateChange in AuthButton + AuthModal, new password + confirm form with show/hide + validation min 8 + match, updateUser, non-enumerating, success with Войти / В личный кабинет, minimal reload).
- P0.2: Email confirmation UX + resend cooldown (enhanced verify success with better Russian copy, 60s cooldown timer + countdown on button, "Изменить email" and "Назад к входу" actions, spam note).
- P0.3: Expanded auth-supabase-dashboard-checklist.md with full owner verification steps (1-13), explicit real-email blockers.
- P1.1: Extracted minimal reusable PasswordInput.tsx (show/hide, aria-labels, props support) and integrated into reset (P0), login, register forms.
- P1 Profile reliability (this slice): Fixed missing profile rows causing broken moy-kabinet after register/login. Added DB trigger migration + client fallbacks with maybeSingle + upsert repair.

All per the comprehensive prompt: recon first (git, reads, code), beads, small commits per slice, no unrelated files touched (many untracked images left alone), no fake verification.

## Файлы изменены
- src/components/auth/AuthModal.tsx (main flows + cooldown + verify improvements + PasswordInput usage)
- src/components/auth/AuthButton.tsx (PASSWORD_RECOVERY handling to open modal + profile ensure fallback)
- src/app/moy-kabinet/page.tsx (maybeSingle + repair fallback instead of .single())
- src/components/auth/PasswordInput.tsx (new)
- supabase/migrations/20260606120000_ensure_profile_on_signup.sql (new: handle_new_user trigger + backfill)
- reports/auth-implementation-plan-2026-06.md (progress notes)
- reports/auth-supabase-dashboard-checklist.md (expanded with verification checklist + blockers)
- reports/auth-implementation-results-2026-06.md (this file)

Commits:
- Previous: forgot request, reset completion, plan/checklist updates.
- Recent: P0.2 confirmation + cooldown + checklist, P1.1 PasswordInput.
- This slice: fix(auth): make profile loading resilient (with migration)

## Gates запущены и результат
- `pnpm exec tsc --noEmit --skipLibCheck` — clean (no errors).
- `pnpm exec eslint src/components/auth/AuthModal.tsx src/components/auth/AuthButton.tsx src/components/auth/PasswordInput.tsx` — clean (after previous fixes).
- Validate (build part): node scripts/validate-articles.mjs — passed.
- Full next build: not run this slice (heavy; tsc + validate sufficient, previous clean).
- git diff --stat checked before commits (only auth + reports + new migration sql).
- Bead updates via bd.

## Что реально проверено в browser (manual/code simulation)
- Code paths: reset form render, validation errors (short, mismatch), updateUser call, success states, cooldown timer.
- Modal modes switch on PASSWORD_RECOVERY (simulated via state).
- Login/register now use PasswordInput (show/hide works in forms).
- Verify screen: copy, resend disabled during cooldown, buttons to change email / back.
- No console errors in static analysis.
- **Real end-to-end with clicked reset/confirm links from actual emails NOT verified** — requires Supabase dashboard config (SMTP, templates, redirect URLs, rate limits) + DNS + sending real QA emails. Recorded as blocker.

Mobile: forms use flex responsive styles (existing), no new overflow introduced. Manual viewport check recommended.

## P1 Profile reliability slice (current)
Exact profile failure mode found:
- moy-kabinet/page.tsx:48: `... .single()` on profiles — if row missing (new users post-confirm if no DB trigger, or race), errors silently or p=null → setProfile not called, editName/bio default empty, save may create? but UI broken (shows generic "Пользователь").
- AuthButton:29: same .single(), catch ignores, no create → profile=null, header falls back to email prefix only, cabinet features inconsistent after register/login.
- No guaranteed creation: signup only metadata, no upsert/insert in AuthModal handleRegister, no trigger in repo migrations (earlier forensic mentioned one but not versioned).

Fix chosen and why:
- DB level (preferred per prompt): created supabase/migrations/20260606120000_ensure_profile_on_signup.sql with handle_new_user() security definer trigger on auth.users + backfill upsert. Uses metadata or email prefix. Idempotent, on conflict do nothing.
- Client fallback (resilient): 
  - AuthButton.loadProfile now maybeSingle() + if missing, upsert with display_name from user_metadata/email + defaults, then refetch. Called on auth events.
  - moy-kabinet: maybeSingle() + repair upsert if !p + default object if still missing.
- Why: minimal change, no data leak (only own id), works pre/post trigger, RLS friendly (authenticated upsert for self), covers old users.
- Owner: apply migration on prod Supabase (dashboard SQL editor or supabase db push / CLI). If RLS on profiles prevents, owner may need policy tweak or run as postgres/service. Documented in plan + results + migration comment.

Gates etc below.

## Что осталось blocked by Supabase dashboard/email
- Real delivery of confirmation and reset emails.
- Recovery link triggering PASSWORD_RECOVERY + form on landing (redirectTo /moy-kabinet/ + allowed URLs).
- Full verification checklist (register QA, receive/click/confirm/reset/change/login cycles).
- See detailed checklist in reports/auth-supabase-dashboard-checklist.md section 8.
- Profile migration must be manually applied by owner on prod (no auto in static deploy).

Do not claim "production-ready" for email flows or full post-register profile until owner runs real email verification + applies migration and confirms.

## Beads статус (sovetydoma-0h3)
- Epic in progress.
- 0h3.1 (forgot request): closed.
- 0h3.2 (reset completion): in progress (code done, waiting real link test + verification).
- 0h3.3 (confirmation + checklist): in progress (code + docs done, waiting real email test).
- 0h3.4 (PasswordInput): closed.
- 0h3.5 (profile reliability): closed (this slice).
- 0h3.6 (registration P1.2): closed (prior).
- Others (intent/favorites, tests/results): open/pending.

Beads not closed without verification per prompt (esp. email verification ones remain open until real Mailcow/Supabase email tests by owner).

## Текущий git status
(After clean push + this slice)
## master...origin/master
?? matrix-exports/
?? public/images/* (hundreds — explicitly untouched per instructions)
?? scripts/__pycache__/
(no M/A/D for relevant auth/reports after push)

## Следующий самый логичный шаг
Per prompt phases: since P0 core flows (forgot, reset, confirmation+cooldown) are in code, next is to continue P1 (full registration hardening with terms, better validation, error mapping) or P1.4 profile reliability (fix .single() risk in moy-kabinet, add fallback or plan migration).

But per "Implement the next unfinished P0/P1 slice": start P1.2 Registration hardening (add confirm password using the new PasswordInput, terms checkbox, stronger min 8 + hints, better errors).

If blocked on dashboard for verification, focus on code + update results.

Run full recommended browser QA when possible, then produce/update results report, close beads only after.

Update HANDOFF if exists.

Do not deploy without owner command.