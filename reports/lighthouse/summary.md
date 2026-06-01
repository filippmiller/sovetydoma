# Lighthouse Summary

Generated 2026-06-01 against local dev at http://127.0.0.1:3000. Lighthouse emitted JSON but exited non-zero due Chrome temp-profile cleanup EPERM on Windows; output files were still written and parsed.

| Report | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | Speed Index | KB | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| article-desktop | 96 | 91 | 96 | 100 | 569ms | 1332ms | 0ms | 0.005 | 1169ms | 1048 | 31 |
| article-mobile | 49 | 91 | 96 | 100 | 3099ms | 7919ms | 600ms | 0 | 6463ms | 1048 | 31 |
| contact-desktop | 97 | 91 | 96 | 100 | 575ms | 1184ms | 0ms | 0.001 | 575ms | 996 | 31 |
| home-desktop | 93 | 96 | 96 | 100 | 691ms | 1655ms | 0ms | 0.018 | 842ms | 3156 | 211 |
| home-mobile | 56 | 96 | 96 | 100 | 3608ms | 14701ms | 256ms | 0 | 6963ms | 3157 | 211 |
| search-desktop | 97 | 94 | 96 | 63 | 615ms | 1261ms | 0ms | 0.001 | 660ms | 1047 | 31 |

## Key Finding

Desktop is healthy. Mobile home and article are not: home mobile performance is 56 with LCP 14701ms and 211 requests; article mobile performance is 49 with LCP 7919ms and 600ms TBT.
