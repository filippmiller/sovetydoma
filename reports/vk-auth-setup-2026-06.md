# VK ID auth setup handoff

> **SUPERSEDED 2026-07-17.** This document describes the original setup for VK app
> `54625895` and the OneTap SDK widget. Do NOT follow it blindly:
> - The VK OneTap SDK approach was replaced by a plain OAuth 2.1 PKCE redirect flow
>   (`https://id.vk.com/authorize` → `/api/auth/vk/callback` → worker exchange).
> - Canonical VK app id per project passport is `54626241`; HOWEVER live probing on
>   2026-07-17 showed `54625895` (app name «1001sovet.ru») is the app whose VK ID
>   console actually has `https://1001sovet.ru/api/auth/vk/callback` whitelisted,
>   while `54626241` rejects that redirect_uri. See `reports/auth-overhaul-2026-07-17.md`
>   and bead `sovetydoma-1fc` for the current truth.
> - Any hardcoded fallback app id was removed from code/CI (fail closed).
>
> Kept for history (secret-rotation notes still apply).

Date: 2026-06-06

## VK dashboard state

VK ID connection was created for the site.

Non-secret values:

- VK App ID: `54625895`
- Base domain: `1001sovet.ru`
- Trusted redirect URL: `https://1001sovet.ru/api/auth/vk/callback`
- Frontend SDK snippet mode: callback, returns `code` and `device_id`
- Alternative login providers shown by VK snippet: OK.ru and Mail.ru
- Current requested scope in the pasted snippet was empty; production login should request `email`.

## Secret handling

The VK secure key and service token were accidentally pasted into chat. Treat both as compromised.

Before enabling production VK login:

1. Rotate the VK secure key.
2. Rotate the VK service token.
3. Put the new secret only into server-side secret storage.
4. Do not put any VK secret into `NEXT_PUBLIC_*`, frontend code, git, or chat.

## Implemented in this repo

VK login is implemented as a server-mediated flow, behind a disabled-by-default frontend flag.

Frontend:

- `src/components/auth/AuthModal.tsx`
- Loads VK ID SDK only when `NEXT_PUBLIC_VK_AUTH_ENABLED=true`.
- Uses VK App ID `54625895` by default.
- Requests scope `email` by default.
- Generates a PKCE `codeVerifier` in the browser and passes it to VK SDK.
- On VK `LOGIN_SUCCESS`, sends `code`, `device_id`, and `code_verifier` to the Worker.
- Does not exchange VK code for tokens in the browser.

Worker:

- `workers/subscriptions/src/auth/vk-id.ts`
- `workers/subscriptions/src/index.ts`
- Endpoint: `POST /auth/vk/exchange`
- Exchanges VK `code + device_id + code_verifier` server-side.
- Fetches VK user info server-side.
- Requires VK to return a valid email.
- Generates a Supabase magic action link via Auth Admin API.
- Returns the action link to the browser for Supabase session completion.

Tests:

- `workers/subscriptions/src/index.handler.test.ts`
- Covers disallowed origin, missing payload, missing Supabase env, and mocked successful VK-to-Supabase action-link exchange.

## Required frontend env

Keep disabled until real end-to-end testing passes:

```env
NEXT_PUBLIC_VK_AUTH_ENABLED=false
NEXT_PUBLIC_VK_APP_ID=54625895
NEXT_PUBLIC_VK_SCOPE=email
NEXT_PUBLIC_SUBSCRIPTIONS_API_URL=https://sovetydoma-subscriptions.filippmiller.workers.dev
```

The GitHub deploy workflow now reads these public VK values from repository secrets and defaults the feature flag to `false`.

## Required Worker secrets/env

Server-side only:

```env
SUPABASE_URL=https://plwkjdpuxjkmpkqiqzkk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
VK_ID_APP_ID=54625895
VK_ID_CLIENT_SECRET=...
VK_ID_REDIRECT_URI=https://1001sovet.ru/api/auth/vk/callback
```

Notes:

- `VK_ID_CLIENT_SECRET` should be the rotated VK secure key/client secret.
- `VK_ID_REDIRECT_URI` must exactly match the VK dashboard trusted redirect URL.
- The pasted service token is not required for VK ID login. It may be needed for separate VK API/autoposting tasks, but must also be rotated if used.

## Deployment notes

The site is a static export, so `https://1001sovet.ru/api/auth/vk/callback` is not a Next.js API route.

Current implementation uses VK SDK callback mode and then calls the Worker endpoint directly. If VK ever performs a real browser redirect to `/api/auth/vk/callback`, production nginx must proxy that path to the Worker or a backend route must be added.

## Separate from autoposting

VK login and VK article autoposting are separate tracks.

Autoposting server-side work is covered by:

- `reports/vk-autoposting-setup-2026-06.md`
- `workers/subscriptions/src/social/vk.ts`
- `workers/subscriptions/src/index.ts`

Autoposting requires server-side VK wall/group tokens and must not be implemented with browser-exposed tokens.
