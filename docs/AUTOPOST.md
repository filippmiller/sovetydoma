# Social Autoposting — VK & Facebook

How new articles are auto-published to social media. Last updated 2026-06-10.

## TL;DR

- An hourly Cloudflare Worker cron posts the latest unposted article to VK and
  Facebook. **Facebook posts WITH the article image; VK posts text + link only**
  (image upload on VK needs a verified app — see "VK image limitation").
- Article text is rendered to readable social formatting (emoji headings,
  bullets, blank lines) by `scripts/lib/social-text.mjs`.
- Posts are tracked in Supabase `social_publications` (dedup, one post per
  platform+article).

## Where it lives

| Piece | Path |
|---|---|
| Worker entry + cron `scheduled()` | `workers/subscriptions/src/index.ts` |
| FB publisher | `workers/subscriptions/src/social/fb.ts` |
| FB cron logic | `workers/subscriptions/src/social/fb-autopost.ts` |
| VK publisher | `workers/subscriptions/src/social/vk.ts` |
| VK cron logic | `workers/subscriptions/src/social/vk-autopost.ts` |
| Markdown→social text renderer | `scripts/lib/social-text.mjs` |
| Bundled article index (slug→title/text/image) | `workers/subscriptions/src/generated/vk-publication-index.json` |
| Index generator | `scripts/generate-vk-publication-index.mjs` |
| Article→DB index sync | `scripts/sync-subscription-publication-index.mjs` → `articles_publication_index` table |
| Tracking table | Supabase `social_publications` (platforms `vk`, `fb`) |
| Admin endpoints | `/admin/social/vk/{dry-run,post}`, `/admin/social/fb/{dry-run,post}` (need `ADMIN_API_KEY`) |
| Local test helpers (gitignored creds) | `workers/subscriptions/scripts/fb-test-post.mjs`, `vk-test-post.mjs`, `fb-autopost-verify.mjs`, `vk-id-pkce.mjs` |

Worker name: **`sovetydoma-subscriptions`** · URL `https://sovetydoma-subscriptions.filippmiller.workers.dev` · cron **`0 * * * *`** (hourly).

## How a post happens (cron path)

`scheduled()` in `index.ts` runs every hour and calls, independently:
1. `processVkAutopost(env)`
2. `processFbAutopost(env)`

Each does:
1. Guard: Supabase service role + platform config present.
2. Guard: within posting hours (09:00–21:00 Europe/Moscow).
3. Rate limit: daily cap (`*_AUTOPOST_MAX_DAILY`, default **3**) + hourly cap (**1**), via Supabase RPC `notification_check_rate_limit` (table `notification_rate_limits`).
4. Pick the latest published article from `articles_publication_index` not already in `social_publications` for that platform, that also exists in the bundled index.
5. Publish (FB: photo byte upload; VK: photo→link→text fallback).
6. Record result in `social_publications` (`status` posted/failed, `provider_post_id`, dedup on `(platform, article_slug)`).

So **up to 3 articles/day per platform**, max 1/hour, daytime MSK only.

## Secrets / config (Cloudflare Worker)

Set via `wrangler secret bulk` (NOT `secret put` from PowerShell — BOM corrupts; see memory `wrangler-secret-bom-gotcha`).

Facebook:
- `FB_PAGE_ID` — Graph API page id (current page "1001 совет" = `1164805160053339`)
- `FB_PAGE_ACCESS_TOKEN` — **non-expiring** Page token (`expires_at:0`)
- `FB_API_VERSION` (opt, default v23.0), `FB_AUTOPOST_MAX_DAILY` (opt, default 3)

VK:
- `VK_ACCESS_TOKEN` — community token (posts text; canNOT upload wall photos)
- `VK_PHOTO_ACCESS_TOKEN` — *user* token w/ photos+wall (needed for image; blocked until app verification)
- `VK_GROUP_ID` env var (= `239393062`, community "Ежедневные Лайфхаки 1001sovet.ru")

Both need `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

## Getting a Facebook page token (non-expiring)

1. developers.facebook.com → app "1001sovet" (`2474412919639411`) → Use Cases → "Manage everything on your Page" → add `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`.
2. Tools → **Access Token Tool**: the listed app User Token is long-lived (~60d).
3. `GET /me/accounts?fields=name,id,access_token&access_token=<USER_TOKEN>` → the page `access_token` is then **non-expiring** (`debug_token` shows `expires_at:0`).
4. `wrangler secret bulk` with `FB_PAGE_ID` + `FB_PAGE_ACCESS_TOKEN`.

## VK images — SOLVED 2026-06-12 (was text-only)

The old findings still hold (2026-06-10): community token can't upload wall
photos (`vk_27`) or link cards (`vk_100`); our mini-app's OAuth gives
`invalid scope`; Standalone apps can no longer be created.

**Working solution (live since 2026-06-12):** a USER token minted via the
Kate Mobile implicit flow (`client_id=2685278`, `scope=photos,wall,offline`,
`expires_in=0`). The token is set as BOTH `VK_ACCESS_TOKEN` (wall.post with
`from_group=1`) and `VK_PHOTO_ACCESS_TOKEN` (upload/saveWallPhoto) on the
subscriptions worker. Verified end-to-end with a real post:
https://vk.com/wall-239393062_14 (photo 1280×960, from group).

- Token backup + re-mint URL: `C:\Users\filip\.secrets\1001sovet-vk-tokens.env`
- The token dies if the owner changes their VK password — re-mint via the same
  flow, or switch to a VK ID token once mini-app 54626241 passes moderation.
- Gotcha: never pass Cyrillic to the VK API from a Windows shell variable —
  use `--data-urlencode "message@utf8file"` (mojibake otherwise).

## Testing / verifying

```bash
cd workers/subscriptions
# creds in gitignored .fb-test.local.json / .vk-test.local.json
npx tsx scripts/fb-test-post.mjs <slug> [--post]      # FB single article
npx tsx scripts/vk-test-post.mjs <slug> [--post] [--link]
npx tsx scripts/fb-autopost-verify.mjs                # full cron path vs prod
```

To unblock a fresh cron run after testing, clear the rate buckets:
`delete from notification_rate_limits where bucket like 'fb:autopost:%';`

## Operational notes

- Regenerate the bundled index when articles change: `node scripts/generate-vk-publication-index.mjs` (also runs in build). Sync the DB index: `node scripts/sync-subscription-publication-index.mjs` (needs `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`).
- The index covers only the 6 syndicated categories (kulinaria, dom-i-uborka, dacha-i-ogorod, layfkhaki, ekonomiya, rybalka); other categories are skipped.
- Deploy after code changes: `cd workers/subscriptions && npx wrangler deploy`.

## Provider failure & balance exhaustion

The content factory (`.github/workflows/content-factory.yml`, every 5h) fails **loudly**, never silently:

- `scripts/factory/generate-article.mjs` exits **42** and prints one stderr line `PROVIDER_BALANCE_EXHAUSTED provider=<anthropic|fal>` when the Anthropic relay or fal.ai reports credit/quota/balance exhaustion (patterns in `scripts/factory/provider-errors.mjs`: /credit balance/i, /insufficient.?quota/i, HTTP 402, …). All other failures keep exit **1**.
- The publish step is gated on generation success (`steps.generate.outcome == 'success'`), so a failed run can never silently "succeed" a publishing gap.
- On any failure the workflow sends ONE Telegram alert (secrets `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`) with the category, run URL, and whether it was balance exhaustion vs a generic failure.

**Operator action for exit 42:** top up the Anthropic relay balance (or fal.ai, per the alert), or explicitly approve a fallback provider. There is **NO silent fallback provider by design** — the pipeline stops until a human acts, so content gaps are always visible.

## Roadmap

- Multi-page routing (category → own FB Page / VK community) + 5×/day cadence — bead `sovetydoma-ovx`. Design in `docs/AUTOPOST-MULTIPAGE.md`.
- Auto-write new articles then immediately publish — ties matrix pipeline (`scripts/matrix/gen-drafts-grok.mjs`, `auto-publish.mjs`) into the social cron.
