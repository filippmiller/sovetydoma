# Performance, Resource, And Energy Audit Before

## Method

Lighthouse was run against local dev routes on 2026-06-01. Lighthouse wrote valid JSON but exited non-zero because Chrome could not delete its temporary profile directory on Windows (`EPERM`). The JSON outputs were parsed into `reports/lighthouse/summary.json` and `reports/lighthouse/summary.md`.

## Lighthouse Scores

| Report | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | Speed Index | KB | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| article-desktop | 96 | 91 | 96 | 100 | 569ms | 1332ms | 0ms | 0.005 | 1169ms | 1048 | 31 |
| article-mobile | 49 | 91 | 96 | 100 | 3099ms | 7919ms | 600ms | 0 | 6463ms | 1048 | 31 |
| contact-desktop | 97 | 91 | 96 | 100 | 575ms | 1184ms | 0ms | 0.001 | 575ms | 996 | 31 |
| home-desktop | 93 | 96 | 96 | 100 | 691ms | 1655ms | 0ms | 0.018 | 842ms | 3156 | 211 |
| home-mobile | 56 | 96 | 96 | 100 | 3608ms | 14701ms | 256ms | 0 | 6963ms | 3157 | 211 |
| search-desktop | 97 | 94 | 96 | 63 | 615ms | 1261ms | 0ms | 0.001 | 660ms | 1047 | 31 |

## Observations

- Before the thumbnail fix, the dev server log showed repeated 404s for catalog preview images such as `/images/previews/bliny.jpg`, `/images/previews/ogurcy.jpg`, and `/images/previews/ekonomiya.jpg`.
- Those 404s add avoidable network requests, server work, console noise, and delayed visual fallback.
- The homepage includes 180 article cards/images in the initial DOM. Lighthouse confirms this is the biggest resource problem: 211 requests and about 3.1 MB transfer.
- Desktop scores are good, but mobile scores are not acceptable for a content site: home mobile performance 56 with 14.7s LCP; article mobile performance 49 with 7.9s LCP and 600ms TBT.
- Static generation completed successfully: 623 static pages generated.

## Risk Areas

- Large homepage payload from rendering the full catalog.
- Third-party font CSS and metrics scripts can affect first paint.
- Supabase aggregate calls on the full catalog can become expensive as article count grows.

## Recommended Follow-Up

- Add pagination or "load more" for the homepage catalog. This is the top performance fix.
- Keep slug preview images small and cacheable.
- Consider precomputed public stats JSON if Supabase aggregate calls become slow.
