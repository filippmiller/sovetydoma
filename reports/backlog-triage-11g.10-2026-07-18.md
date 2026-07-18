# Backlog triage — bead sovetydoma-11g.10 (2026-07-18)

Scope: all open + in-progress beads EXCEPT the sovetydoma-11g.* family (owned by the parent agent).
Source: `bd list --status=open --limit=0` (85 open) + `bd list --status=in_progress --limit=0` (7 in progress);
11 beads are 11g.* (incl. 11g.8.1) -> 80 beads classified here.

Buckets: A = ACTIONABLE-NOW (agent, in-repo, no external accounts/money) · B = OPERATOR-BLOCKED (owner account/payment/dashboard/CAPTCHA/secret/approval) · C = SUPERSEDED/STALE-CANDIDATE (evidence of done/obsolete/duplicate).

Counts: **A = 53 · B = 16 · C = 11** (total 80).

Note: sovetydoma-u0l is already CLOSED (verified via `bd show` — close reason cites deployed fix + visual verification), so it does not appear in the open backlog.

| Bead | Title | Pri | Bucket | Evidence | Next action |
|---|---|---|---|---|---|
| 0h3.2 | Password reset completion flow | P0 | A (S) | Code shipped (src/components/auth/ResetPasswordForm.tsx; commits 3032d4b..8c13d41). 2026-06-17 blocker "gotrue fetch fails pre-network, no request in trace" matches the CSP root cause fixed LIVE 2026-07-17 (reports/auth-overhaul-2026-07-17.md §1: connect-src lacked Supabase origin -> all browser->Supabase calls refused). | Re-run real reset-link E2E in browser post-CSP-fix; if pass, close. |
| 0h3 | [epic] Auth rewrite | P0 | A (S) | 8/11 children closed; remaining .2 (likely fixed by CSP, above), .8, .9. | Close after .2/.8/.9 land. |
| 0h3.8 | Tests, browser QA, final report | P2 | A (S) | reports/auth-implementation-results-2026-06.md exists; auth tests exist (scripts/__tests__/auth-social-structure.test.mjs, src/lib/auth/*.test.ts); reset E2E was the only gap. | Final QA pass after 0h3.2 re-test; update report; close. |
| 0h3.9 | Turnstile + cooldowns on register/reset | P2 | A (S/M) | Cooldown exists (AuthModal.tsx:367 resend cooldown 60s) but TurnstileWidget is NOT wired into any auth form (grep: Turnstile only in ArticleQaBlock.tsx + SubscriptionPanel.tsx). | Wire TurnstileWidget into RegisterForm/ForgotPasswordForm behind turnstileConfigured(). |
| gsk | OAuth buttons (Google/VK/Yandex) | P1 | B | reports/auth-overhaul-2026-07-17.md: Google enabled+302 OK; Yandex flow live (authorize renders); VK worker exchange OK. Single remaining blocker: VK app 54626241 lacks trusted redirect URI. | OPERATOR (~2 min, VK console): add `https://1001sovet.ru/api/auth/vk/callback` to app 54626241 VK ID settings (runbook in the report). |
| chf | Hide/disable non-working OAuth buttons | P2 | C | Done by 2026-07-17 overhaul: SocialAuthSection.tsx renders ONLY real flows via *Enabled flags ("Never show a dead button"); fake Supabase VK/Yandex buttons removed (report §"What changed"). | Close as superseded by auth-overhaul-2026-07-17. |
| csv | Rotate exposed Anthropic/Unsplash keys | P0 | B | Tracked files are clean: `git grep -i sk-ant-api` = 0 hits; Unsplash appears only as env var NAME UNSPLASH_ACCESS_KEY (scripts/fetch-unsplash-images.mjs:15-28, value from env). Keys were exposed in chat history, not repo -> rotation needs provider consoles. | OPERATOR: rotate Anthropic API key (console.anthropic.com) + Unsplash access key (unsplash.com/oauth/apps), update GH secrets/Vault. |
| 1q7 | Set CONTENT_PUBLISH_PAT for autopublish cron | P1 | C | Superseded: .github/workflows/content-autopublish.yml header — scheduled drops REMOVED 2026-06-19 (bead i1k); workflow is now a manual no-redeploy drainer (publish-dynamic.mjs, DB+R2, `permissions: contents: read`, no PAT, no deploy trigger). | Close; no-redeploy publishing (docs/NO-REDEPLOY-PUBLISHING.md) replaced the PAT path. |
| 289 | [epic] Content factory WITHOUT redeploy | P0 | C | Achieved & live since 2026-06-11 (bead notes + docs/NO-REDEPLOY-PUBLISHING.md): renderer worker + Caddy @dynamic + publish-dynamic.mjs; articles live in seconds, zero GH Actions. Only child rih remains (tracked separately). | Close epic; keep rih open. |
| rih | Move article images out of deploy tarball -> R2 | P1 | A (L) | New articles already go to R2 (renderer serves /images/* from bucket); legacy public/images still tarred -> 413 past ~486 articles (docs/NO-REDEPLOY-PUBLISHING.md §"Still rebuild-based"). | Migrate legacy images to R2 + strip from out/ tarball; use SSH dist-stream interim. |
| p8f | Move pre-generated matrix images out of git into R2 | P2 | A (L) | public/images + matrix-exports images still committed (1768 imgs cited in bead); R2 + wrangler path proven by publish-dynamic. Overlaps rih but distinct scope (git bloat vs tarball). | Script git->R2 migration + history note; coordinate with rih. |
| ccc | Backfill articles_publication_index | P1 | B | Bead notes: unblocked by da8 (dep e11 closed) but "Requires separate explicit OK" for one-time prod DB upsert (~1629 rows). No backfill script exists in scripts/ yet (only sync-subscription-publication-index.mjs for MDX). | OPERATOR: reply "run the backfill" -> agent writes dry-run select, reviews, then upserts. |
| e3z | Remove 7 stray root package dirs | P2 | A (S) | 5 of 7 already gone (argparse, js-yaml, kind-of, is-extendable, strip-bom-string absent). gray-matter/ and section-matter/ still at repo root, untracked (git ls-files = 0 hits); real gray-matter resolves via node_modules (package.json dep ^4.0.3). | Delete gray-matter/ + section-matter/; run pnpm install + tests; close. |
| p8c | 5000 idea slots + first 100 articles | P0 | B | 2026-07-18 production failure (run 29640962692): Anthropic HTTP 400 "credit balance too low" (bead 6sq comment + commit 702466f83). Generation needs funded providers. | OPERATOR: top up Anthropic credit balance (and confirm fal.ai/Grok budgets). |
| 6sq | Cron content pipeline (image pre-gen + scheduled gen) | P0 | A (S) | Pipeline shipped (content-factory.yml cron 0 */5 * * *, scripts/matrix/*, content-autopublish drainer). 2026-07-18 comment: remaining engineering = operator alerting + documented fallback/no-op on provider failure. | Add failure alerting (telegram-notify pattern) + fallback doc; close. Funding part is p8c (B). |
| ywl | Design+build content matrix + seed | P0 | C | Built: migration 20260604105305_content_matrix.sql, scripts/matrix/* (seed/insert-ideas/gen-*/publish), docs/content-matrix-design.md, seed of 329 done (bead notes). Mass-fill volume work is tracked by p8c/da5. | Close as built; reference p8c for volume. |
| da4 | [epic] Portable 3-stage factory | P1 | A (L) | First-return recon done (bead notes): schema ready (12-cat CHECK), ~16 scripts hardcode DOMAIN, researcher stage missing, phased plan in C:\tmp\da4-firstreturn.md. Phase 1 (site-config extraction) is pure code. | Execute Phase 1 site-config + per-site category validation. |
| da5 | 1 article x 12 categories every 6h | P1 | B | Workflow change is trivial (cron + --all + --limit 12) but bead notes: "Not implementing now per owner"; 48 art/day cost with Anthropic already at zero balance; ordering says da6 first. | OPERATOR: approve cadence change + fund providers; then agent flips 3 lines in content-factory.yml. |
| da6 | VK/FB category targets + secret maps for 12 cats | P1 | B | docs/AUTOPOST-MULTIPAGE.md status 2026-06-25: VK 6/12 groups, FB 2/12 tokens; remaining pages/communities must be created in owner accounts. | OPERATOR: create 6 VK communities + 9 FB pages per the doc checklist; agent then wires secrets. |
| da1 | Subscription/autopost routing 6 -> 12 categories | P1 | B | Subscription side already 12 (src/lib/subscriptions/constants.mjs SUBSCRIPTION_CATEGORY_SLUGS = 12). Autopost routing limited by da6 social maps (VK 6/12, FB 2/12), not code. | Blocked on da6 operator work; then verify routing and close. |
| ovx | Multi-page social routing | P2 | B | Code deployed (vk-autopost.ts/fb-autopost.ts per-category loops; docs/AUTOPOST-MULTIPAGE.md). Same operator dependency as da6/32v (missing pages/tokens). | Close as duplicate-of da6/32v once owner creates pages, or keep as tracker. |
| 32v | FB per-category pages: ready-to-paste + wire FB_PAGES_BY_CATEGORY | P2 | B | Ready-to-paste blocks ALREADY written (docs/AUTOPOST-MULTIPAGE.md Steps 1-3 incl. console token script + BOM-safe PowerShell map). Wiring needs real page IDs/tokens. | OPERATOR: create 9 FB pages + harvest tokens per doc; agent wires secret. |
| 1h0 | Canonical host + dynamic SEO discoverability | P1 | A (S) | Dynamic discoverability largely shipped: sitemap-dynamic.xml, /stati/ hubs, internal linking RENDER_VERSION=7 (docs/NO-REDEPLOY-PUBLISHING.md). Canonicals OK per reports/seo-indexing-readiness-2026-06.md. Canonical host (www->apex 301) unverified. | Verify www->apex + http->https 301 on Caddy; fix if missing; close. |
| 2wn | Dramatic SEO improvement plan + implementation | P1 | A (M) | Much implemented: JSON-LD in 15 files (Article/NewsArticle/Breadcrumb), hubs, internal links, audit-seo gate, max-image-preview:large. CWV items (preload/fetchpriority/AVIF) partially open. | Audit remaining checklist (improvement-plan-2026-06-10.md items 16-23), finish CWV, close. |
| qup | SEO max: Discover + structured data + re-engagement | P1 | A (M) | Structured data done (see 2wn). Discover blocked on image sizes (7sf). Re-engagement: web push code exists (workers/subscriptions/src/push-send.ts), email digests = 7md.3. | Implement push subscribe UI + digest scheduling. |
| 7sf | Regenerate sub-1200px images for Discover | P2 | A (L) | New generator defaults 1280x960 (reports/HANDOFF-no-redeploy-factory-2026-06-11.md:33); legacy corpus still has <1200px images. Scripts exist (regen-images-fal.mjs, generate-image-dimensions). | Run dimension audit -> batch regen legacy small images (fal.ai budget permitting). |
| u15 | Full security audit 2026-06-10 | P1 | C | Reports exist: reports/security-audit-2026-06-10.md + security-audit-2026-06-10-subscriptions-and-rls.md. Audit delivered; follow-ups live in their own beads (a7g, e8r). | Close with report citation. |
| wf6 | Efficiency audit 2026-06-10 | P2 | C | Report exists: reports/efficiency-and-hardening-2026-06-10.md. | Close with report citation. |
| rnh | Forensic codebase review 2026-06-02 | P2 | C | Title says "completed"; report exists: reports/forensic-codebase-review-2026-06-02.md (+ deep-scan 2026-06-04). Bookkeeping bead. | Close. |
| a7g | 3 deferred Supabase advisors | P3 | A (S) | pg_trgm created in public schema (supabase/migrations/20260604105305_content_matrix.sql:12) - still unfixed; other two (newsletter anon INSERT, photos bucket listing) need SQL review. | Write migration moving pg_trgm to extensions schema + tighten policies. |
| e8r | Add Content-Security-Policy headers | P3 | A (S) | CSP now exists in live Caddyfile (auth-overhaul report §1, added 2026-07-17) and in workers/subscriptions/src/index.ts; renderer worker + committed Caddy CSP template still missing. | Add CSP to renderer worker responses + commit a reference Caddyfile snippet to repo. |
| 8gb | Build+host VK Mini App at vk.1001sovet.ru | P2 | B | vk-miniapp/dist built; hosting = static deploy agent can do, but DNS record for vk.1001sovet.ru + VK moderation submission need owner accounts. | OPERATOR: add DNS A-record vk.1001sovet.ru -> VPS; agent deploys dist + Caddy; owner submits to VK moderation. |
| ceq | Best user dashboard | P2 | A (L) | moy-kabinet + izbrannoe exist; personalization/history/follows not built. | Design + implement dashboard slices. |
| 7md | [epic] Omnichannel subscriptions | P1 | A | Children split (below); core model+UI+worker exist. | Drive children; see below. |
| 7md.1 | Subscription data model | P1 | C | Done: supabase/migrations/202606021300_omnichannel_subscriptions.sql + constants.mjs (12 cats, 5 direct channels, 3 social targets, frequency presets). | Verify vs bead spec; close. |
| 7md.2 | Subscription UI | P1 | C | Done: src/components/subscriptions/SubscriptionPanel.tsx + src/app/podpiski/ (Turnstile-gated, manage mode). | Verify all 12 categories selectable; close. |
| 7md.3 | Delivery pipeline for all direct channels | P1 | A (M) | delivery.ts + push-send.ts + providers/ exist; whether max/whatsapp/sms actually deliver is unverified (likely stubs). | Audit per-channel delivery; implement/stub honestly; close. |
| 7md.4 | VK/OK/FB social follow targets | P1 | B | OK page does not exist; VK/FB pages partial (da6). | OPERATOR: create OK page (+ missing VK/FB via da6). |
| 7md.5 | Subscription audit trail + operator visibility | P1 | A (S) | No audit-trail surface found in repo (admin.ts exists for worker admin). | Add audit log table/admin view. |
| 7md.6 | Cover subscription flows with tests | P1 | A (S) | Substantial tests already (package.json test:subscriptions* 5 suites); gap analysis needed. | Gap analysis + add missing cases; close. |
| 7md.7 | Create VK/OK/FB pages | P1 | B | Account creation on owner social accounts. | OPERATOR: create pages (same checklist as da6 + OK). |
| b6y | [epic] Growth backlog (20 ideas) | P1 | A | Children below; 2 of 16 open children appear already built (b6y.5, b6y.8). | Triage children; close built ones. |
| b6y.5 | Programmatic comparison pages | P2 | C | Exists: src/app/[category]/sravnenie/[pair]/page.tsx (with JSON-LD). | Verify coverage/quality; close. |
| b6y.6 | /q/ Q&A flywheel | P1 | A (M) | /q/ + /q/[slug]/ exist (src/app/q) but no flywheel (answer solicitation, UGC loop). | Build ask/answer loop on existing /q/. |
| b6y.7 | VK mini-app checklist companion | P2 | A (L) | vk-miniapp/ app exists; depends on 8gb hosting/moderation. | After 8gb, add checklist feature. |
| b6y.8 | Favorites 2.0 shareable collections | P2 | C | src/app/kollekcii/ exists (added 2026-06-16). | Verify share/naming features vs spec; close. |
| b6y.10 | Web Push for followed categories | P1 | A (M) | push-send.ts worker code exists; subscribe UI + VAPID wiring unverified. | Add subscribe prompt + category preference wiring. |
| b6y.11 | WB/Ozon partner bundles | P1 | B | Requires partner/affiliate accounts + contracts. | OPERATOR: register affiliate accounts (WB/Ozon partner programs). |
| b6y.12 | Premium content tier | P2 | A (L) | Paywall logic is code; payment rail (RU) would later need operator. | Build tier flag + gating UI. |
| b6y.13 | "Вызов мастера" lead-gen | P1 | A (M) | Pure feature work (form + routing to email/telegram which exist). | Implement contextual lead form. |
| b6y.14 | Telegram digest + Stars monetization | P2 | A (M) | Digest: telegram-notify + worker telegram provider exist. Stars payments need operator bot config (separate step). | Build digest; leave Stars as operator follow-up. |
| b6y.15 | Reader-question content loop | P1 | A (M) | /q/ + ArticleQaBlock exist; editorial loop is process+code. | Wire "reader asked -> we checked" pipeline. |
| b6y.16 | Regional variant pages | P2 | A (L) | Code/content generation work. | Design regional variant generator. |
| b6y.17 | Freshness-decay monitor + refresh queue | P1 | A (M) | quality-gate.mjs --report scans published corpus; no decay scheduler. | Add freshness scoring job + refresh queue. |
| b6y.18 | Named expert reviewers (E-E-A-T) | P2 | B | Needs real named humans - owner decision/recruitment. Author pages infra exists (src/app/author/[slug]). | OPERATOR: appoint/name experts; agent then wires profiles. |
| b6y.19 | Community "Советую" tips widget | P2 | A (M) | UGC infra exists (comments, photo-upload). | Build tips widget + moderation. |
| b6y.20 | Before/After photo challenge | P2 | A (M) | photo-upload worker + VK mini-app exist. | Build challenge flow. |
| g5m | [epic] Humanize published articles | P2 | A | scripts/matrix/humanize-articles.mjs exists; uses LOCAL Kimi CLI (`kimi --print`, line 71) - NOT Anthropic, so not funding-blocked. | Run pilot g5m.1; review; roll out. |
| g5m.1 | Humanizer pilot: dacha (602) | P2 | A (L) | Same as above; DB-backed (rewrites body_md, tags kimi-human-v2). | Run pilot batch + QA sample. |
| g5m.2 | Humanizer: kulinaria (207) | P2 | A (L) | Depends on pilot outcome. | After g5m.1. |
| g5m.3 | Humanizer: dom-i-uborka (189) | P2 | A (L) | Depends on pilot. | After g5m.1. |
| g5m.4 | Humanizer: avto/layfkhaki/rybalka/ekonomiya | P2 | A (M) | Smaller batches. | After g5m.1. |
| g5m.5 | Humanizer: new categories | P2 | A (M) | Smaller batches. | After g5m.1. |
| i1p | [epic] Social responder | P1 | A | responder.ts exists (16KB, 2026-06-17); children split. | Drive children below. |
| i1p.2 | FB App Review: pages_manage_engagement | P1 | B | Meta App Review submission requires owner's FB developer account + screencast. | OPERATOR: submit App Review in Meta developer dashboard. |
| i1p.3 | FB app assets: icon + privacy + data-deletion URLs | P2 | A (S) | Icon assets exist (.vk-assets/, 1024px derivable); /privacy/ page exists; data-deletion URL not found. | Create /privacy + /data-deletion pages + 1024px icon. |
| i1p.4 | Rotate FB App Secret | P1 | B | Secret transited chat 2026-06-17; rotation = Meta dashboard. | OPERATOR: roll app secret in Meta dashboard -> wrangler secret bulk. |
| i1p.5 | Boot test responder end-to-end | P2 | A (S/M) | responder.ts + /admin/responder exist; needs a real staged comment test. | Post test comment on owned VK group; verify draft appears. |

## Top-10 highest-value ACTIONABLE-NOW items

1. **sovetydoma-0h3.2** (P0, S) - Re-test password-reset E2E after the 2026-07-17 CSP fix; very likely unblocks/closes the whole P0 auth epic.
2. **sovetydoma-0h3.9** (P2, S/M) - Wire existing TurnstileWidget into register/forgot forms (abuse protection; component already used elsewhere).
3. **sovetydoma-0h3.8** (P2, S) - Final auth QA + results report; closes the 0h3 epic together with .2/.9.
4. **sovetydoma-e3z** (P2, S) - Delete the last 2 stray dirs (gray-matter/, section-matter/); trivial hygiene win, 5 of 7 already done.
5. **sovetydoma-a7g** (P3, S) - Fix 3 Supabase security advisors (pg_trgm in public schema is a live migration defect).
6. **sovetydoma-6sq** (P0, S) - Add failure alerting + documented no-op fallback to content-factory.yml so the next zero-credit run pages the operator instead of failing silently.
7. **sovetydoma-rih** (P1, L) - Move legacy images out of the deploy tarball to R2; removes the hard 413 deploy ceiling (~486 articles) blocking all code deploys at scale.
8. **sovetydoma-1h0** (P1, S) - Verify/fix canonical host 301s (www->apex) on Caddy; most of the bead (dynamic discoverability) is already shipped.
9. **sovetydoma-i1p.5** (P2, S/M) - Boot-test the social responder end-to-end with a staged VK comment; validates the whole i1p epic's core loop without Meta approval.
10. **sovetydoma-g5m.1** (P2, L) - Humanizer pilot on 602 dacha articles via local Kimi CLI - content-quality moat that is NOT blocked by the Anthropic funding issue.

## Operator-blocked quick wins (smallest single actions)

- **gsk**: add VK redirect URI `https://1001sovet.ru/api/auth/vk/callback` in VK app 54626241 (~2 min) -> unblocks VK login.
- **csv**: rotate Anthropic + Unsplash keys in provider consoles (repo is clean; exposure was chat-side).
- **p8c/da5**: top up Anthropic credit balance -> unblocks the entire content factory.
- **ccc**: reply "run the backfill" (one-time prod DB upsert, dry-run first).
- **da6/ovx/32v/7md.7/da1**: create 6 VK communities + 9 FB pages + 1 OK page (checklists ready in docs/AUTOPOST-MULTIPAGE.md).
