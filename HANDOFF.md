# SovetyDoma — Engineering Handoff

> Handoff for the next engineer/agent (Codex). This file IS committed to git.
> **Secrets are never in this file** — only the *locations* of secret files.
> Operational detail with secret-file paths lives in the **gitignored**
> `DEPLOY-TIMEWEB.md` (project root) and `C:\dev\knowledge\sovetydoma-deploy.md`.

Last updated: 2026-06-01.

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
| CI/CD | **GitHub Actions** → SSH deploy to VPS | See §4. |

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
→ sanity-check `out/index.html` → rsync `out/` to a new timestamped release dir on
the VPS → `/opt/deploy/activate.sh <release>` (atomic symlink swap, keeps last 5)
→ live smoke test (homepage must return 200).

- Manual run: `gh workflow run deploy.yml --repo filippmiller/sovetydoma`
- **Rollback:** `ssh -i ~/.ssh/timeweb_1001sovet root@188.225.86.238 /opt/deploy/activate.sh <older-release-dirname>`
- Also: `.github/workflows/ci.yml` (build + typecheck on PRs) and
  `telegram-notify.yml` (pings Telegram when new article .mdx land).
- Actions pinned to **v6 majors + Node 24**.
- GitHub repo secrets (set; values not shown): `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`,
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

- `UNSPLASH_ACCESS_KEY=<key> node scripts/fetch-unsplash-images.mjs`
- Downloads a relevant landscape photo per article to `public/images/<slug>.jpg`.
- **Resumable** (skips slugs that already have a file) and **rate-limit-aware**
  (Unsplash demo apps = 50 requests/hour; the script stops cleanly when the budget
  is gone — just re-run next hour). Currently **152/160** populated; re-run to fill
  the rest.
- Images are committed to git so CI ships them. `npm run audit:images -- --json`
  must report no duplicates and no missing images before deploy.
- Unsplash Access Key currently lives in chat history — recommend moving it to
  `C:\Users\filip\.secrets\` and exporting from there.

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
| Unsplash Access Key | currently in chat history — move to `.secrets` |
| reg.ru login | **not stored** — user performs registrar actions manually |

GitHub Actions secrets are set in the repo (see §4). `.env.local`, `DEPLOY-*.md`,
`*.secrets.md`, `.secrets/` are all gitignored.

## 10. Immediate next steps / open items

1. Refill the last ~8 article images (re-run the Unsplash fetcher next hour).
2. Confirm pogovorimdoma.ru DNS finished propagating, then verify the 301 over HTTPS.
3. **Rotate the Anthropic API key** (exposed in chat) and update the Supabase Vault.
4. Begin Этап 2 when ready (self-host Supabase + Timeweb S3 + GigaChat).
5. Optional: build Этап-2 only after confirming a Russian payment method for GigaChat.
