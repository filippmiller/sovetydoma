# BEAD-OPS-DA6 Spec

## Objective

Bring VK/FB autopost category maps to 12/12 so every category posts to its own community/page.
Current baseline: VK 6/12, FB 2/12.

## Scope

In scope:

- Create 6 missing VK communities and collect their numeric group IDs.
- Confirm the VK token-owner account is admin of all 12 communities.
- Create 9 missing FB pages + wire the existing avto page.
- Obtain a long-lived page access token for each of the 12 FB pages.
- Build and upload `VK_GROUPS_BY_CATEGORY` and `FB_PAGES_BY_CATEGORY` via `wrangler secret bulk` (UTF-8, no BOM).
- Verify with `GET /admin/social/autopost-inventory` → expect VK 12/12, FB 12/12.
- Wait for live posts to new categories on cron, confirm `social_publications` rows with `status='posted'`.

Out of scope:

- Code changes (routing already done in da1).
- Changing daily caps (can be done later if volume jump is a concern).
- da5 (generation cadence) / da4 (factory portability) — separate beads, unblocked but not due.

## Constraints

- No redeploy needed — secret bulk updates live worker directly; cron picks up next tick.
- Never use `wrangler secret put` from PowerShell (BOM corruption risk).
- Always write bulk JSON files as UTF-8 without BOM.
- Retain a local copy of the final maps outside git (write-only secrets cannot be read back).
- Delete temp token files after upload.
- Do not store real ids/tokens in beads, commits, or docs.

## Relevant Files / Modules

- `src/lib/subscriptions/constants.mjs` — canonical 12 slugs (`SUBSCRIPTION_CATEGORY_SLUGS`)
- `workers/subscriptions/src/social/vk-autopost.ts` — `parseCategoryGroupMap`, `vkConfiguredCategories`
- `workers/subscriptions/src/social/fb-autopost.ts` — `parseCategoryPageMap`, `fbConfiguredCategories`
- `workers/subscriptions/src/admin.ts` — `handleAutopostInventory` (redacted inventory endpoint)
- `workers/subscriptions/wrangler.toml` — worker config for `secret bulk`
- `docs/AUTOPOST-MULTIPAGE.md` — outdated (6-category era); needs update when da6 closes

## Verification Requirements

Run (after upload):

```bash
curl -s -H "x-admin-key: <ADMIN_API_KEY>" \
  https://<subscriptions-worker-host>/admin/social/autopost-inventory
```

Expected result:

```json
{
  "ok": true,
  "total": 12,
  "vk": { "present": [...12 slugs...], "missing": [], "count": 12 },
  "fb": { "present": [...12 slugs...], "missing": [], "count": 12 }
}
```

Live posts verification:

- Wait for next in-window cron tick(s) (09:00–21:00 MSK, hourly).
- Query `social_publications` for `status='posted'` rows in newly-added categories.
- Join `articles_publication_index.category_slug` to confirm category coverage.

## Final Report Requirements

The final report must include:

- Files changed (none expected — this is ops-only, but note any doc updates).
- Verification run and outcome (inventory endpoint + live post checks).
- Remaining gaps or risks.
- Commit/deploy references if applicable (none expected).
