# Full UI/UX/E2E Action Plan

## Done In This Pass

1. Fix catalog preview image resolver to prefer generated slug previews for local/static images.
2. Make `/search/?q=...` show useful results from static HTML with an inline bootstrap, even when React hydration is delayed.
3. Preserve Enter-submit behavior on the search page by wrapping the input in a GET form.
4. Verify anonymous public routes in the in-app browser.
5. Run TypeScript, ESLint, unit tests, SEO audit, image audit, and production build.

## A. Critical Functional Bugs

- Issue: search query URL could show browse state. Evidence: local browser rendered `/search/?q=...` with empty input before fix. Severity: high. Fix: static fallback renderer plus URL query initialization. Risk: low. Impact: direct SEO/user query links become useful.

## B. Cross-Role Visibility/Persistence Bugs

- Blocked: requires staging users for user/moderator/admin checks. Risk of testing on production is unacceptable without explicit approval.

## C. Storage/Image/Upload Bugs

- Issue: catalog cards requested stale preview filenames. Evidence: dev server logged repeated 404s for `/images/previews/bliny.jpg`, `/images/previews/ogurcy.jpg`, etc. Severity: high. Fix: slug-preview resolver. Risk: low. Impact: fewer broken images and less network waste.

## D. Auth/Session/Permission Bugs

- Not fully tested. Admin code uses Supabase session plus `profiles.role = admin`; staging credentials are needed to validate redirects and role denial.

## E. UI Clarity Improvements

- Done: search route now shows actual result cards for query URLs.

## F. Visual Design Modernization

- Keep current compact cards. Next owner decision: reduce homepage catalog density with pagination/load-more.

## G. Onboarding Improvements

- Owner decision: authenticated empty states should be checked with staging users and then improved if needed.

## H. Performance/Resource Improvements

- Done: removed avoidable preview 404s. Recommended next: reduce initial 180-card homepage payload.

## I. Accessibility Improvements

- Recommended next: authenticated modal and form label pass under staging.

## J. Owner Decisions

- Provide staging credentials or approve controlled disposable production accounts.
- Decide whether homepage should show all 180 articles or a paginated/load-more catalog.

## Next With Staging Credentials

1. Create disposable users for user/moderator/admin roles.
2. Test sign-up, sign-in, sign-out, saved articles, cabinet, user article submission, comments, ratings, likes, question flow, photo upload, and admin moderation.
3. Verify data isolation and cleanup all seeded rows.
4. Run Lighthouse desktop/mobile on home, article, search, and contact.
5. Add Playwright E2E tests for search, auth modal, saved article, rating/reaction, and contact form failure/success states.
