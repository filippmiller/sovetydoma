# BEAD-OPS-DA6 Handoff

## Current State

- Bead created 2026-06-25. Status: `running`.
- Checklist document verified against code and stored in this bead folder.
- No code changes needed — pure ops task for Philip.

## Important Caveats

- **VK**: 6 communities already exist (kulinaria, dom-i-uborka, dacha-i-ogorod, layfkhaki, ekonomiya, rybalka). Need 6 new ones.
- **FB**: 2 pages wired (dom-i-uborka, dacha-i-ogorod). 1 page exists but not wired (avto). 9 pages need creation.
- **One-token model (VK)**: the same `VK_ACCESS_TOKEN` / `VK_PHOTO_ACCESS_TOKEN` works for all groups — just make the token owner admin of all 12.
- **Per-page tokens (FB)**: each of the 12 pages needs its own long-lived page access token.
- **Upload method**: `wrangler secret bulk` from a UTF-8-no-BOM file. Never `secret put` from PowerShell.
- **Verification guardrail**: after every upload, hit the inventory endpoint. Malformed JSON silently falls back to single mode.

## Next Action

1. Philip creates 6 VK communities and 9 FB pages (FB avto already exists, just wire it).
2. Collect VK group IDs (bare positive numbers, no `-`) and FB page IDs + tokens.
3. Build `da6-secrets.json` bulk file (UTF-8, no BOM, outside git).
4. Upload: `npx wrangler secret bulk C:\tmp\secrets\da6-secrets.json --config workers/subscriptions/wrangler.toml`
5. Verify inventory endpoint returns 12/12 for both.
6. Wait for cron tick, confirm live posts in new categories.
7. Update this bead's `result.md` with verification evidence, set `status.json.status` to `done`.
