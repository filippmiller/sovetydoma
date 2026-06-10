# Multi-page autoposting — one Facebook Page per category

Goal: separate FB Pages per category (e.g. `1001совет — Огород`, `— Дом`,
`— Рыбалка`), each receiving only its category's new articles, ~5×/day.
This avoids the duplicate-content reach penalty and lets a fisherman follow
only fishing. (See chat 2026-06-10: penalty risk = posting identical content to
many pages; routing each article to exactly one page avoids it.)

Status: **code is ready and shipped** (config-driven). What remains is operator
work: create the Pages and provide their tokens.

## How the code routes (already implemented)

`workers/subscriptions/src/social/fb.ts` + `fb-autopost.ts`:

- Env `FB_PAGES_BY_CATEGORY` is a JSON map of category → page:
  ```json
  {
    "dacha-i-ogorod": { "id": "<pageId>", "token": "<pageToken>" },
    "dom-i-uborka":   { "id": "<pageId>", "token": "<pageToken>" },
    "kulinaria":      { "id": "<pageId>", "token": "<pageToken>" },
    "rybalka":        { "id": "<pageId>", "token": "<pageToken>" }
  }
  ```
- Each cron tick: pick the latest unposted article → `resolveFbPageForCategory()`
  picks the page for `article.category_slug` → post there. If a category isn't in
  the map, it falls back to the default `FB_PAGE_ID`/`FB_PAGE_ACCESS_TOKEN`.
- Dedup stays per `(platform='fb', article_slug)` — one post per article, on its
  category's page. No duplicate content across pages.

So once `FB_PAGES_BY_CATEGORY` is set, routing "just works" — no code change.

## What the operator must do

### 1. Create the Pages
Create a Facebook Page per category you want (recommend starting with the big
verticals by article count: `dacha-i-ogorod` 179, `dom-i-uborka` 67,
`kulinaria` 55, `rybalka` 35). Small categories can stay on the main page or be
skipped. You must be admin of each Page.

### 2. Get a non-expiring token for each Page
All Pages you administer come back in ONE call. With the long-lived **User**
token from the Access Token Tool (app "1001sovet" `2474412919639411`):

```
GET https://graph.facebook.com/v23.0/me/accounts?fields=name,id,access_token&access_token=<USER_TOKEN>
```

The response lists every Page with its **non-expiring** `access_token`. Build the
`FB_PAGES_BY_CATEGORY` JSON from it (category slug → that page's id+token).
(Same flow as the single-page setup in `docs/AUTOPOST.md`; the app already has
`pages_manage_posts`.)

### 3. Set the secret + cadence
```bash
cd workers/subscriptions
# secrets.json: { "FB_PAGES_BY_CATEGORY": "{...the JSON above...}", "FB_AUTOPOST_MAX_DAILY": "5" }
npx wrangler secret bulk secrets.json
npx wrangler deploy   # only needed if code changed; routing code already deployed
```

### 4. Cadence = 5×/day
The cron is hourly (`0 * * * *`) and posts at most 1/hour, 09–21 MSK. Set
`FB_AUTOPOST_MAX_DAILY=5` → up to 5 new articles/day, naturally spread across the
day, each routed to its category's Page.

> Note: with per-category routing, the 5/day cap is currently **system-wide**
> (5 posts/day total across all pages, picking the newest unposted article each
> hour). If you later want 5/day *per page*, that's a small change to make the
> rate-limit bucket page-scoped — open a follow-up.

## Auto-write new articles → publish → autopost (the full chain)

Everything is already wired as a pipeline; turning it on end-to-end:

1. **Write** — `scripts/matrix/gen-drafts-grok.mjs` drafts articles into the
   Supabase `content_matrix` (image-first; images via `gen-images.mjs`).
2. **Publish to site (no manual rebuild)** — `.github/workflows/content-autopublish.yml`
   (cron) runs `scripts/matrix/auto-publish.mjs`: approved+image-ready rows →
   MDX → commit → push → deploy. New article goes live automatically.
3. **Index** — build/deploy regenerates `vk-publication-index.json`; run
   `scripts/sync-subscription-publication-index.mjs` to populate
   `articles_publication_index` (the autopost's source of truth).
4. **Autopost** — the hourly worker cron picks the new article and posts it to
   its category's FB Page (and VK text).

So "write a new article and immediately publish it to the right FB page" =
matrix draft → content-autopublish cron → index sync → social cron. To make it
truly hands-off, schedule steps 1–3 (matrix gen + index sync) alongside the
existing content-autopublish workflow.

## Open follow-ups (beads)
- `sovetydoma-ovx` — multi-page routing (this doc; code shipped, needs Pages+tokens).
- Per-page daily cap (optional) — make rate-limit bucket page-scoped.
- `sovetydoma-500` — VK images (needs VK app verification) — applies to VK
  communities-per-category too.
