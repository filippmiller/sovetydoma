# SEO manual setup results - 2026-06-06

## Done on live production

- Timeweb VPS: `1001sovet-replacement`, IP `147.45.146.11`.
- Applied nginx exact `location = ... { return 301 ...; }` redirects for the legacy URL list from `reports/seo-redirects-nginx-2026-06.md`.
- `nginx -t` passed and nginx was reloaded.
- Verified legacy redirect:
  - `https://1001sovet.ru/layfkhaki/bezopasnost-doma-dlya-rebenka/`
  - returns `301` to `https://1001sovet.ru/zdorovie-i-bezopasnost/bezopasnost-doma-dlya-rebenka/`.
- Uploaded current SEO public artifacts to `/var/www/1001sovet-current/`:
  - `sitemap.xml`
  - `feed.xml`
  - all `feed-*.xml`
  - Google verification file
  - Yandex verification file
  - `indexnow-key.txt`
- Verified live `https://1001sovet.ru/sitemap.xml` returns `200` and contains `xmlns:image`.
- Verified live `https://1001sovet.ru/indexnow-key.txt` returns `200`.

## Google Search Console

- Added URL-prefix property: `https://1001sovet.ru/`.
- Verified ownership via HTML file:
  - `google61d6f0bc4e80e6b7.html`
- Submitted sitemap:
  - `https://1001sovet.ru/sitemap.xml`
- GSC accepted the submission with "Sitemap submitted successfully".
- Immediate table state showed "Couldn't fetch"; live HTTP check shows sitemap is reachable with `200`, so this should be rechecked after Google processes it.

## Yandex Webmaster

- Added site: `https://1001sovet.ru`.
- Verified ownership via HTML file:
  - `yandex_77a69b99583f388e.html`
- Yandex access page shows user `millerfili`, role `Владелец`, method `Файл в корневом каталоге`, date `06.06.2026`.
- Submitted sitemap:
  - `https://1001sovet.ru/sitemap.xml`
- Yandex accepted it and placed it in the processing queue. UI says processing can take 1-2 weeks.

## IndexNow

- Generated a 32-character alphanumeric IndexNow key locally.
- Published it at:
  - `https://1001sovet.ru/indexnow-key.txt`
- Ran:
  - `pnpm run seo:indexnow`
- Result:
  - 429 article URLs submitted
  - 5 batches
  - all 5 batches returned `202 Accepted`

## Bing Webmaster

- Bing Webmaster login completed later in Chrome.
- Tried GSC import again:
  - Google OAuth permission for `webmasters.readonly` was granted.
  - Bing found `1` importable site: `https://1001sovet.ru/`.
  - Bing found `1` sitemap.
  - Final import failed inside Bing with "Site addition unsuccessful".
- Added `https://1001sovet.ru/` manually in Bing Webmaster.
- Bing shows the site in the list as `Not verified`.
- Added Bing verification signals:
  - live homepage meta: `<meta name="msvalidate.01" content="CDA98D825323138C1BE05C96F85052EB" />`
  - live XML file: `https://1001sovet.ru/BingSiteAuth.xml`
- Verified by HTTP that the homepage contains the `msvalidate.01` meta tag.
- Verified by HTTP that `https://1001sovet.ru/BingSiteAuth.xml` returns the expected XML.
- Bing verification attempts failed twice with "Error : Unexpected error occurred":
  - HTML Meta Tag method
  - XML File method
- Added Bing DNS verification CNAME in REG.RU DNS zone:
  - host: `9cb3bd8a5a9027d709a171c2cd633108.1001sovet.ru`
  - value: `verify.bing.com.`
  - NS for the domain are `ns1.reg.ru` and `ns2.reg.ru`, so REG.RU is the authoritative DNS control panel for this record.
- REG.RU UI shows the CNAME saved after reload.
- Immediate authoritative DNS checks initially returned NXDOMAIN:
  - `nslookup -type=CNAME 9cb3bd8a5a9027d709a171c2cd633108.1001sovet.ru ns1.reg.ru`
  - `nslookup -type=CNAME 9cb3bd8a5a9027d709a171c2cd633108.1001sovet.ru ns2.reg.ru`
  - This was REG.RU zone publication delay, not a missing panel entry.
- After waiting, both `ns1.reg.ru` and `ns2.reg.ru` returned:
  - `9cb3bd8a5a9027d709a171c2cd633108.1001sovet.ru canonical name = verify.bing.com`
- Bing CNAME verification attempt after DNS publication still displayed "Error : Unexpected error occurred" in the verify dialog.
- Closing the verify dialog showed the site dashboard normally; `Not verified` was no longer present in the page snapshot.
- Bing Sitemaps page is working:
  - known sitemaps: `1`
  - sitemap: `https://1001sovet.ru/sitemap.xml`
  - last submit: `6/6/2026`, method `Imported`
  - last crawl: `6/6/2026`
  - status: `Success`
  - URLs discovered: `469`
- Practical indexing notification for Bing is still covered by IndexNow submission, which succeeded.

## Durability notes

- The nginx redirect rules were applied directly on the VPS. Keep the nginx config backed up before future deploy/server replacement.
- The verification files should stay in `public/` and be committed/deployed, otherwise Google/Yandex ownership can be lost.
- `public/BingSiteAuth.xml` and the `msvalidate.01` meta tag in `src/app/layout.tsx` should stay in the repo until Bing verification succeeds and ideally afterwards.
- `public/indexnow-key.txt` is intentionally ignored. Future deploys must regenerate/upload it from `INDEXNOW_KEY`, or the live key file can disappear.
- The current live webroot was patched directly with SEO artifacts. A normal app deploy should still be done from the repo after the SEO branch is committed and pushed.
