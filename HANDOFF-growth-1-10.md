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

*Rationale:* the integrator explicitly suggested limiting the first batch to quick wins. DB/worker features require isolated migrations, RLS review, worker secret handling, and a deployed worker rollout; mixing them with pure build-time SEO features would make the audit and rollback harder.

## Per-feature deliverables

### Feature 1 — Yandex Quick-Answer block

**What changed**
- `src/components/ArticleQuickAnswer.tsx` now renders **only** when `fm.quickAnswer` is present. The previous description-fallback was removed so the block matches the explicit "render only when present" requirement.
- `scripts/generate-quick-answers.mjs` drafts missing `quickAnswer` values (40–60 words) from the first paragraphs of the body/description. It is idempotent and defaults to dry-run; add `--apply` to write.
- `workers/renderer/src/index.ts` mirrors the behaviour:
  - reads `row.frontmatter.quickAnswer` and builds a matching «Краткий ответ» block with time/difficulty/needs/forWhom metadata;
  - removes the aside entirely when no `quickAnswer` is present, so stale template data never leaks.
- Renderer cache version bumped from `4` → `5`.

**Files touched**
- `src/components/ArticleQuickAnswer.tsx`
- `src/app/[category]/[slug]/page.tsx` (comment + component placement)
- `scripts/generate-quick-answers.mjs` (new)
- `workers/renderer/src/index.ts`

**How to test**
```bash
npx tsc --noEmit
pnpm test
pnpm build
# Inspect a static article that has quickAnswer in frontmatter
curl -s http://localhost:3000/{category}/{slug}/ | grep -i "Краткий ответ"
```
Renderer path: `pnpm --filter sovetydoma-renderer typecheck` and a manual request through the worker after deploy.

**Renderer covered?** Yes.

---

### Feature 2 — Internal link mesh

**What changed**
- `src/lib/internal-links.mjs` exposes `findInternalLinks(source, allArticles, limit=4)`.
  - Scores by shared tags (+3 each), title/slug word overlap (+1 each), and same category (+1 tiebreaker).
  - Requires at least one semantic overlap (shared tag or word overlap); category alone is not enough.
  - Self-links and duplicates excluded.
- `src/components/ArticleInternalLinks.tsx` is a server component rendered after the tags list on every article page.
- `src/lib/internal-links.test.mjs` covers self-exclusion, tag preference, and empty results.

**Files touched**
- `src/lib/internal-links.mjs` (new)
- `src/lib/internal-links.test.mjs` (new)
- `src/components/ArticleInternalLinks.tsx` (new)
- `src/app/[category]/[slug]/page.tsx`

**How to test**
```bash
pnpm test
# After build, open any article and scroll to "🔗 Читайте также"
```

**Renderer covered?** Not implemented in the renderer. The renderer only serves dynamic articles from `content_matrix` and has no fast index of the whole corpus. Options documented for the integrator:
1. Add a `related_slugs` JSONB column to `content_matrix` and populate it at publish time.
2. Add a Supabase RPC that reimplements `findInternalLinks` in SQL.
3. Accept that dynamic articles (a minority) omit the mesh until folded into static.

---

### Feature 3 — HowTo + FAQ JSON-LD coverage

**What changed**
- `src/lib/article-schemas.ts`:
  - `buildFaqSchema` now scans H2/H3 headings ending with `?` and extracts richer plain-text answers from the following paragraphs.
  - `buildAdditionalSchema` now returns an array of schemas and auto-emits:
    - `Recipe` when `schemaType === 'Recipe'` (also adds `recipeInstructions`);
    - `HowTo` when `schemaType === 'HowTo'` or when the body has ≥3 H2 headings / numbered steps / `recipeSteps`;
    - `FAQPage` when ≥2 question headings are found.
  - Added `totalTime` to HowTo when `time` can be parsed.
- `src/app/[category]/[slug]/page.tsx` now iterates over the array returned by `buildAdditionalSchema` and no longer calls `buildFaqSchema` separately, avoiding duplication.
- `workers/renderer/src/jsonld.ts` mirrors the same Recipe/HowTo/FAQ logic; `workers/renderer/src/index.ts` injects all extra schemas as separate `<script type="application/ld+json">` tags.

**Files touched**
- `src/lib/article-schemas.ts`
- `src/app/[category]/[slug]/page.tsx`
- `workers/renderer/src/jsonld.ts`
- `workers/renderer/src/index.ts`

**How to test**
```bash
pnpm test
pnpm build
# Inspect page source of a procedural article — look for @type: HowTo and @type: FAQPage
```

**Renderer covered?** Yes.

---

### Feature 4 — Seasonal `/sezon/{month}` pages

**What changed**
- Added optional `seasonalMonths: number[]` to `ArticleFrontmatter` in `src/lib/articles.ts`.
- `src/app/sezon/[month]/page.tsx` generates 12 month indexes (`/sezon/1` … `/sezon/12`) listing matching articles with metadata + breadcrumb JSON-LD.
- `src/components/ArticleSeasonalBadge.tsx` client-only badge appears on articles whose `seasonalMonths` contains the current month.
- `scripts/infer-seasonal-months.mjs` infers months from tags/title keywords (winter/ spring/ summer/ autumn + month names), dry-run by default.
- `scripts/generate-sitemap.mjs` now emits `/sezon/{month}/` URLs.

**Files touched**
- `src/lib/articles.ts`
- `src/app/sezon/[month]/page.tsx` (new)
- `src/components/ArticleSeasonalBadge.tsx` (new)
- `src/app/[category]/[slug]/page.tsx`
- `scripts/infer-seasonal-months.mjs` (new)
- `scripts/generate-sitemap.mjs`

**How to test**
```bash
pnpm build
ls out/sezon/1/index.html
# Add seasonalMonths: [6] to an article frontmatter, rebuild, check the badge appears in June
```

**Renderer covered?** Not explicitly. Dynamic articles already carry `frontmatter.seasonalMonths`; the badge is client-side and will work if the renderer injects the data attribute. A follow-up should add the `seasonalMonths` value to the rendered HTML or document that dynamic articles rely on the static rebuild path for the badge.

---

### Feature 5 — Programmatic comparison pages

**What changed**
- `src/lib/comparison-pairs.mjs` exposes `generateComparisonPairs(articles, maxTotal=200, maxPerCategory=20)`.
  - Same-category pairs only.
  - Requires shared tags AND complementary (different) tags.
  - Deterministic scoring + slug tie-breaking.
- `src/lib/comparison-pairs.test.mjs` covers empty results, valid pairs, identical-tag rejection, and cap.
- `src/app/[category]/sravnenie/[pair]/page.tsx` generates `/[category]/sravnenie/[a]-ili-[b]/` pages with metadata, Article + BreadcrumbList JSON-LD, and links back to both sources.
- `scripts/generate-sitemap.mjs` includes all generated comparison URLs.
- Build log shows `generated 197 pairs (cap 200)`.

**Files touched**
- `src/lib/comparison-pairs.mjs` (new)
- `src/lib/comparison-pairs.test.mjs` (new)
- `src/app/[category]/sravnenie/[pair]/page.tsx` (new)
- `scripts/generate-sitemap.mjs`

**How to test**
```bash
pnpm test
pnpm build
ls out/*/sravnenie/*-ili-*/index.html | head
```

**Renderer covered?** No. These are pure static pages; the renderer only handles missing article routes. No DB table needed.

---

### Feature 9 — Difficulty / effort / cost badges + filter

**What changed**
- `src/components/ArticleMetaBadges.tsx` renders `difficulty` (stars), `time`, and `cost` badges under the article title.
- `src/lib/article-filters.mjs` parses human-readable `time`/`cost` strings and exposes `matchesDifficulty`, `matchesTime`, `matchesCost`.
- `src/lib/article-filters.test.mjs` covers parsing and filter matching.
- `src/components/CategoryArticleBrowser.tsx` adds three `<select>` filters (difficulty, time, cost) with client-side filtering.
- `workers/renderer/src/index.ts` updates `.article-meta-badges` from `frontmatter.difficulty/time/cost`.

**Files touched**
- `src/components/ArticleMetaBadges.tsx` (new)
- `src/lib/article-filters.mjs` (new)
- `src/lib/article-filters.test.mjs` (new)
- `src/components/CategoryArticleBrowser.tsx`
- `src/app/[category]/[slug]/page.tsx`
- `workers/renderer/src/index.ts`

**How to test**
```bash
pnpm test
pnpm build
# Open a category page, use the filter bar
# Open an article with difficulty/time/cost frontmatter, verify badges
```

**Renderer covered?** Yes.

---

## Self code-review (P0–P3)

| # | Feature | Severity | Finding | Fix |
|---|---------|----------|---------|-----|
| 1 | F1 | P1 | `ArticleQuickAnswer` originally fell back to description, contradicting "render only when present". | Removed fallback; block now renders only for explicit `quickAnswer`. |
| 2 | F9 | P1 | `parseCostRubles` used `includes('0 ₽')` which matched `'300 ₽'`, misclassifying costs as free. | Removed substring checks; rely on extracted numeric value === 0. |
| 3 | F2 | P1 | `findInternalLinks` initially scored same-category articles with no tag/title overlap, producing irrelevant links. | Added `hasSemanticOverlap` guard requiring shared tag or word overlap. |
| 4 | F4 | P1 | `scripts/infer-seasonal-months.mjs` contained TypeScript type annotations, causing Node parse error. | Removed annotations; file is plain `.mjs`. |
| 5 | F4 | P2 | `ArticleSeasonalBadge` used `setState` directly inside `useEffect`, violating the project's React hooks lint rule. | Added `eslint-disable-next-line` with explicit client-only/hydration-mismatch justification. |
| 6 | F9 | P2 | `CategoryArticleBrowser` imported TypeScript types from a module that had to be `.mjs` for Node tests. | Converted `article-filters` to `.mjs` and dropped type imports in the client component. |
| 7 | all | P3 | New utility modules shipped without tests. | Added `internal-links.test.mjs`, `article-filters.test.mjs`, `comparison-pairs.test.mjs`. |
| 8 | F1/F3/F9 | P3 | `src/app/[category]/[slug]/page.tsx` comment still described the old fallback behaviour. | Updated comment. |

**Result:** all P0–P3 findings above are fixed. No remaining P0/P1 issues are known.

---

## Gate results

```bash
npx tsc --noEmit
# ✅ no errors

pnpm lint
# ✅ 0 errors (18 pre-existing warnings in renderer/matrix scripts)

pnpm test
# ✅ 47/47 Node tests, 2 photo-worker tests, 48 subscriptions tests, SEO audit passed

pnpm build
# ✅ Generated 1745 static pages, 197 comparison pairs, 12 seasonal month pages
#    Sitemap: 739 URLs
```

Renderer typecheck:

```bash
cd workers/renderer && pnpm typecheck
# ✅ tsc --noEmit passes
```

---

## New migrations

None for this batch (no DB changes).

## Secrets / manual steps before deploy

- No new secrets.
- Optional: run `node scripts/generate-quick-answers.mjs --apply` to populate `quickAnswer` for articles missing it.
- Optional: run `node scripts/infer-seasonal-months.mjs --apply` to backfill `seasonalMonths`.
- After deploy, bump `RENDER_VERSION` in `workers/renderer/src/index.ts` if the worker is not redeployed automatically with the site build.

---

## Left for the integrator

- **Features 6, 7, 8, 10** are intentionally out of scope on this branch. They each need:
  - one Supabase migration with default-deny RLS;
  - worker endpoint(s) with the existing rate-limit trigger pattern;
  - secrets (Turnstile for F6, VAPID keys for F10);
  - UI/admin/VK mini-app changes.
- **Renderer internal-link mesh** is documented but not implemented; decide whether to add a `related_slugs` column or SQL RPC.
- **Renderer seasonal badge** currently relies on static build; dynamic articles may need the month badge injected by the worker if you want it there immediately.
- The branch contains generated `public/sitemap.xml` / RSS feeds updated by the build. If you prefer not to commit generated artifacts, reset those files before merge.

---

## Branch

`feat/growth-1-10` off `master`.
