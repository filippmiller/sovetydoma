# Image Quality And Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove repeated article images, prevent the fetcher from creating new duplicates, add aggregate article view counts, deploy, and verify production.

**Architecture:** Image quality is handled by local scripts: one audit script reports exact duplicates, missing images, and orphans; the Unsplash fetcher uses article-specific queries and rejects already-used photo IDs and file hashes. Article views reuse the existing Supabase `feedback_events`/`feedback_counters` path with `kind='view'`, so the static export remains deployable without adding API routes.

**Tech Stack:** Next.js static export, React client components, Supabase JS client, Node scripts, Node built-in test runner, Pillow for local image hash checks during manual review.

---

### Task 1: Image Audit Utilities

**Files:**
- Create: `scripts/image-audit-utils.mjs`
- Create: `scripts/audit-article-images.mjs`
- Create: `scripts/__tests__/image-audit-utils.test.mjs`

- [ ] Write failing tests for exact duplicate grouping, missing images, and orphan image detection.
- [ ] Implement reusable image audit helpers.
- [ ] Add a CLI script that prints JSON/text reports and exits non-zero when `--fail-on-duplicates` is passed and exact duplicates exist.
- [ ] Run `node --test scripts/__tests__/image-audit-utils.test.mjs`.

### Task 2: Duplicate-Safe Unsplash Fetcher

**Files:**
- Modify: `scripts/fetch-unsplash-images.mjs`
- Test: `scripts/__tests__/image-audit-utils.test.mjs`

- [ ] Write failing tests for article-specific query construction and unique Unsplash result selection.
- [ ] Change the fetcher to request multiple search results per article and choose an unused photo ID.
- [ ] Store source metadata in `public/images/.sources.json`.
- [ ] Add `--replace-duplicates` so duplicated local files can be regenerated while unique files are skipped.
- [ ] Run the image audit and fetcher with the available Unsplash budget.

### Task 3: Remove Existing Repeated Images

**Files:**
- Modify/delete: `public/images/*.jpg`
- Create/modify: `public/images/.sources.json`

- [ ] Run the audit and identify exact duplicate groups.
- [ ] Keep one suitable representative only when it is clearly related.
- [ ] Delete duplicate copies that cannot be replaced immediately; the UI already falls back to category emoji on 404.
- [ ] Fetch unique replacements for as many missing/duplicate images as the rate budget allows.
- [ ] Re-run the audit and ensure exact duplicate groups are gone.

### Task 4: Aggregate View Counts

**Files:**
- Create: `src/lib/view-counts.js`
- Create: `src/lib/view-counts.test.mjs`
- Modify: `src/components/ViewTracker.tsx`
- Modify: `src/components/PopularArticles.tsx`
- Modify: `src/components/ArticleCard.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/[category]/page.tsx`

- [ ] Write failing tests for once-per-day storage keys, count extraction, and article sorting by views.
- [ ] Update `ViewTracker` to record `kind='view'` after a short dwell time and only once per day per visitor/article.
- [ ] Add a visible article view badge when aggregate counts are available.
- [ ] Update `PopularArticles` to load public aggregate counts from `feedback_counters` and sort by real views, falling back to newest articles.

### Task 5: Verification And Deploy

**Files:**
- Modify generated indexes/RSS/sitemap only through `pnpm run build`.

- [ ] Run targeted Node tests.
- [ ] Run `pnpm exec tsc --noEmit`.
- [ ] Run `pnpm run build`.
- [ ] Commit only the intended files, excluding unrelated invalid untracked article drafts.
- [ ] Push to `master`.
- [ ] Verify GitHub Actions deploy succeeds.
- [ ] Verify production: homepage loads, no exact duplicate committed images remain, one article records/loads view-count UI gracefully, and image 404 fallback works for deleted duplicates.
