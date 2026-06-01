# Auth And View Repair Verification

Date: 2026-06-01

## Commands Run

- `npm test`: passed.
- `npm run audit:images -- --json`: passed, 180/180 unique images.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm exec eslint "src/app/[category]/[slug]/page.tsx" src/components/ArticleImage.tsx src/components/ViewTracker.tsx src/components/auth/AuthModal.tsx workers/photo-upload/src/index.ts scripts/generate-build-metadata.mjs`: passed.
- `pnpm run build`: passed, 623 static pages generated.
- In-app browser local article verification: `/dacha-i-ogorod/borba-s-oduvanchikami/` rendered the article image from `/images/borba-s-oduvanchikami.jpg` with the correct alt text.

## Auth Verification

- `filippmiller@gmail.com` signup attempt returned `email rate limit exceeded`, so no email was sent from that attempt.
- Code-side UX improvements were implemented, but production auth still requires Supabase dashboard/email-provider repair.

## View Verification

- Before repair, anonymous direct Supabase insert into `feedback_events` failed with RLS violation.
- Repo-side repair routes anonymous view ingestion through the Worker `/view` endpoint and service-role secret.
- Full live before/after counter verification is blocked until the Worker is deployed with `SUPABASE_SERVICE_ROLE_KEY`.

## Deploy Verification Gap Closed In Repo

- Added `public/build.json` generation during build.
- Article pages now render a bounded visible article image, not only SEO metadata.
- Shared article images now lazy-load by default on cards; the article hero image loads eagerly.
- Deploy smoke now checks:
  - HTTPS homepage 200 and content marker.
  - HTTP to HTTPS redirect.
  - Article page content.
  - Preview image.
  - Sitemap.
  - RSS.
  - Live `build.json` contains the deployed `GITHUB_SHA`.

## Remaining Owner Actions

1. Configure Supabase Auth email delivery/custom SMTP or disable confirmation for QA.
2. Confirm/delete QA user `d6eb17b9-01d7-42df-950a-d74a66a2d592`.
3. Add Cloudflare Worker secret `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy the worker.
5. Push/merge to `master` and verify live `build.json` SHA plus `/view` counter increment.
