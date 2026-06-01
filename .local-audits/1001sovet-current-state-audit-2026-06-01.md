# 1001sovet Current State Audit

Date: 2026-06-01
Branch: `audit/full-ui-ux-e2e-browser-pass`
HEAD at audit start: `7a2024a`

## Executive Summary: YELLOW

The public static site is live and the local repo is substantially healthier than the stale critique suggests: 180 articles, 180 images, 180 unique images, no exact image duplicates, no missing images, and no untracked article drafts. The remaining production blockers are real but narrower: auth email confirmation is blocked by Supabase email delivery/rate-limit configuration, anonymous view tracking cannot write through current RLS, mobile performance is weak, and secondary-domain HTTPS is still not valid.

## What Works

- `npm test`: passed, including SEO audit for 180 articles.
- `npm run audit:images -- --json`: 180 articles, 180 images, 180 unique, 0 exact duplicate groups, 0 missing, 0 orphan images.
- `pnpm exec tsc --noEmit`: passed.
- `https://1001sovet.ru/`: 200.
- `https://1001sovet.ru/sitemap.xml`: 200.
- `https://1001sovet.ru/feed.xml`: 200.
- `https://1001sovet.ru/dacha-i-ogorod/borba-s-oduvanchikami/`: 200.
- GitHub Actions on `master`: latest CI and Deploy successful for SHA `4789ed830821b57b651ee6465541d192e1d59203`.

## What Is Not Proven Or Broken

- Auth signup email delivery is not working for QA: accepted signup creates an unconfirmed user/profile, login fails with `Email not confirmed`, Gmail search found no confirmation email, and a later real email attempt hit `email rate limit exceeded`.
- Anonymous view tracking is broken in production: direct anon insert into `feedback_events` with `kind='view'` is rejected by RLS.
- `pogovorimdoma.ru` HTTPS fails certificate validation (`SEC_E_WRONG_PRINCIPAL`).
- No deployed SHA endpoint existed before this repair pass; deploy proof relied on workflow SHA and live content.
- Six articles are under 250 words.
- Home mobile Lighthouse remains weak from prior run: performance 56, LCP 14701ms, 211 requests, about 3157 KB transfer.

## Git Evidence

- Branch: `audit/full-ui-ux-e2e-browser-pass`
- Recent commits: `7a2024a`, `828b232`, `885ed78`, `4540e59`, `4789ed8`
- Remote: `git@github.com:filippmiller/sovetydoma.git`
- Generated tracked files include `public/sitemap.xml`, `public/feed*.xml`, `public/turbo.xml`, `public/zen.xml`, `src/lib/article-index.json`, `src/lib/questions-index.json`.

## Content Statistics

- Total MDX articles: 180.
- Git tracked MDX articles: 180.
- Untracked MDX articles: 0.
- Categories: `dacha-i-ogorod` 62, `kulinaria` 38, `dom-i-uborka` 35, `layfkhaki` 24, `ekonomiya` 20, `rybalka` 1.
- Duplicate slugs: 0.
- Duplicate titles: 0.
- Slug/category Cyrillic contamination found in current tree: 0.
- Under-250-word articles: 6 (`domashniy-mayonez-bystro`, `grechka-po-kupecheski`, `lovlya-karasya`, `plov-iz-svininy`, `syrniki-iz-tvoroga`, `tushenaya-kapusta`).

## Image Statistics

- Article slugs: 180.
- Article image files: 180.
- Unique image hashes: 180.
- Exact duplicate groups: 0.
- Missing images: 0.
- Orphan images: 0.
- Largest images are still relatively heavy; top examples include `ekonomiya-vody.jpg` 339 KB and `kogda-sazhat-pomidory-2026.jpg` 326 KB.

## Supabase Evidence

Public anon counts after QA attempt:

| Table | Count |
| --- | ---: |
| `profiles` | 1 |
| `saved_articles` | 0 |
| `ratings` | 0 |
| `reactions` | 0 |
| `comments` | 0 |
| `photos` | 0 |
| `user_articles` | 0 |
| `questions` | 1 |
| `feedback_events` | 0 |
| `feedback_counters` | 0 |

The one profile is the QA user created during approved testing and should be cleaned up later:
`d6eb17b9-01d7-42df-950a-d74a66a2d592`.

## Live URL Evidence

- `http://1001sovet.ru/` redirects to `https://1001sovet.ru/`.
- `https://1001sovet.ru/` returns 200.
- `https://1001sovet.ru/sitemap.xml` returns 200.
- `https://1001sovet.ru/feed.xml` returns 200.
- `https://pogovorimdoma.ru/` fails certificate validation.

## Secrets Hygiene

Targeted tracked-file scans for common secret markers did not print any secret values. No tracked `SUPABASE_SERVICE_ROLE_KEY` was found. Old chat exposure of Anthropic/Unsplash keys still means those keys should be rotated outside this repo before serious public production.

## P0 Blockers

1. Auth email confirmation delivery/rate limit.
2. Anonymous view tracking RLS/write path.
3. Secondary-domain HTTPS certificate.

## P1 Fixes

1. Configure Supabase custom SMTP or disable confirmation for this pre-launch app.
2. Deploy worker `/view` endpoint with `SUPABASE_SERVICE_ROLE_KEY` secret and verify before/after counters.
3. Add live build metadata and stronger deploy smoke checks.
4. Fix six short articles or raise validation threshold.

## Recommended Next PRs

1. Auth email repair and confirmation UX.
2. View counter worker deployment and Supabase service-role configuration.
3. Deploy health/build metadata and stronger smoke checks.
4. Homepage performance: reduce initial 180-card payload.
5. Secondary-domain TLS/canonical cleanup.
