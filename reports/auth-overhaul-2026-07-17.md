# Auth overhaul 2026-07-17 — VK ID / Яндекс ID / Google / Email

> **CORRECTION (2026-07-19).** The "VK blocked on app `54626241` redirect URI"
> conclusion below is SUPERSEDED. Auth VK ID login was switched to app
> **`54625895`** (commit `ff4e70f86`), whose redirect
> `https://1001sovet.ru/api/auth/vk/callback` IS registered — verified live:
> `id.vk.com/authorize?client_id=54625895&redirect_uri=…` → 200 → real VK ID
> login page (no "redirect_uri invalid"). The code (workers/subscriptions
> `VK_ID_APP_ID`, tests, PKCE script) uses `54625895` consistently. App
> `54626241` is a SEPARATE mini-app for the autopost track (see docs/AUTOPOST.md),
> not the login app — do not conflate them. VK login is NOT blocked.

Status report + runbook for the auth repair session. Beads: `sovetydoma-gsk`,
`sovetydoma-1fc`, `sovetydoma-chf`, passport `sovetydoma-8x5`.

## Confirmed root causes (live production evidence, Playwright + curl)

1. **CSP blocked the VK ID SDK and all of Supabase.**
   - The VK SDK (unpkg `@vkid/sdk@2.6.5`) calls `https://id.vk.ru/...`
     (`vkid_sdk_get_config`, `stat_events_vkid_sdk`) and frames `https://id.vk.ru/`.
     CSP only allowed `id.vk.com` / `*.vk.com` — `*.vk.com` does NOT cover `id.vk.ru`.
     → `TypeError: Failed to fetch` + "This content is blocked" iframe.
   - CSP `connect-src` also lacked `https://plwkjdpuxjkmpkqiqzkk.supabase.co`,
     so ALL browser→Supabase calls (REST, auth token refresh, sign-in) were refused.
     Email login was effectively broken site-wide, not just social auth.
   - **Fixed live 2026-07-17** in `/etc/caddy/Caddyfile` on 89.169.44.37
     (backup `Caddyfile.bak-auth-csp-20260717-061828`): added `id.vk.ru`,
     the Supabase origin, `mc.yandex.com` (+ validated + `systemctl reload caddy`).

2. **VK app `54626241` does NOT have our redirect URI registered** (provider console).
   `https://id.vk.com/authorize?client_id=54626241&redirect_uri=https://1001sovet.ru/api/auth/vk/callback&...`
   → `{"message": "redirect_uri is missing or invalid", "code": "invalid_request"}`.
   This is the remaining VK blocker — see "Operator step" below.

3. **Surprise finding: app `54625895` still exists and WORKS for VK ID.**
   The same authorize probe with `54625895` renders the real VK consent screen
   («Sign in to "1001sovet.ru"») — i.e. the old app (created 2026-06-06, name
   «1001sovet.ru») still has the base domain + trusted redirect whitelisted.
   The 2026-06-10 bead note "54625895 is a nonexistent app" is **wrong**.
   We still do NOT switch back to it: the passport decision is one canonical app
   (`54626241`, also used for the mini-app/autopost track), and 54625895's secure
   key was compromised in chat on 2026-06-06. All hardcoded fallbacks to
   `54625895` were removed (fail closed).

4. **React hydration error #418 — NOT auth-related.**
   `ArticleCard` (and SearchClient/RecipeFilter/SeasonalBanner) rendered
   time-dependent `relativeDate()` («2 нед. назад») — prerendered HTML from the
   build date mismatches the client-computed value days later.
   Fixed with `suppressHydrationWarning` on those elements (+ `dateTime` attr).

## What changed (code)

- **AuthModal rewritten UX** (`src/components/auth/`):
  - One `SocialAuthSection` shared by the login AND register tabs:
    «Продолжить с VK ID», «Продолжить с Яндекс ID», «Продолжить с Google»
    with brand SVG icons (no glued letter pseudo-icons, no OK/Mail alternatives,
    no second fake "Войти через VK" via Supabase OAuth).
  - VK OneTap SDK removed entirely. VK ID now uses the same architecture as
    Yandex: browser → `id.vk.com/authorize` (OAuth 2.1 + PKCE S256 + CSRF state)
    → static `/api/auth/vk/callback` page → worker `/auth/vk/exchange` →
    Supabase admin magic link → session.
  - Dialog fits the viewport: `max-height: calc(100dvh - 2rem)`, internal scroll,
    compact spacing, 320/375px media query. Verified: 596px @1280×800,
    583px @375×667, 552px scroll @320×568.
  - A11y: `role="dialog"`, `aria-modal`, `aria-labelledby/describedby`,
    focus-in on open, Tab trap, Escape, focus restore, `role="alert"` errors,
    labelled inputs.
  - Styles extracted to `src/components/auth/auth.module.css`.
  - Unverified «500+ читателей» social proof removed.
- **VK callback page** (`public/api/auth/vk/callback/index.html`): now verifies
  the CSRF `state` (one-time, deleted before compare) and allowlists the
  returned `actionLink` to the Supabase `/auth/v1/` prefix.
- **Fail closed app id**: `workers/subscriptions/src/auth/vk-id.ts`,
  `workers/subscriptions/scripts/vk-id-pkce.mjs`, `.github/workflows/deploy.yml`
  no longer fall back to a hardcoded VK app id. Canonical id `54626241` lives in
  `wrangler.toml` [vars] and the `NEXT_PUBLIC_VK_APP_ID` GitHub secret.
- **Tests**: worker (fail-closed app id, PKCE payload, mocked VK/Yandex exchange),
  `src/lib/auth/oauth-state.ts` + `safe-redirect.ts` unit tests (state mismatch,
  replay, phishing links, fail-closed), `scripts/__tests__/auth-social-structure.test.mjs`
  (no duplicate VK button, no stale app id, SDK-less VK flow, a11y, viewport fit).

## Provider-side verification status

| Provider | Provider console | Worker exchange | Real-account E2E |
|---|---|---|---|
| Email | n/a (Supabase) | n/a | **unblocked by CSP fix**; needs a real login re-check |
| VK ID | **BLOCKED — redirect URI not registered for app 54626241** | OK (reaches id.vk.com; 502 on bad code) | pending operator step |
| Яндекс ID | OK — authorize page renders (client `cb50d8bc…`, redirect `https://1001sovet.ru/auth/callback/`) | OK (reaches oauth.yandex.ru; 502 on bad code) | pending owner login |
| Google | OK — Supabase `/authorize?provider=google` 302→ accounts.google.com sign-in page | Supabase-native | pending owner login |

## OPERATOR STEP (VK, ~2 min, requires the VK account that owns app 54626241)

1. Open https://id.vk.com/dev → app **54626241** → **VK ID** settings.
2. Add trusted redirect URL: `https://1001sovet.ru/api/auth/vk/callback`
   (base domain `1001sovet.ru`, scope `email`).
3. Verify: open https://1001sovet.ru, «Войти» → «Продолжить с VK ID» — the VK
   consent screen must appear (not «Ошибка загрузки»).
4. Complete the E2E: log in → land on /moy-kabinet/ authenticated → refresh →
   logout → log in again (same account). Then bead `sovetydoma-1fc` can close.

(Alternative, NOT recommended: app `54625895` already has the redirect
whitelisted, but its secure key was compromised 2026-06-06 and the canonical
app is 54626241.)

## Remaining owner-dependent E2E (Яндекс / Google)

Both flows are verified up to the provider login page. The final step needs a
real account login by the owner in an open browser:
- Яндекс: «Продолжить с Яндекс ID» → Yandex login → consent → back to
  /auth/callback/ → session → /moy-kabinet/.
- Google: «Продолжить с Google» → Google sign-in → consent → /auth/callback/ →
  session.

## Deploy

Standard path: push to master → GH Actions `deploy.yml` builds `out/` → `dist`
branch → VPS pull-deploy timer. Worker was NOT redeployed (only test/source
changes; `vk-id.ts` fail-closed change ships on the next worker deploy — note:
wrangler.toml already sets `VK_ID_APP_ID`, so runtime behavior is unchanged).
