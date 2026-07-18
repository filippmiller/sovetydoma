# Multi-page / multi-community autoposting

One Facebook Page per category + one VK community per category.
Each category's articles go only to that category's page — avoids
duplicate-content reach penalty; lets followers subscribe to just
their interest (fishing, cooking, etc.).

**Status as of 2026-06-25:**
- VK: **partially live** — per-category loop, 1 post/hr/group, **6 of 12** groups wired
- FB: **partially live** — per-category loop code deployed, **2 of 12** page tokens wired

The taxonomy expanded from 6 to 12 top-level categories (see `src/lib/subscriptions/constants.mjs`). This doc covers all 12.

---

## VK multi-community routing

### How the code works

`vk-autopost.ts` loops over every category in `VK_GROUPS_BY_CATEGORY`
and calls `processCategoryAutopost()` for each. Rate limits are
per-group (`vk:autopost:{groupId}:daily:{date}` and
`vk:autopost:{groupId}:hourly:{hour}`), so each community gets up to
1 post/hour independently.

`VK_GROUPS_BY_CATEGORY` env (JSON):
```json
{
  "kulinaria":               { "groupId": "239525401" },
  "dom-i-uborka":            { "groupId": "239525212" },
  "dacha-i-ogorod":          { "groupId": "239525204" },
  "layfkhaki":               { "groupId": "239393062" },
  "ekonomiya":               { "groupId": "239525216" },
  "rybalka":                 { "groupId": "239525223" },
  "zdorovie-i-bezopasnost":  { "groupId": "<NEW>" },
  "semya-i-deti":            { "groupId": "<NEW>" },
  "krasota-i-uhod":          { "groupId": "<NEW>" },
  "otdyh-i-puteshestviya":   { "groupId": "<NEW>" },
  "pokupki-i-tehnika":       { "groupId": "<NEW>" },
  "avto":                    { "groupId": "<NEW>" }
}
```

One-token model: `VK_ACCESS_TOKEN` / `VK_PHOTO_ACCESS_TOKEN` are both
the same Kate Mobile user token — it's valid for all groups the user
admins. No per-group token needed.

Fallback: category not in map → default `VK_GROUP_ID` used.

### Current VK groups (all admin = Filipp, 2026-06-12)

| Category slug           | VK group URL                  | Status |
|-------------------------|-------------------------------|--------|
| kulinaria               | https://vk.com/club239525401  | ⚠️ name needs fix |
| dom-i-uborka            | https://vk.com/club239525212  | ✅ live |
| dacha-i-ogorod          | https://vk.com/club239525204  | ✅ live |
| layfkhaki               | https://vk.com/club239393062  | ✅ live |
| ekonomiya               | https://vk.com/club239525216  | ✅ live |
| rybalka                 | https://vk.com/club239525223  | ✅ live |
| zdorovie-i-bezopasnost  | ❌ not created yet            | — |
| semya-i-deti            | ❌ not created yet            | — |
| krasota-i-uhod          | ❌ not created yet            | — |
| otdyh-i-puteshestviya   | ❌ not created yet            | — |
| pokupki-i-tehnika       | ❌ not created yet            | — |
| avto                    | ❌ not created yet            | — |

**⚠️ club239525401** is currently named "Ежедневные Лайфхаки 1001sovet.ru".
Must be renamed to "1001совет — Кулинария" manually in VK group settings
(Управление → Название). The `groups.edit` API requires a **community token**
(generated from the group's own API settings), not the Kate Mobile user token —
even with `groups` scope, user tokens return error_code 3 on management methods.

### VK token management

The Kate Mobile implicit-flow token (scope: `wall,photos,groups,offline`):
- Obtained via: `https://oauth.vk.com/authorize?client_id=2685278&scope=wall,photos,groups,offline&redirect_uri=https://oauth.vk.com/blank.html&display=page&response_type=token`
- `expires_in=0` = permanent (until password change)
- Set via: `wrangler secret bulk secrets.json --name sovetydoma-subscriptions`
  (NEVER `secret put` from PowerShell — BOM corrupts the value)
- Rotation needed if: Filipp changes VK password, or VK app verification
  eventually enables the proper mini-app OAuth flow

### Adding a new VK community

1. Create community, make sure your VK account is admin
2. Collect the numeric community ID (bare, no leading `-`)
3. Add entry to `VK_GROUPS_BY_CATEGORY` JSON (full 12-entry map)
4. `wrangler secret bulk` the updated JSON

---

## FB multi-page routing

### How the code works

`fb-autopost.ts` loops over every category in `FB_PAGES_BY_CATEGORY`
and calls `processCategoryAutopost()` for each. Rate limits are
per-page (`fb:autopost:{pageId}:daily:{date}` and
`fb:autopost:{pageId}:hourly:{hour}`).

`FB_PAGES_BY_CATEGORY` env (JSON string — must be a string inside the
wrangler secrets object):
```json
{
  "kulinaria":               { "id": "<NEW>", "token": "EAA..." },
  "dom-i-uborka":            { "id": "1080988935107650", "token": "EAA..." },
  "dacha-i-ogorod":          { "id": "1112657191938357", "token": "EAA..." },
  "layfkhaki":               { "id": "<NEW>", "token": "EAA..." },
  "ekonomiya":               { "id": "<NEW>", "token": "EAA..." },
  "rybalka":                 { "id": "<NEW>", "token": "EAA..." },
  "zdorovie-i-bezopasnost":  { "id": "<NEW>", "token": "EAA..." },
  "semya-i-deti":            { "id": "<NEW>", "token": "EAA..." },
  "krasota-i-uhod":          { "id": "<NEW>", "token": "EAA..." },
  "otdyh-i-puteshestviya":   { "id": "<NEW>", "token": "EAA..." },
  "pokupki-i-tehnika":       { "id": "<NEW>", "token": "EAA..." },
  "avto":                    { "id": "1129360250263513", "token": "EAA..." }
}
```

Fallback: category not in map → default `FB_PAGE_ID`/`FB_PAGE_ACCESS_TOKEN`.

### Current FB pages (2026-06-25)

| Category slug           | Page name                              | Status |
|-------------------------|----------------------------------------|--------|
| kulinaria               | 1001совет - Кулинария                  | ❌ not created yet |
| dom-i-uborka            | 1001совет - Дом и уборка               | ✅ token wired |
| dacha-i-ogorod          | 1001совет - Дача и огород              | ✅ token wired |
| layfkhaki               | 1001совет - Лайфхаки                   | ❌ not created yet |
| ekonomiya               | 1001совет - Экономия                   | ❌ not created yet |
| rybalka                 | 1001совет - Рыбалка                    | ❌ not created yet |
| zdorovie-i-bezopasnost  | 1001совет - Здоровье                   | ❌ not created yet |
| semya-i-deti            | 1001совет - Семья и дети               | ❌ not created yet |
| krasota-i-uhod          | 1001совет - Красота и уход             | ❌ not created yet |
| otdyh-i-puteshestviya   | 1001совет - Отдых и путешествия        | ❌ not created yet |
| pokupki-i-tehnika       | 1001совет - Покупки и техника          | ❌ not created yet |
| avto                    | 1001sovet.ru - Авто советы и лайфхаки  | ✅ exists, token NOT wired |

### Completing the FB setup (operator checklist)

**Step 1 — Create the missing pages** (9 pages + wire avto):

| Page name                        | FB category to type        |
|----------------------------------|----------------------------|
| 1001совет - Кулинария            | Food & Drink (type "Food") |
| 1001совет - Рыбалка              | Sports & Recreation        |
| 1001совет - Лайфхаки             | Education                  |
| 1001совет - Экономия             | Finance                    |
| 1001совет - Здоровье             | Health & Wellness          |
| 1001совет - Семья и дети         | Family & Relationships     |
| 1001совет - Красота и уход       | Health & Beauty            |
| 1001совет - Отдых и путешествия  | Travel & Transportation    |
| 1001совет - Покупки и техника    | Shopping & Retail          |

Use long dash "—" in page names. Bio template: "Полезные советы по [теме]: [2–3 слова]. Больше — на 1001sovet.ru"

**Step 2 — Get page tokens** (non-expiring):

Open browser console on https://developers.facebook.com/tools/accesstoken/
while logged in as the page admin. Copy the User Token for app "1001sovet",
then run in console:

```js
var t = "PASTE_USER_TOKEN_HERE";
fetch(`https://graph.facebook.com/me/accounts?fields=name,id,access_token&limit=50&access_token=${t}`)
  .then(r=>r.json())
  .then(d=>console.log(JSON.stringify(d.data.map(p=>({name:p.name,id:p.id,len:p.access_token.length})))));
// Then to get actual tokens:
// d.data.forEach(p => console.log(p.name, p.id, p.access_token));
```

**Step 3 — Build + push the secret** (both maps in one bulk file):

```powershell
# Build the full 12-entry FB map string (NO BOM — never use Out-File or Set-Content for secrets)
$fbMap = '{
  "kulinaria":{"id":"NEW_ID","token":"EAA..."},
  "dom-i-uborka":{"id":"1080988935107650","token":"EAA..."},
  "dacha-i-ogorod":{"id":"1112657191938357","token":"EAA..."},
  "layfkhaki":{"id":"NEW_ID","token":"EAA..."},
  "ekonomiya":{"id":"NEW_ID","token":"EAA..."},
  "rybalka":{"id":"NEW_ID","token":"EAA..."},
  "zdorovie-i-bezopasnost":{"id":"NEW_ID","token":"EAA..."},
  "semya-i-deti":{"id":"NEW_ID","token":"EAA..."},
  "krasota-i-uhod":{"id":"NEW_ID","token":"EAA..."},
  "otdyh-i-puteshestviya":{"id":"NEW_ID","token":"EAA..."},
  "pokupki-i-tehnika":{"id":"NEW_ID","token":"EAA..."},
  "avto":{"id":"1129360250263513","token":"EAA..."}
}'

# Build the full 12-entry VK map string
$vkMap = '{
  "kulinaria":{"groupId":"239525401"},
  "dom-i-uborka":{"groupId":"239525212"},
  "dacha-i-ogorod":{"groupId":"239525204"},
  "layfkhaki":{"groupId":"239393062"},
  "ekonomiya":{"groupId":"239525216"},
  "rybalka":{"groupId":"239525223"},
  "zdorovie-i-bezopasnost":{"groupId":"NEW_ID"},
  "semya-i-deti":{"groupId":"NEW_ID"},
  "krasota-i-uhod":{"groupId":"NEW_ID"},
  "otdyh-i-puteshestviya":{"groupId":"NEW_ID"},
  "pokupki-i-tehnika":{"groupId":"NEW_ID"},
  "avto":{"groupId":"NEW_ID"}
}'

# Assemble the bulk JSON (each value is a single escaped JSON string)
$bulk = "{`"VK_GROUPS_BY_CATEGORY`": `"" + ($vkMap -replace '"', '\"' -replace '\\', '\\\\') + "`", `"FB_PAGES_BY_CATEGORY`": `"" + ($fbMap -replace '"', '\"' -replace '\\', '\\\\') + "`"}"

[System.IO.File]::WriteAllText('C:\tmp\da6-secrets.json', $bulk, [System.Text.Encoding]::UTF8)
cd C:\DEV\sovetydoma
npx wrangler secret bulk C:\tmp\da6-secrets.json --config workers/subscriptions/wrangler.toml
Remove-Item C:\tmp\da6-secrets.json
```

No redeploy needed — the worker reads the secret on each cron tick.

---

## Cron schedule and rate limits

```
Cron: 0 * * * *  (every hour)
Posting window: 09:00 – 21:00 Moscow time
Per-group/page: max 1 post/hour, max VK_AUTOPOST_MAX_DAILY/day (default 3)
```

With 12 VK groups + 12 FB pages, the system can publish up to:
- VK: 12 groups × 3/day = 36 VK posts/day
- FB: 12 pages × 3/day = 36 FB posts/day

To change daily cap: set `VK_AUTOPOST_MAX_DAILY` / `FB_AUTOPOST_MAX_DAILY`
via wrangler secret bulk (or env var in wrangler.toml for non-secret values).

⚠️ **Volume warning**: going from 6+6 to 12+12 doubles daily volume. Consider
keeping caps modest initially (e.g. 2/day) and raising deliberately.

---

## Observability gap (known, 2026-06-12)

Social post results are NOT visible in the admin panel. To check:

1. **Wrangler tail** (live logs):
   `npx wrangler tail sovetydoma-subscriptions --name sovetydoma-subscriptions`

2. **Supabase `social_publications` table** — every post/failure recorded with
   `platform`, `article_slug`, `status`, `posted_at`, `provider_post_id`,
   `provider_payload` (includes postUrl).

3. **VK wall directly** — check https://vk.com/club239393062 etc.

4. **Inventory endpoint** (redacted, no IDs/tokens exposed):
   ```bash
   curl -s -H "x-admin-key: <ADMIN_API_KEY>" \
     https://<worker-host>/admin/social/autopost-inventory
   ```

Admin panel UI for social logs is a known gap (bead: sovetydoma-1n6).

---

## Open beads

- `BEAD-OPS-DA6` — complete VK/FB 12-category maps (this bead)
- `sovetydoma-32v` — complete FB_PAGES_BY_CATEGORY (superseded by BEAD-OPS-DA6)
- `sovetydoma-7md.7` — VK group kulinaria rename + FB pages branding
- `sovetydoma-ovx` — parent epic for multi-page routing
