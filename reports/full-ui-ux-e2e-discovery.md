# Full UI/UX/E2E Discovery

Date: 2026-06-01
Branch: `audit/full-ui-ux-e2e-browser-pass`
Local target: `http://127.0.0.1:3000`
Production reference: `https://1001sovet.ru`

## App Shape

- Framework: Next.js 16 static export with App Router.
- Content: 180 MDX articles, 6 sections, generated sitemap/RSS/Turbo/Zen feeds.
- Runtime integrations: Supabase auth/data, Yandex Metrika, contact/photo worker endpoint, service worker.
- Public routes audited: `/`, `/search/`, article pages, category pages, `/contact/`, `/about/`, `/recepty/`, `/izbrannoe/`, `/moy-kabinet/`, `/napisat/`.
- Admin routes discovered: `/admin/`, `/admin/login/`, `/admin/articles/`, `/admin/photos/`.

## Interactive Surfaces

- Search: homepage instant search plus `/search/?q=...` result page.
- Article engagement: view counter, reactions, star rating, comments, related content, share panel.
- Auth flows: modal sign in/sign up, saved articles, personal cabinet, user article submission.
- Admin flows: Supabase session plus `profiles.role = admin` gate.
- Contact developer: worker-backed form with challenge token, honeypot field, direct email fallback.

## Data Tables And Storage In Code

- `profiles`: user role/display profile data.
- `saved_articles`: favorites/bookmarks.
- `ratings`: article star ratings.
- `reactions`: article emoji/like reactions.
- `comments`: article comments with optional photo path.
- `photos`: uploaded result photos and moderation status.
- `user_articles`: user-submitted article drafts.
- `questions`: question/answer flow.
- `feedback_events` and `feedback_counters`: views and practical feedback aggregates.
- Storage/upload path: photo worker / R2 style upload helpers in `src/lib/photos.ts`.

## Constraints

- The attached prompt assumes a staging/testing app and permission to create test users/data.
- The available site target is production-live. I did not create accounts, comments, uploads, ratings, admin records, or other production data.
- Full authenticated cross-role testing needs a staging Supabase project or explicit approval for disposable production test accounts.

## First Findings

- Homepage cards were requesting many missing preview URLs based on old frontmatter image names, for example `/images/previews/bliny.jpg`, while generated previews are slug-based.
- `/search/?q=как избавится от одуванчиков` could render the browse state if client hydration did not run promptly, despite the query being present in the URL.
- Existing `npm test`, SEO audit, and image audit surfaces are useful and should remain part of the release gate.

## Screenshot Note

The browser screenshot API repeatedly timed out during capture, so screenshots were not embedded in this report. Browser DOM and visual-state checks were still performed through the in-app browser.
