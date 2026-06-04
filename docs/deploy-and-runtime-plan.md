# Deploy model + runtime-publishing plan (post-2026-06-04 incident)

## Incident summary (2026-06-04)
Publishing 100 articles took 1001sovet.ru down intermittently. **Root cause was the deploy model, not the content:**
- The VPS ran `pnpm install && next build` **on the production box** on every master change (`/opt/deploy/pull-build-deploy.sh`, triggered by `1001sovet-pull-deploy.timer` every minute, build-on-change).
- Each build saturated CPU/IO for ~3 min → nginx/SSH unreachable *during the build* (the ERR_FAILED windows). No swap was configured (extra fragility). No OOM, no fail2ban — confirmed via logs.
- "Atomic symlink swap" protected against half-built dirs, but **NOT against the build process itself starving the box**. That was the wrong assumption.

## Phase 1 — fixed deploy model (DONE)
**CI builds, VPS only swaps. The VPS never builds again.**
- `.github/workflows/deploy.yml`: on push to master → install, typecheck, tests, `audit:images`, `next build` → force-push prebuilt `out/` to the **`dist` branch** (+ `out/build.json` with the source sha).
- `deploy/pull-deploy.sh` (installed at `/opt/deploy/pull-build-deploy.sh`): fetch `dist` (cheap, shallow), if sha changed copy to `releases/rel-<sha>-<ts>`, run `activate.sh` (atomic symlink swap, keeps last 5), **post-swap healthcheck** (`curl localhost`), **rollback to previous release on non-200**. `flock` single-flight.
- Timer re-enabled — now a cheap `git fetch dist` + swap-on-change (~8s CPU, load ~0.2). No `pnpm`/`next build` on prod.
- 4 GB swap added as a safety net.
- Verified: deploy of 429 articles took **8.5s CPU**, healthcheck 200, new articles live.

**Operational notes:**
- VPS is reachable over **IPv6** (`2a03:6f01:1:2::2:15e5`) even when the IPv4 path is flaky: `ssh -i ~/.ssh/timeweb_1001sovet -6 root@2a03:6f01:1:2::2:15e5`.
- Rollback manually: `ssh … 'ls -t /var/www/1001sovet-releases/ | sed -n 2p | xargs -I{} /opt/deploy/activate.sh {}'`.
- Old build-on-prod script backed up at `/opt/deploy/pull-build-deploy.sh.bak-buildmodel`.

## Phase 2 — re-publish the 100 (DONE)
Reverted the emergency revert, pushed, CI built dist (429), VPS auto-swapped in ~8s. Matrix rows synced to `published`. Site live with 429 articles, no thrash.

## Phase 3 — runtime publishing (NEXT, the real goal: no rebuild per article)
Even with Phase 1, adding an article still triggers a full static rebuild in CI (fine at hundreds, wasteful at 5k–50k, and new articles wait for CI). Target: **publish = a DB status flip, article appears with no git commit and no rebuild.**

**Design:**
- Switch article pages from static export (`output: 'export'`) to **Next.js with ISR** (or SSR) running as a Node server (standalone) behind nginx (or move to Vercel which does ISR natively).
- Article routes read **published rows from `content_matrix`** (Supabase) at request time:
  - `generateStaticParams` (optional) seeds popular pages; others render on-demand.
  - `revalidate` (e.g. 60–300s) or **on-demand revalidation** (a webhook the publish step calls) so a new `text_status='published'` row appears within seconds.
- Publishing becomes: `UPDATE content_matrix SET text_status='published', published_at=now() WHERE …` → done. No MDX export, no git, no build.
- **Images** move to object storage / CDN (Timeweb S3 or Cloudflare R2) referenced by `image_url`; stop committing JPEGs to git (repo bloat). Build-time prefetch only for any remaining static pages.
- **sitemap.xml / RSS** generated dynamically (route handlers reading the matrix) or via a scheduled cache refresh, not per-build.
- Keep static export as an optional **fallback/snapshot** (disaster recovery / CDN origin), regenerated on a schedule rather than per-article.

**Migration steps (incremental, low-risk):**
1. Stand up the Next standalone server on the VPS (or a Vercel project) reading the matrix for ONE route (`/[category]/[slug]`) with ISR, behind nginx at a test path.
2. Backfill: ensure all 429 published rows have complete `body_md` + `frontmatter` + `image_url` in the matrix (already true for the matrix-origin ones; seed-origin ones have body_md).
3. Cut the article route over to runtime; keep the rest static.
4. Move images to R2/S3; set `image_url`.
5. Dynamic sitemap/RSS.
6. Decommission the per-article static rebuild; static export becomes a scheduled snapshot only.

**Net end-state:** the content-matrix factory writes rows; flipping `published` makes them live instantly; the VPS never builds; scales to 50k.
