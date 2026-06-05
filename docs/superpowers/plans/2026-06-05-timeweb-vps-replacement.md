# Timeweb VPS Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:verification-before-completion before claiming each infrastructure step is complete. This plan is for live production recovery, so preserve rollback at every stage.

**Goal:** Rebuild only the `1001sovet.ru` production web VPS on a fresh Timeweb Cloud server and cut DNS over after direct verification.

**Architecture:** Keep the existing VPS online as rollback. Create a new Ubuntu 24.04 Timeweb VPS in the same account/project, install static nginx hosting, deploy the current git build, verify by direct IP/host override, then change only the `1001sovet.ru`, `www`, and `api` web DNS records.

**Tech Stack:** Timeweb Cloud API, Ubuntu 24.04, nginx, certbot, static Next.js export, reg.ru DNS.

---

### Task 1: Guardrails And Inventory

**Files:**
- Read: `C:\DEV\sovetydoma\DEPLOY-TIMEWEB.md`
- Read: `C:\DEV\sovetydoma\HANDOFF.md`
- Read: current VPS `/etc/nginx/sites-available/1001sovet`
- Read: current VPS `/opt/deploy/activate.sh`

- [ ] Confirm the replacement touches only Timeweb server resources for `1001sovet`.
- [ ] Record current old server id, IPs, nginx config, deploy script, active release, and deploy tokens without printing secrets.
- [ ] Confirm old VPS remains online until the new server passes direct verification.

### Task 2: Create Replacement VPS

**Files:** none.

- [ ] Use Timeweb API `POST /api/v1/servers` with Ubuntu 24.04, project `2497600`, preset comparable to old server `2455`, SSH key id `624273`, and a distinct name such as `1001sovet-replacement`.
- [ ] Wait until the new server status is `on`.
- [ ] Capture new server id, IPv4, IPv6, and node name.
- [ ] Verify SSH access with `C:\Users\filip\.ssh\timeweb_1001sovet`.

### Task 3: Bootstrap Static Hosting

**Files:** server-side only.

- [ ] Install `nginx`, `certbot`, `python3-certbot-nginx`, `rsync`, `tar`, and basic utilities.
- [ ] Create `/var/www/1001sovet-releases`, `/var/www/1001sovet-current`, `/opt/deploy`, and `/etc/1001sovet`.
- [ ] Install nginx vhosts for `1001sovet.ru`, `www.1001sovet.ru`, `pogovorimdoma.ru`, `www.pogovorimdoma.ru`, and the `api.1001sovet.ru` 503 stub.
- [ ] Install `/opt/deploy/activate.sh` and deploy webhook/config only if required for compatibility.
- [ ] Verify `nginx -t` succeeds and nginx listens on 80/443.

### Task 4: Deploy Current Build

**Files:** repo build output only.

- [ ] Build the static site from the current repo checkout.
- [ ] Upload the build to `/var/www/1001sovet-releases/<release>`.
- [ ] Run `/opt/deploy/activate.sh <release>`.
- [ ] Verify local server response on the new VPS returns HTTP 200 for `1001sovet.ru` and `www.1001sovet.ru`, and HTTP 503 for `api.1001sovet.ru`.

### Task 5: Verify Before DNS Cutover

**Files:** none.

- [ ] Verify direct IPv4 and IPv6 reachability using curl `--resolve`.
- [ ] Verify from external probe nodes where possible.
- [ ] Do not modify DNS unless direct new-server verification is stronger than the old VPS state.

### Task 6: DNS Cutover

**Files:** reg.ru DNS only.

- [ ] Change only `A @`, `A www`, and `A api` for `1001sovet.ru` to the new IPv4.
- [ ] Change only `AAAA @` and `AAAA www` if the new IPv6 serves the site correctly.
- [ ] Do not change MX, SPF, DKIM, DMARC, Mailcow, unrelated domains, or other Timeweb projects.
- [ ] Verify authoritative `ns1.reg.ru` and `ns2.reg.ru` answers.

### Task 7: Post-Cutover Verification

**Files:** none.

- [ ] Verify public `https://1001sovet.ru/` and `https://www.1001sovet.ru/`.
- [ ] Verify old VPS is still available for rollback but no longer authoritative for web DNS.
- [ ] Leave a concise handoff with old/new IDs, IPs, and any unresolved cache/routing issues.

---

## Execution Notes

- New VPS: Timeweb server `8264713`, name `1001sovet-replacement`, location `ru-3`, zone `msk-1`, node `kvmnvm-773`.
- New IPs: IPv4 `147.45.146.11`, IPv6 `2a03:6f00:a::2:bbac`.
- Old rollback VPS left online: server `8194295`, IPv4 `188.225.86.238`, IPv6 `2a03:6f01:1:2::2:15e5`.
- Deployed release: `/var/www/1001sovet-releases/manual-249d3cda-20260605T0645Z`.
- Deployed build SHA: `249d3cda52e63a3419adafba5a9ba6f6cd31c9e4`.
- SSL: existing valid Let's Encrypt certificate copied from old VPS; covers `1001sovet.ru`, `www.1001sovet.ru`, and `api.1001sovet.ru`; expires `2026-08-29`.
- Deploy webhook: copied and enabled as `1001sovet-deploy-webhook.service`, listening on `127.0.0.1:9101`; nginx `/__deploy/health` returns `{"ok": true}`.
- Pull deploy timer: copied but currently disabled on the replacement.
- DNS changed at reg.ru only for web records: `A @`, `A www`, `A api` to `147.45.146.11`; `AAAA @`, `AAAA www` to `2a03:6f00:a::2:bbac`.
- Mail DNS records were not changed.
- Verification: direct HTTPS to the new IPv4 returns `200` for apex and `www`, `503` for the expected `api` placeholder; authoritative reg.ru endpoints return the new A/AAAA values.
- Cache note: Cloudflare resolver already returns the new A/AAAA values. Google resolver still had stale A records during verification, but had the new AAAA records, so IPv6-capable clients should reach the replacement while Google A cache expires.

## Final Agent Handoff - 2026-06-05

### Current Production State

- Production URL checked: `https://1001sovet.ru/dacha-i-ogorod/zamachivanie-semyan-svekly/`.
- Active VPS: Timeweb server `8264713`, `1001sovet-replacement`.
- Active server IPs: IPv4 `147.45.146.11`, IPv6 `2a03:6f00:a::2:bbac`.
- Rollback VPS still online: Timeweb server `8194295`, IPv4 `188.225.86.238`, IPv6 `2a03:6f01:1:2::2:15e5`.
- Active release on replacement VPS: `/var/www/1001sovet-releases/rel-90896cbe-20260605084536`.
- Active build JSON: `{"sha":"90896cbe63b52152d8e464109df8e5c3620716cc","ref":"master","built_at":"2026-06-05T08:44:35.501Z"}`.
- `dist` branch build commit observed: `e5ed4586 build 90896cbe63b52152d8e464109df8e5c3620716cc (2026-06-05T08:44:42Z)`.
- `master` commits added during page recovery:
  - `817c384f` - `Prevent article crash when Supabase env is missing`
  - `1015299b` - `Fix mobile header overflow`
  - `90896cbe` - `Tighten mobile header actions`

### Incident Findings And Fixes

- First browser failure after VPS rebuild: `_next/static/chunks/*` returned `403 Forbidden`.
  - Root cause: bad execute permissions on release directories, especially `/var/www/1001sovet-current/_next/static`.
  - Fix applied: release directories set to `755`, files to `644`.
- Second browser failure after static permissions fix: client crashed with `Supabase env vars not set`.
  - Root cause: public article widgets could synchronously call Supabase getters and crash the whole page if public Supabase env was missing in a static build.
  - Code fix: added `isSupabaseConfigured()` in `src/lib/supabase.ts`; guarded public auth/bookmark/comments widgets.
- Mobile issue found during critical browser review: horizontal overflow on 390px viewport.
  - Root cause: header actions plus logo exceeded available mobile grid width.
  - Code fix: made header inner box-sized, tightened mobile header actions, and hid secondary heart icon on narrow mobile.
- Deploy-script issues found on replacement VPS:
  - `/opt/deploy/pull-build-deploy.sh` used `node -e` to parse `build.json`, but the replacement VPS has no Node.js.
  - This created a bad release named `rel--20260605083828`.
  - Fix applied server-side: `json_sha()` now parses `build.json` through `python3`.
  - Healthcheck also changed from `https://127.0.0.1/` with only `Host` header to SNI-correct `curl --resolve 1001sovet.ru:443:127.0.0.1 https://1001sovet.ru/`.
  - Verified fixed deploy script activated `rel-90896cbe-20260605084536` and printed `healthcheck 200`.

### Verification Evidence

- `curl --resolve 1001sovet.ru:443:147.45.146.11 https://1001sovet.ru/build.json` returned active SHA `90896cbe63b52152d8e464109df8e5c3620716cc`.
- `curl --resolve 1001sovet.ru:443:147.45.146.11 -I https://1001sovet.ru/dacha-i-ogorod/zamachivanie-semyan-svekly/` returned `HTTP/1.1 200 OK`.
- Server-side `/opt/deploy/pull-build-deploy.sh` completed with `healthcheck 200`.
- Playwright desktop verification:
  - Page title: `Как замачивать семена свеклы перед посевом на рассаду | СоветыДома`.
  - Console: `0` errors, `0` warnings.
  - Horizontal overflow: `0`.
- Playwright mobile verification at `390x844`:
  - Console: `0` errors, `0` warnings.
  - `document.documentElement.scrollWidth - clientWidth` was `0`.

### Current DNS/Infra Boundaries

- reg.ru DNS changed only for web records:
  - `A @`, `A www`, `A api` -> `147.45.146.11`
  - `AAAA @`, `AAAA www` -> `2a03:6f00:a::2:bbac`
- Mail DNS records were intentionally not changed.
- Other Timeweb projects were not touched.
- Pull deploy timer on replacement VPS remains copied but disabled unless explicitly re-enabled later.

### Remaining Non-Blocking Page Quality Notes

- The page is technically healthy now, but the top content quality is still weak:
  - `Краткий ответ` repeats the generic article description instead of giving the real answer.
  - `С чего начать` is also too template-like.
  - Right-sidebar related cards now show placeholders rather than broken images, but they still look generic and low-value.

### Open Issue: `pogovorimdoma.ru`

- Before deleting old VPS `8194295`, DNS checks showed `pogovorimdoma.ru` and `www.pogovorimdoma.ru` still resolving to old IPv4 `188.225.86.238`.
- HTTP on the old VPS returned a redirect to `http://1001sovet.ru/`.
- HTTPS for `pogovorimdoma.ru` was not working, and the replacement VPS did not have a valid certificate for this domain during the check.
- Owner explicitly accepted deleting the old VPS anyway on 2026-06-05.
- Follow-up: decide whether `pogovorimdoma.ru` should be restored as a redirect on the replacement VPS, then update DNS/cert/nginx accordingly.

### Old VPS Deletion

- Old Timeweb VPS `8194295` (`1001sovet`, old IPv4 `188.225.86.238`) was deleted through the Timeweb Cloud API on 2026-06-05.
- Post-delete Timeweb API verification: `GET /api/v1/servers/8194295` returned `404 server_not_found`.
- Replacement VPS `8264713` (`1001sovet-replacement`) remained present in the server list.
- Post-delete production check: `https://1001sovet.ru/build.json` still returned SHA `90896cbe63b52152d8e464109df8e5c3620716cc`, and the checked article URL still returned `HTTP/1.1 200 OK`.

### Do Not Lose

- If production appears stale, check `/build.json` first.
- If a future static deploy fails, inspect `/opt/deploy/pull-build-deploy.sh` on the replacement VPS before changing DNS or rebuilding the server.
- Old VPS `8194295` is no longer available as rollback; use git/build artifacts and replacement VPS `8264713` for future recovery.
