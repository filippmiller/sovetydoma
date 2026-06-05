# Auth Live QA Handoff — 2026-06-05

## Current production state

- Production build verified after the previous deployment: `https://1001sovet.ru/build.json` returned source SHA `9a5b56fc44e6501022bc70124d1bca40a441cdc5`.
- GitHub `CI` and `Build & publish static site to dist` were green for that SHA.
- Replacement VPS `1001sovet-replacement` activated `rel-9a5b56fc-20260605121414` via `/opt/deploy/pull-build-deploy.sh`.

## Browser QA performed in this pass

Production:

- Login modal opens.
- Invalid email is blocked client-side with Russian copy: `Введите корректный email адрес.`
- Invalid credentials show Russian copy: `Неверный email или пароль.`
- Forgot password flow:
  - tab switcher is hidden;
  - heading/subtitle are correct;
  - success copy is non-enumerating;
  - back-to-login button is present.
- Registration validation:
  - required name blocks submit;
  - confirm-password mismatch shows `Пароли не совпадают`;
  - terms/privacy checkbox exists and is required.

Local fix verified:

- Login email/password no longer prefill the registration form after switching tabs.

## Code change in this pass

- `src/components/auth/AuthModal.tsx`
  - added separate `registerEmail` and `registerPassword` state;
  - reset login/register sensitive fields on modal open;
  - registration now submits `registerEmail.trim()` + `registerPassword`;
  - resend confirmation uses registration email in the post-register success state.

## Supabase read-only findings

Read-only service-role check, no secrets printed:

- `filippmiller@gmail.com` exists in Supabase Auth and is confirmed.
- That user currently has profile role `admin`.
- That profile has `bio = "QA test bio — can be deleted"`.
- There is one saved article for that user: `zatochka-lopaty-dlya-kopki`.
- There are two unapproved comments for that user on `zamachivanie-semyan-svekly`, both with content `QA test comment - can be deleted`.
- One prior QA user exists: `filipp+authqa_20260604075626@1001sovet.ru`, confirmed.

Do not silently delete or demote `filippmiller@gmail.com`; it is a real personal address. Cleanup/demotion needs explicit owner approval.

## Chrome control status

Chrome itself is running, the Codex Chrome Extension is installed and enabled, and the native host manifest is correct. The Chrome backend still returned `Browser is not available: extension`, so this pass used Playwright fallback instead of the user's Chrome session.

## Still not production-ready

- Full real email cycle is not yet reverified:
  - register -> receive confirmation email -> click -> login;
  - forgot -> receive recovery email -> click -> set new password -> login.
- Supabase dashboard settings still need live verification:
  - Site URL;
  - allowed redirect URLs;
  - SMTP/from;
  - confirmation and recovery templates;
  - auth email rate limits.
- `/terms` and `/privacy` are still placeholder legal pages.
- Auth forms still have no real abuse protection. A Turnstile widget alone is not enough for Supabase Auth; signup/reset should go through a server/Worker endpoint that verifies Turnstile before calling Supabase.
- Production data cleanup is pending owner approval.

## Prompt for Claude in Chrome

Use this when Claude can control the real Chrome browser and user sessions:

```text
You are QA-testing 1001sovet.ru auth in the user's real Chrome browser. Work read-only unless the owner explicitly tells you to submit a form. Do not enter or change private passwords yourself.

Goal: verify registration, login, password recovery, favorites intent, and profile behavior end to end.

Start by opening https://1001sovet.ru/build.json and confirm the SHA is current. Then test:
1. Login modal opens from header and from anonymous favorite click.
2. Invalid email is blocked with Russian copy.
3. Invalid login credentials show Russian copy, not English Supabase text.
4. Forgot password screen:
   - tab switcher hidden;
   - non-enumerating success copy;
   - back-to-login works;
   - network request is sent to Supabase recovery endpoint.
5. Registration screen:
   - fields are blank when switching from login after typed login credentials;
   - name required;
   - email validation;
   - password min 8;
   - confirm password mismatch;
   - terms checkbox required;
   - /terms and /privacy open and are not 404.
6. Anonymous favorite intent:
   - clear local/session storage;
   - click heart on a real article while logged out;
   - modal opens with context;
   - localStorage favorites contains slug;
   - sessionStorage pendingAuthIntent contains action=favorite and slug.
7. If owner completes login manually:
   - verify favorite is in /izbrannoe and /moy-kabinet;
   - logout clears local favorites UI state;
   - re-login restores favorites from DB.
8. If owner completes registration/email manually:
   - verify confirmation email arrives;
   - click confirmation link;
   - verify user can login and profile row exists;
   - verify saved favorite intent is processed after confirmation/login.
9. If owner completes recovery email manually:
   - verify reset link lands on reset form;
   - owner enters new password;
   - verify login with new password works.

Collect exact findings with URL, steps, observed result, expected result, severity, screenshots if useful, and console/network errors. Do not guess. Mark anything requiring owner password/email action as blocked, not failed.
```

## Prompt for Grok/code agent

Use this for code work after QA findings are confirmed:

```text
You are fixing auth in C:\DEV\sovetydoma. Preserve unrelated dirty work. Start with `git status --short --branch`. Do not touch untracked public/images or matrix exports unless the task explicitly requires it.

Implement the next auth hardening slice only:
1. Fix confirmed browser QA issues first.
2. Do not rewrite all auth in one pass.
3. Keep Supabase Auth client-side behavior unless implementing a real server/Worker proxy.
4. For Turnstile: do not add a decorative widget only. Design/implement a server-validated path for signup/reset, or leave it as a documented blocker.
5. Keep registration/login/reset state separated.
6. Keep all user-visible auth errors in Russian and non-enumerating where appropriate.
7. Keep favorites intent data-loss safe: never clear pendingAuthIntent/local favorites until server write succeeds.
8. Do not change production Supabase data unless the owner explicitly approves the exact cleanup.

After each slice run:
- `pnpm exec tsc --noEmit --skipLibCheck`
- targeted eslint for changed files
- `pnpm node scripts/validate-articles.mjs`
- `pnpm run build` before production push
- browser smoke for the changed flow

Commit small and push only after gates pass. If pushed, verify GitHub Actions, run VPS pull deploy if needed, and confirm `https://1001sovet.ru/build.json` matches the new SHA.
```
