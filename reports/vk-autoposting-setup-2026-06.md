# VK Autoposting Setup Guide

## Overview

Admin-only manual autoposting of full articles to VK.
- **First slice**: single article dry-run + post
- **No cron, no backfill, no batch posting, no UI**

## Architecture

- `workers/subscriptions/src/social/vk.ts` — VK publisher module
- `workers/subscriptions/src/index.ts` — admin endpoints (`/admin/social/vk/dry-run`, `/admin/social/vk/post`)
- `workers/subscriptions/src/generated/vk-publication-index.json` — build-time article index (metadata + plain text)
- `scripts/generate-vk-publication-index.mjs` — rebuilds the JSON index from MDX files
- `supabase/migrations/202606061300_social_publications.sql` — tracking table

## Required Secrets (Cloudflare Worker)

Set via Wrangler:

```bash
cd workers/subscriptions
npx wrangler secret put VK_ACCESS_TOKEN
npx wrangler secret put VK_GROUP_ID
npx wrangler secret put VK_API_VERSION      # optional, default 5.199
npx wrangler secret put ADMIN_API_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

**Do NOT store VK secrets in frontend env or commit them.**

## How to Dry-Run

```bash
curl -X POST https://<worker-host>/admin/social/vk/dry-run \
  -H "Content-Type: application/json" \
  -H "x-admin-key: <ADMIN_API_KEY>" \
  -d '{"articleSlug":"agrovolokno-pod-klubniku-vesnoy","requirePhoto":true}'
```

Response:
```json
{
  "ok": true,
  "dryRun": true,
  "articleSlug": "...",
  "title": "...",
  "canonicalUrl": "https://1001sovet.ru/dacha-i-ogorod/agrovolokno-pod-klubniku-vesnoy/",
  "imageUrl": "https://1001sovet.ru/images/agrovolokno-pod-klubniku-vesnoy.jpg",
  "messageLength": 1234,
  "bodyHash": "sha256...",
  "wouldPost": {
    "owner_id": "-123456",
    "from_group": 1,
    "hasPhoto": true,
    "attachmentPreview": "photo",
    "maxChars": 60000
  }
}
```

## How to Post One Article

```bash
curl -X POST https://<worker-host>/admin/social/vk/post \
  -H "Content-Type: application/json" \
  -H "x-admin-key: <ADMIN_API_KEY>" \
  -d '{"articleSlug":"agrovolokno-pod-klubniku-vesnoy","requirePhoto":true}'
```

Behavior:
- Checks `articles_publication_index` for the slug
- Prevents duplicates via `social_publications` (`status = posted`)
- Fetches image from public site URL
- Uploads photo to VK
- Calls `wall.post` with full text + photo attachment
- Records result in `social_publications`

## Warnings

1. **VK ID OAuth token is NOT used for posting.** The worker uses a standalone server-side `VK_ACCESS_TOKEN` with `wall` and `photos` permissions.
2. **Full-text cross-posting can compete with original SEO.** Every post includes a canonical source link (`Источник: https://1001sovet.ru/...`) to drive traffic back to the site.
3. **Text + one photo only.** No splitting, no carousel, no backfill in this version.
4. **Bundle size.** The generated JSON index is ~2.7 MB raw / ~0.7 MB gzip. This is acceptable for the paid Workers plan but should be monitored if the article count grows significantly.

## Future Work (Not in First Slice)

- Cron/backfill automation
- Batch posting
- Splitting long articles into multiple posts
- Admin UI panel
- Storing VK token in frontend (will never be done)
