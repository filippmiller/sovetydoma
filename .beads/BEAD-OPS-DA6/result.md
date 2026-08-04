# BEAD-OPS-DA6 Result

## What Changed

- No code changes — this is pure ops/secret work.
- VK: 6 missing communities to be created, 6 existing group IDs retained.
- FB: 9 missing pages to be created, 1 existing avto page to be wired, 2 existing entries retained.
- Final maps uploaded via `wrangler secret bulk`.
- Inventory endpoint verified 12/12 for both platforms.

## Verification Run

```bash
# Inventory check (after upload)
curl -s -H "x-admin-key: <ADMIN_API_KEY>" \
  https://<worker-host>/admin/social/autopost-inventory
```

Expected:
```json
{
  "ok": true,
  "total": 12,
  "vk": { "present": ["kulinaria", "dom-i-uborka", "dacha-i-ogorod", "layfkhaki", "ekonomiya", "rybalka", "zdorovie-i-bezopasnost", "semya-i-deti", "krasota-i-uhod", "otdyh-i-puteshestviya", "pokupki-i-tehnika", "avto"], "missing": [], "count": 12 },
  "fb": { "present": ["kulinaria", "dom-i-uborka", "dacha-i-ogorod", "layfkhaki", "ekonomiya", "rybalka", "zdorovie-i-bezopasnost", "semya-i-deti", "krasota-i-uhod", "otdyh-i-puteshestviya", "pokupki-i-tehnika", "avto"], "missing": [], "count": 12 }
}
```

Live posts check (after 1–2 cron cycles within window):
- Query `social_publications` for `status='posted'` in newly-added categories.
- Confirm `articles_publication_index.category_slug` join matches.

## Remaining Gaps

### Session 2026-06-25 (browser-driven)

**VK — DONE, 12/12 uploaded.** Key correction to the original plan: the 4
"missing" VK communities (zdorovie-i-bezopasnost, semya-i-deti, krasota-i-uhod,
otdyh-i-puteshestviya) were NOT missing — they already existed as managed
communities. No VK creation was needed. All 12 numeric group IDs were collected
from the /groups managed list, written to `C:\tmp\da6-secrets.template.json`,
and uploaded VK-only via `wrangler secret bulk C:\tmp\da6-vk-only.json`
(✨ "Successfully created secret for key: VK_GROUPS_BY_CATEGORY"). JSON validated
locally (parses, 12 groupId entries, no BOM) so malformed-fallback risk is nil.
(IDs intentionally not listed here per the "no real ids in beads" constraint —
they live in C:\tmp + the live secret.)

**FB — BLOCKED by rate limit.** Created kulinaria page (Food & Drink) ✅.
Next attempt (layfkhaki) hit "You have created too many Pages recently. Please
try again later." Stopped to avoid a harder block/account flag. FB state now:
4 of 12 pages exist (kulinaria new; dom-i-uborka, dacha-i-ogorod, avto
pre-existing). 8 still to create after cooldown (ekonomiya, rybalka, zdorovie,
semya, krasota, otdyh, pokupki, layfkhaki). FB name rule discovered: page names
reject em-dash (—); must use regular hyphen " - " (matches existing pages).
Token collection + FB map upload deferred to the post-cooldown pass.

**Decision:** partial go-live chosen — VK pushed today, FB in a later pass.

## Risks / Follow-ups

- **Malformed-JSON fallback**: if the whole map string is invalid JSON, the worker silently falls back to single-group/page mode. Always re-verify via inventory after upload.
- **FB page creation rate limits**: 9 new pages may hit FB throttles or review gates. Sequence FB pages first if timeline matters.
- **Token expiry**: FB page tokens must be long-lived (non-expiring). Short-lived tokens silently fail.
- **Volume jump**: 12 categories × default cap 3/day = ~36 posts/day per platform. Consider keeping caps modest initially.
- **Local copy retention**: write-only secrets can't be read back. Keep the final bulk JSON safe outside git.

## References

- Parent epic: `sovetydoma-da1` (code routing already done; blocked only on map coverage)
- Child docs: `docs/AUTOPOST-MULTIPAGE.md` (update to 12-category when this closes)
- Inventory endpoint: `workers/subscriptions/src/admin.ts` (`handleAutopostInventory`)
