# Yandex OAuth — custom flow setup (2026-06-10)

Self-hosted Supabase Auth has no `yandex` provider, so login via Yandex runs as a
**custom authorization-code flow**, mirroring the VK ID bridge:

```
AuthModal (Яндекс button)
  → redirect to https://oauth.yandex.ru/authorize?...&state=<csrf>
  → Yandex login + consent
  → back to https://1001sovet.ru/auth/callback/?code=...&state=...
  → callback page verifies state, POSTs {code, redirect_uri} to the worker
  → worker /auth/yandex/exchange:
        oauth.yandex.ru/token  (code + client_id + client_secret)
        login.yandex.ru/info   (Authorization: OAuth <token>)
        Supabase admin generate_link (magiclink for the email)
  → callback page redirects to the action_link → Supabase session set
  → lands on /moy-kabinet/
```

Code (shipped, deployed):
- Worker: `workers/subscriptions/src/auth/yandex.ts` + route `/auth/yandex/exchange` in `src/index.ts`
- Client: `src/components/auth/AuthModal.tsx` (`handleYandexSignIn`) + `src/app/auth/callback/page.tsx` (state check + exchange)
- Build env wired in `.github/workflows/deploy.yml` (`NEXT_PUBLIC_YANDEX_OAUTH_CLIENT_ID`)

## Remaining operator steps (need Yandex OAuth console login)

1. **Yandex OAuth app** — https://oauth.yandex.ru/ → your app (or create one):
   - Platform: **Web services**
   - **Redirect URI:** `https://1001sovet.ru/auth/callback/` (exact, with trailing slash)
   - **Scopes:** `login:email`, `login:info`, `login:avatar`
   - Copy the **ClientID** and **Client secret**.

2. **Worker secrets** (Cloudflare). Use `secret bulk` — piping into `secret put` adds a
   UTF-8 BOM on PowerShell and corrupts the value (see memory: wrangler-secret-bom-gotcha):
   ```powershell
   cd workers/subscriptions
   @'
   { "YANDEX_OAUTH_CLIENT_ID": "<clientid>", "YANDEX_OAUTH_CLIENT_SECRET": "<secret>" }
   '@ | Out-File -Encoding ascii .yandex-secrets.json
   npx wrangler secret bulk .yandex-secrets.json
   Remove-Item .yandex-secrets.json
   ```

3. **GitHub build secret** + rebuild the site:
   ```powershell
   gh secret set NEXT_PUBLIC_YANDEX_OAUTH_CLIENT_ID --body "<clientid>"
   # then trigger the site deploy (push to master or re-run the deploy workflow)
   ```
   (ClientID is public — it ships in the static bundle. The secret stays worker-side only.)

## Verify after provisioning
- `curl -X POST .../auth/yandex/exchange -d '{"code":"x"}'` → `yandex_auth_failed` (502) once
  configured (invalid code reaches Yandex), **not** `provider_unconfigured` (503).
- Real login: click **Войти через Яндекс**, approve, land authenticated on /moy-kabinet/.
- Notes: users with a hidden Yandex email get a synthetic `yandex-<id>@users.1001sovet.ru`
  (same scheme as VK). CSRF is enforced via the `state` round-trip.
