# Facebook Autoposting Setup Guide

## Overview

Autoposting of full articles WITH images to a Facebook Page, mirroring the VK pipeline.

- Photo posts via Graph API `POST /{page-id}/photos` with `url` + `caption` —
  Facebook downloads the image from `https://1001sovet.ru/images/<slug>.jpg` itself,
  no manual upload step needed (simpler than VK).
- Fallback: `POST /{page-id}/feed` with `message` + `link` (link preview card).
- Cron: runs inside the existing worker `scheduled()` alongside VK autopost.
  Same caps: max 3/day (override `FB_AUTOPOST_MAX_DAILY`), 1/hour, 09:00–21:00 Moscow.
- Tracking: `social_publications` with `platform = 'fb'`
  (migration `202606101200_social_publications_fb.sql` extends the check constraint — apply it before first post).

## Architecture

- `workers/subscriptions/src/social/fb.ts` — FB publisher module
- `workers/subscriptions/src/social/fb-autopost.ts` — cron autopost logic
- Admin endpoints: `/admin/social/fb/dry-run`, `/admin/social/fb/post`

## Getting a Page Access Token (one-time)

1. https://developers.facebook.com → create (or reuse) an app of type **Business**.
2. Add the **Facebook Login for Business** product (no review needed for your own page while the app is in Dev mode IF you are admin; for production posting request `pages_manage_posts` via App Review, or keep the app in Live mode with your own admin token).
3. Graph API Explorer (https://developers.facebook.com/tools/explorer):
   - Select your app → Get **User** token with scopes: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`.
   - Exchange for long-lived user token:
     `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<SHORT_TOKEN>`
   - Get the page token: `GET /me/accounts` → `access_token` for your page.
   - A page token obtained from a long-lived user token **does not expire**.
4. Find the page id in the same `/me/accounts` response.

## Worker Secrets

Use `wrangler secret bulk` (NOT `secret put` piped from PowerShell — BOM corrupts values):

```bash
cd workers/subscriptions
# secrets.json: { "FB_PAGE_ID": "...", "FB_PAGE_ACCESS_TOKEN": "..." }
npx wrangler secret bulk secrets.json
```

Optional vars: `FB_API_VERSION` (default v23.0), `FB_AUTOPOST_MAX_DAILY` (default 3).

## Dry-Run / Manual Post

```bash
curl -X POST https://<worker-host>/admin/social/fb/dry-run \
  -H "Content-Type: application/json" -H "x-admin-key: <ADMIN_API_KEY>" \
  -d '{"articleSlug":"agrovolokno-pod-klubniku-vesnoy"}'

curl -X POST https://<worker-host>/admin/social/fb/post \
  -H "Content-Type: application/json" -H "x-admin-key: <ADMIN_API_KEY>" \
  -d '{"articleSlug":"agrovolokno-pod-klubniku-vesnoy","requirePhoto":true}'
```

## Notes

- Photo caption limit 63206 chars; full article text fits.
- Duplicate prevention via unique `(platform, article_slug)`.
- `requirePhoto=true&allowLinkFallback=true` (autopost default): tries photo, falls back to link post instead of failing.
