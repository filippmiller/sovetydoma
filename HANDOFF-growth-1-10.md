# HANDOFF: Growth features 1–10 — `feat/growth-1-10`

## Scope decision

This branch implements the **safe, build-time features first** (no DB/worker/auth surface):

- ✅ 1 — Yandex Quick-Answer block
- ✅ 2 — Internal link mesh
- ✅ 3 — HowTo + FAQ JSON-LD coverage
- ✅ 4 — Seasonal `/sezon/{month}` pages
- ✅ 5 — Programmatic comparison pages
- ✅ 9 — Difficulty / effort / cost badges + filter

Deferred to a follow-up branch (they touch DB/RLS/workers/VK mini-app/service worker and need careful isolated review):

- ⏸ 6 — `/q/` Q&A flywheel
- ⏸ 7 — VK mini-app checklist mode
- ⏸ 8 — Favorites 2.0 named collections
- ⏸ 10 — Web Push for followed categories

*Rationale:* the integrator (Claude) explicitly suggested limiting the first batch to quick wins. DB/worker features require isolated migrations, RLS review, worker secret handling, and a deployed worker rollout; mixing them with pure build-time SEO features would make the audit and rollback harder.

## Per-feature plan (to be filled during implementation)

### Feature 1 — Yandex Quick-Answer block
- Make `ArticleQuickAnswer` render **only** when `fm.quickAnswer` is present (remove description fallback).
- Add `scripts/generate-quick-answers.mjs` to draft missing `quickAnswer` values idempotently.
- Mirror the block in `workers/renderer/src/index.ts` using `row.frontmatter.quickAnswer`.

### Feature 2 — Internal link mesh
- Add `src/lib/internal-links.ts` deterministic linker (shared tags, same category, slug overlap).
- Add `ArticleInternalLinks` server component rendered at the end of the article body.
- Document renderer feasibility in this file.

### Feature 3 — HowTo + FAQ JSON-LD coverage
- Extend `src/lib/article-schemas.ts`:
  - `buildHowToSchema`: detect numbered steps / H2s / `recipeSteps`, emit `HowTo`.
  - `buildFaqSchema`: broaden to H2/H3 questions + richer answer extraction.
- Mirror in `workers/renderer/src/jsonld.ts`.

### Feature 4 — Seasonal pages
- Add optional `seasonalMonths: number[]` to `ArticleFrontmatter`.
- Add `/sezon/[month]/page.tsx` static routes and sitemap entries.
- Add "в сезоне сейчас" badge on article pages when current month matches.
- Add `scripts/infer-seasonal-months.mjs`.

### Feature 5 — Comparison pages
- Add `/[category]/sravnenie/[a]-ili-[b]/page.tsx`.
- Generate pairs from same category + complementary tags; cap at 200.
- Metadata, JSON-LD, breadcrumb, internal links back to sources, sitemap entries.

### Feature 9 — Badges + filter
- Render `difficulty`/`time`/`cost` badges near the title (static + renderer).
- Add client-side filter controls in `CategoryArticleBrowser`.

## Gate commands

```bash
npx tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

## Report sections to be completed

- Per-feature: files touched, key decisions, how to test.
- Self code-review table (P0–P3).
- Gate results.
- New migrations list (none for this batch).
- Secrets/manual steps before deploy (none for this batch).
- Deferred features with reasons.
