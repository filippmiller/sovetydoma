# SEO Indexing Readiness Report — 1001sovet.ru

> Date: 2026-06-06
> Scope: Google, Yandex, Bing/IndexNow, static-export Next.js site

---

## 1. What Is Already Verified

| Check | Status | Details |
|-------|--------|---------|
| robots.txt | OK | Allows Google/Yandex, points to sitemap.xml |
| Sitemap | OK | Generated for 429 articles + categories + paginated lists + archive months |
| Image sitemap | OK | `image:image` embedded in sitemap.xml for every article |
| Per-category RSS | OK | 11 feeds generated from `CATEGORIES` |
| Canonical URLs | OK | Every article has canonical `/{category}/{slug}/` |
| OG images | OK | All 429 articles have `public/images/{slug}.jpg` |
| JSON-LD | OK | Article + Breadcrumb structured data on article pages |
| Meta robots | OK | `index, follow` everywhere except admin/private areas |
| Title / description lengths | OK | Enforced by `audit-seo.mjs` |
| Legacy soft redirects | OK | Article pages handle legacy paths with canonical + meta refresh |
| Hard 301 nginx config | DOCUMENTED | See `reports/seo-redirects-nginx-2026-06.md` (must be applied on Timeweb) |

---

## 2. Files That Must Respond 200 on Production

Verify each with curl after every deploy:

```bash
curl -I https://1001sovet.ru/robots.txt
curl -I https://1001sovet.ru/sitemap.xml
curl -I https://1001sovet.ru/feed.xml
# If IndexNow is enabled:
curl -I https://1001sovet.ru/indexnow-key.txt
```

---

## 3. How to Submit to Search Engines

### Google

1. Open [Google Search Console](https://search.google.com/search-console)
2. Add property `1001sovet.ru` (Domain or URL-prefix)
3. Go to **Sitemaps** → Submit `sitemap.xml`
4. Use **URL Inspection** only for important individual URLs (new flagship articles, major updates)
5. **Do NOT use Google Indexing API** for ordinary articles — it is restricted to `JobPosting` and `BroadcastEvent`

### Yandex

1. Open [Yandex Webmaster](https://webmaster.yandex.ru)
2. Add site `1001sovet.ru`
3. Go to **Indexing → Sitemap files** → Add `https://1001sovet.ru/sitemap.xml`
4. Enable **IndexNow** (Settings → Indexing → IndexNow) and provide the key from `INDEXNOW_KEY`

### Bing

1. Open [Bing Webmaster Tools](https://www.bing.com/webmasters)
2. Add and verify site `1001sovet.ru`
3. Submit sitemap `https://1001sovet.ru/sitemap.xml`
4. Enable **IndexNow** in the dashboard (or use the API script)

---

## 4. IndexNow Automation

Scripts added:

| Script | Command |
|--------|---------|
| Dry run | `pnpm run seo:indexnow:dry` |
| Submit | `INDEXNOW_KEY=xxx pnpm run seo:indexnow [url1 url2 ...]` |

Rules:
- Only submit **new, updated, or deleted** URLs — do NOT submit the entire site on every deploy.
- The script reads article URLs from `sitemap.xml` if no CLI arguments are given.
- Key file is generated at `public/indexnow-key.txt`.

**Important:** IndexNow is a **discovery signal**, not a guarantee of indexing.

---

## 5. Metrics to Watch

| Metric | Where | Target |
|--------|-------|--------|
| Indexed pages | GSC / Yandex Webmaster / Bing WMT | Growth over time |
| Discovered – currently not indexed | GSC Coverage | Tend to 0 for important pages |
| Crawled – currently not indexed | GSC Coverage | Investigate if > 0 |
| Sitemap processed | GSC / Yandex / Bing | No errors |
| Crawl errors | GSC / Yandex / Bing | 0 critical errors |
| Page speed (Core Web Vitals) | GSC → Experience | LCP < 2.5s, CLS < 0.1, INP < 200ms |

---

## 6. Manual Actions for the Owner

1. **Timeweb nginx** — apply the 301 redirect block from `reports/seo-redirects-nginx-2026-06.md`
2. **Generate IndexNow key** — set `INDEXNOW_KEY` env var and run `node scripts/generate-indexnow-key.mjs`
3. **Google Search Console** — submit `sitemap.xml`
4. **Yandex Webmaster** — submit `sitemap.xml`, enable IndexNow
5. **Bing Webmaster** — submit `sitemap.xml`, enable IndexNow
6. **Content updates** — when an article is meaningfully updated, add `updated: YYYY-MM-DD` to frontmatter

---

## 7. lastmod / updated Hygiene

- `generate-sitemap.mjs` uses `updated || date` for `<lastmod>`.
- Do **not** mass-update `updated` on all articles.
- Only set `updated` when the content actually changed.
- `audit-seo.mjs` validates format (`YYYY-MM-DD`) and that `updated >= date`.
