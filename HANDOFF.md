# SovetyDoma — Engineering Handoff

> Handoff for the next engineer/agent (Codex). This file IS committed to git.
> **Secrets are never in this file** — only the *locations* of secret files.
> Operational detail with secret-file paths lives in the **gitignored**
> `DEPLOY-TIMEWEB.md` (project root) and `C:\dev\knowledge\sovetydoma-deploy.md`.

Last updated: 2026-06-10 (added social autoposting — see §2a).

---

## 1. What this is

**SovetyDoma** — a Russian-language home-tips content site (cooking, cleaning,
garden/dacha, life hacks, saving money, fishing). ~160 articles, growing toward
a large SEO content library.

- **Live:** https://1001sovet.ru (HTTPS, Let's Encrypt)
- **Secondary domain:** pogovorimdoma.ru → 301 → 1001sovet.ru
- **Repo:** github.com/filippmiller/sovetydoma (default branch **master**)
- **Local path:** `C:\DEV\sovetydoma`

## 2. Architecture

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | **Next.js 16, `output: 'export'`** (static) | Pure static — no server at request time. Everything is generated at build. |
| Content | **MDX** in `src/content/articles/<slug>.mdx` | gray-matter frontmatter. |
| Styling | Tailwind-ish inline styles + globals.css | |
| Backend (current) | **Supabase** (managed, ref `plwkjdpuxjkmpkqiqzkk`) | Postgres + Auth + RLS + Storage + Edge Functions (Deno). Auth = email/password. |
| Photos (UGC) | **Cloudflare R2** via a Worker | `NEXT_PUBLIC_PHOTO_WORKER_URL`. Moves to Timeweb S3 in Этап 2. |
| AI moderation | **Anthropic Claude** (vision) edge functions | `moderate-photo`, `moderate-comment`. Key in Supabase Vault. Moves to GigaChat in Этап 2. |
| Mailboxes | **Mailcow on Hetzner** | Shared human/editor inboxes at `mail.filippmiller.com`; see `docs/mailcow-shared-infra.md`. |
| Hosting | **nginx on a Timeweb Cloud VPS** (Russia) | Static files only. Replaced Vercel. |
| CI/CD | **GitHub Actions build gate** + **VPS pull deploy timer** | See §4. SSH remains the manual fallback. |

## 2a. Social autoposting (VK + Facebook)

An hourly Cloudflare Worker cron (`sovetydoma-subscriptions`, `0 * * * *`)
auto-posts the latest unposted article to VK and Facebook. **Facebook posts WITH
the article image; VK is text+link only** (VK image upload needs a *verified*
app — community tokens get `vk_27`). Up to 3/day per platform, 1/hour, 09–21 MSK.
Tracked in Supabase `social_publications` (dedup per platform+slug).

→ Full architecture, secrets, token howtos, and the VK verification path:
**`docs/AUTOPOST.md`**. Multi-page-per-category roadmap: `docs/AUTOPOST-MULTIPAGE.md`.

Key code: `workers/subscriptions/src/social/{vk,fb}.ts` + `{vk,fb}-autopost.ts`;
text rendering `scripts/lib/social-text.mjs`.

Article images: `public/images/<slug>.jpg` (real photos, committed to git, shipped
by CI). `src/lib/cloudinary.ts > resolveArticleImage()` maps frontmatter `image`
to a usable src; `src/components/ArticleImage.tsx` transparently falls back to the
category emoji if an image is missing/404s.

## 3. Infrastructure (Timeweb VPS)

- **Server:** Timeweb Cloud id `8194295`, IPv4 **188.225.86.238**, Ubuntu 24.04,
  4 vCPU / 8 GB / 80 GB NVMe, region ru-1/spb-3.
- **SSH:** `ssh -i ~/.ssh/timeweb_1001sovet root@188.225.86.238` (key-only).
- **Firewall:** ufw (SSH + 80 + 443), fail2ban active.
- **Web root:** `/var/www/1001sovet-current` → symlink to the active release in
  `/var/www/1001sovet-releases/<release>/`.
- **nginx:** `sites-available/1001sovet` (the site + SSL + pogovorimdoma 301),
  `sites-available/api-1001sovet` (api.1001sovet.ru → 503 stub, reserved for Этап 2).
- **SSL:** Let's Encrypt for 1001sovet.ru + www + api, auto-renew via certbot timer.
- **DNS (reg.ru, user-managed):** A-records `@`/`www`/`api` (1001sovet.ru) and
  `@`/`www` (pogovorimdoma.ru) → 188.225.86.238.
- **Timeweb API:** base `https://api.timeweb.cloud/api/v1`, `Authorization: Bearer <token>`.

Current hosting mode:

- The production site is a static Next.js export served by nginx on the Timeweb
  VPS. There is no Docker/container runtime on this VPS yet.
- Do not store all credentials in an app container. For now, build-time public
  env values live in GitHub Actions secrets, local-only values live in
  `C:\Users\filip\.secrets\` / `.env.local`, Cloudflare Worker values live as
  Worker secrets, and future server-side backend/container env lives in
  `/etc/1001sovet/secrets.env`.
- `/etc/1001sovet/secrets.env` is present on the VPS as `root:root` mode `0600`.
  It currently stores future backend/container secrets such as `RESEND_API_KEY`;
  static nginx does not read it.

## 4. CI/CD — how to deploy

**Just `git push` to master.** `.github/workflows/deploy.yml` does:
`pnpm install --frozen-lockfile` → `tsc --noEmit` → `pnpm run build` (static export)
→ sanity-check `out/index.html`. Production deploy is then pulled by the VPS:
`1001sovet-pull-deploy.timer` runs every minute, fetches `origin/master`, builds
the static export on the VPS with Node 24/pnpm, and calls
`/opt/deploy/activate.sh <release>` (atomic symlink swap, keeps last 5).

Why pull-based: on 2026-06-02 GitHub-hosted runners could not reliably reach the
Timeweb VPS over inbound IPv4 (`ssh-keyscan` on 22 and HTTPS upload on 443 both
timed out), while VPS outbound access to GitHub worked. Live verification must
therefore be done from an operator machine or over SSH/IPv6 until Timeweb fixes
the IPv4 reachability issue.

Installed VPS deploy units:
- `1001sovet-pull-deploy.timer` → `1001sovet-pull-deploy.service`
  → `/opt/deploy/pull-build-deploy.sh`.
- Emergency HTTPS receiver: `1001sovet-deploy-webhook.service` running
  `/usr/local/sbin/1001sovet-deploy-webhook.py` on `127.0.0.1:9101`, proxied by
  nginx at `/__deploy/health` and `/__deploy/upload` with bearer token.

- Manual run: `gh workflow run deploy.yml --repo filippmiller/sovetydoma`
- **Rollback:** `ssh -i ~/.ssh/timeweb_1001sovet root@188.225.86.238 /opt/deploy/activate.sh <older-release-dirname>`
- Also: `.github/workflows/ci.yml` (build + typecheck on PRs) and
  `telegram-notify.yml` (pings Telegram when new article .mdx land).
- Actions pinned to **v6 majors + Node 24**.
- GitHub repo secrets (set; values not shown): `DEPLOY_WEBHOOK_TOKEN`,
  `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_PHOTO_WORKER_URL`, `NEXT_PUBLIC_CONTACT_WORKER_URL`.
  (`NEXT_PUBLIC_SITE_URL` is hardcoded to https://1001sovet.ru in the workflow.)

## 5. The article factory (how content gets made)

Content is written by an **external AI (Kimi)** driven by prompt files, then
validated + imported locally.

**Prompt files** (paste into Kimi):
- `docs/kimi-100-topics.md` — a 100-article batch with assigned topics.
- `docs/kimi-500-batch.md` — a self-managed 500-article batch (Kimi invents topics,
  assigns/verifies its own slugs, commits every 50).
- `docs/kimi-articles.md` — the original/base prompt.

**Pipeline:**
1. Kimi writes `.mdx` files. Two paths:
   - directly into `src/content/articles/<slug>.mdx`, **or**
   - into `incoming-articles/*.mdx`, then `node scripts/import-articles.mjs`
     validates each and moves valid ones into `src/content/articles/` (skips
     slug collisions + invalid frontmatter).
2. Validate any single file: `node scripts/validate-article.mjs src/content/articles/<slug>.mdx`
   (checks frontmatter completeness, slug format = lowercase latin/digits/hyphens,
   category is one of the 6 valid slugs).
3. `pnpm run build` regenerates `src/lib/article-index.json`, the sitemap, and RSS
   from the .mdx set. (The `build` script runs the generators before `next build`.)
4. `git push` → CI deploys.

**Frontmatter schema** (every article):
```
title, slug, category, categoryName, description, date, image, tags[]
```
Recipes (category `kulinaria`) also add: `schemaType: "Recipe"`, `prepTime`,
`cookTime`, `recipeYield`, `difficulty`, `recipeIngredient[]` (for Recipe JSON-LD).

**Categories** (`src/lib/categories.ts`, exactly 6): `kulinaria` (Кулинария),
`dom-i-uborka` (Дом и уборка), `dacha-i-ogorod` (Дача и огород), `layfkhaki`
(Лайфхаки), `ekonomiya` (Экономия), `rybalka` (Рыбалка).

**Author personas** (`src/lib/personas.ts`, 4): maryana-sidorova, petr-pupkin,
petr-ivanov, andrey-rybak (fishing). `/author/<slug>` pages are generated.
`resolvePersona({author, category})` attributes articles.

⚠️ **ENCODING TRAP:** article files contain Cyrillic UTF-8. **Never** bulk-edit them
with PowerShell `Get-Content -Raw`/`Set-Content` without `-Encoding utf8` — it
corrupts Cyrillic to mojibake (`Ð¡Ð¾Ð²ÐµÑ‚Ñ‹Ð”Ð¾Ð¼Ð°`). Use `sed -i` (byte-safe for
ASCII patterns) or Node for any edit touching Cyrillic.

## 6. Article images

All 329 articles now have dedicated images + correct frontmatter (as of 2026-06 fix).

- Preferred: `node scripts/fetch-openverse-images.mjs` (free CC-licensed via openverse.org API; no key; supports --replace-generated --replace-procedural; MAX_FETCHES=... )
- AI fallbacks: `node scripts/generate-photo-like-images.mjs` (pollinations flux), `python scripts/generate-procedural-photo-images.py`, `python scripts/generate-card-images.py`
- Previews for cards: `python scripts/generate-image-previews.py` (always safe to re-run)
- Normalize sizes: `pnpm run normalize:images`
- Repair fm (if ever drift): `pnpm run fix:image-frontmatter`
- Audit (now also catches fm drifts): `pnpm run audit:images` (or node ... --json); must be clean (0 dups, 0 missing, 0 orphans, 0 drifts) before deploy.
- `src/lib/cloudinary.ts > resolveArticleImage()` + `src/components/ArticleImage.tsx` (404->emoji fallback).
- Validate enforces `image: "/images/<slug>.jpg"` exactly (single + bulk + import).

Images + previews committed to git. See also scripts/image-audit-utils.mjs (QUERY_MAP etc).

## 7. Этап 2 — backend migration to Russia (PLANNED, not started)

Goal: move DB/auth/storage/AI off foreign services onto the Russian VPS for
**152-ФЗ data-localization** compliance. Target API host: **api.1001sovet.ru**
(DNS + SSL + a 503 nginx stub already in place).

- **DB/Auth/RLS:** self-host Supabase via Docker on the VPS. App keeps working with
  only env changes (`NEXT_PUBLIC_SUPABASE_URL` → `https://api.1001sovet.ru`, plus
  regenerated anon/service keys from a new `JWT_SECRET`). Gotchas: `SMTP_PORT` must
  be non-empty even with `MAILER_AUTOCONFIRM=true`; match Postgres major version on
  dump/restore; use `supabase db dump` (not raw pg_dump); Storage files aren't in
  the DB dump (back up separately). Min 4 GB RAM (this VPS has 8).
- **Photos:** Cloudflare R2 → **Timeweb S3** (`s3.twcstorage.ru`, region `ru-1`,
  aws-sdk with `forcePathStyle: true`). Create bucket via the Timeweb API token.
- **AI moderation:** Anthropic Claude → **GigaChat 2 Max** (Sber — the only RU model
  with real image understanding). Needs the user to register at developers.sber.ru
  (RU phone) and provide an Authorization Key.
- Migrate FROM managed Supabase ref `plwkjdpuxjkmpkqiqzkk`.
- Roskomnadzor operator notification recommended (the user files this).

## 8. Local development

```bash
cd C:\DEV\sovetydoma
pnpm install
pnpm dev            # localhost:3000
pnpm run build      # static export to ./out (also regenerates indexes/sitemap/RSS)
```
`.env.local` (gitignored) holds `NEXT_PUBLIC_SITE_URL`, Supabase URL + anon key,
photo worker URL. Node 24, pnpm 10.

⚠️ On Windows, `next build`'s static-page worker occasionally crashes with exit
`3221226505` (0xC0000409). It's a flaky Turbopack/Windows multi-worker issue, not a
code error — just re-run. CI (Linux) never hits it.

## 9. Secret-file locations (values ONLY in these files — never commit)

| Secret | Location |
|--------|----------|
| Timeweb API token | `C:\Users\filip\.secrets\timeweb_api_token` |
| VPS root SSH key | `C:\Users\filip\.ssh\timeweb_1001sovet` |
| CI deploy SSH key | `C:\Users\filip\.secrets\gha_deploy_1001sovet` |
| Resend API key | `C:\Users\filip\.secrets\1001sovet-resend.env`; also on VPS in `/etc/1001sovet/secrets.env` and Cloudflare Worker secret `RESEND_API_KEY` |
| Mailcow mailbox credentials | `C:\Users\filip\.secrets\1001sovet-mailcow-mailboxes.env` |
| Anthropic API key | Supabase Vault: `get_secret('ANTHROPIC_API_KEY')` — **ROTATE** (was exposed in chat) |
| Unsplash Access Key (legacy) | rotate + move any remaining to `.secrets`; current path uses keyless Openverse + pollinations |
| reg.ru login | **not stored** — user performs registrar actions manually |

GitHub Actions secrets are set in the repo (see §4). `.env.local`, `DEPLOY-*.md`,
`*.secrets.md`, `.secrets/` are all gitignored.

## 10. Immediate next steps / open items

1. (done) All 329 articles have images + correct fm + 329 previews (drifts repaired via fix script + gates synced; openverse + generators now primary).
2. Confirm pogovorimdoma.ru DNS finished propagating, then verify the 301 over HTTPS.
3. **Rotate the Anthropic API key** (exposed in chat) and update the Supabase Vault.
4. Begin Этап 2 when ready (self-host Supabase + Timeweb S3 + GigaChat).
5. Optional: build Этап-2 only after confirming a Russian payment method for GigaChat.
6. (ongoing) When adding batches via Kimi, run fetch/generate previews + fix:image-frontmatter + audit:images + validate before push.
## Recent forensic review (2026-06-02)
Full codebase forensic review executed (structure, gates, security deep-dive on both workers, auth/admin/UGC, subscriptions feature, content pipeline, CI/deploy, prior audits reconciled).

- **Report:** `reports/forensic-codebase-review-2026-06-02.md` (Reality Check table, 11 risks with evidence, 12-axis style scores, P0/P1/P2 remediation with workstreams + success metrics).
- **New P0 beads:** sovetydoma-csv (key rotation + Unsplash to .secrets), sovetydoma-3ch (auth email confirm repair — re-opens Jun audit P0).
- Review also created tracking bead sovetydoma-rnh.
- GitHub Dependabot surfaced 2 moderate postcss (transitive in Next) on push — noted in report; not critical for this surface.
- Follow-ups: P0s above + finish the 7md.* omnichannel subscriptions series (tests, VK/OK/FB, audit trail).

Update this section on future reviews. All protocol followed (bd, commits, push).

## Recent subagent deep forensic scan (2026-06-04)
Max-depth forensic using 3 specialized background subagents (execute/read-only, 300+ tool calls total, non-mutating, full protocol followed at their starts + main):
- Security (107 calls, 278s): full workers (photo monolith 605 LOC + subs 912 LOC), RLS/migrations, authz (getUser first), UGC direct inserts, in-mem rates, crypto (timingSafe/HMAC/Svix/turnstile), contact challenge, admin client gate. Confirmed no regressions; amplified P1 UGC proxy/rate + RLS versioning gaps + personal emails. See sub report in session.
- Content (136 calls, 420s): exhaustive on 329 MDX (word counts, mojibake grep, fm keys, samples across cats/dates), all generators/audits/validate/import/image scripts + Kimi prompts + cross to subs/recs/search. Found exactly 29 shorts <300w, 2 real mojibake-corrupted in prod (full garbage in title/desc/tags), 58 image fm drifts (FIXED post-scan: see sovetydoma-mou + fix-image-frontmatter-drifts.mjs + gates in validate-articles + audit), rybalka omitted from sitemap/rss generators (hardcoded 5 cats), import (200w) vs validate (300w+mojibake) mismatch, broken audit-links (0 internal links), crude turbo/zen. See sub report.
- Quality/Hygiene (90 calls, 296s): full src/ (56 'use client', fav desync local<->server no migrate, category dupe lists, reactions optimistic races), package.json (inner "npm run" in tests), tracked package-lock.json, 7 stray root dupes (gray-matter 4.0.3 exact match), stale numbers in reports/HANDOFF (180 vs 329), no new any/dangerous/catch abuse (0). Confirmed gates clean. See sub report.

**Main + batch confirms:** 29 shorts + 2 garbled (real mojibake in 2 prod fm; inspected), direct .from inserts in Comments.tsx:229 etc, stray versions match, npm-run skew.

**Gates (re-runs):** tsc/lint/SEO/images clean for 329; subs tests pass; validate now catches shorts/mojibake (legacy still in tree).

**New beads created (P0/P1, linked to rnh tracker):** see bd list. Key: sync import/validate + fix 29+2 corpus (5r9), derive sitemap/rss cats (incl rybalka), fix 58 image drifts (mou — now closed after repair+enforce), pnpm consistency (replace npm run + rm package-lock), rm 7 strays, fav local-server migrate, UGC server proxies/rates (xoq), version RLS, update stale docs. Existing csv/3ch/5r9/xoq/7md.* updated with notes + evidence.

**Report:** `reports/forensic-subagent-deep-scan-2026-06-04.md` (exec summary, 29/2/58/ counts, top findings with files, bead cmds, verification commands).

**Next:** Close 5r9 after corpus+gate sync; address P0 content + hygiene first; then UGC defense-in-depth. All protocol (bd, git commit/push this) followed. Update this section on future reviews.
