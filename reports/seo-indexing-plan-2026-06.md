# SEO Indexing Plan — lastmod / updated Hygiene

> Date: 2026-06-06
> Project: 1001sovet.ru

## Rule: `updated` Frontmatter Field

### When to use

Add `updated: YYYY-MM-DD` to an article's frontmatter **only when the content was meaningfully changed**:

- Facts, instructions, or recommendations were revised.
- New sections were added.
- Broken links were fixed with new targets.
- Images were replaced or added.

### When NOT to use

- Do **not** mass-update `updated` on all articles.
- Do **not** change `updated` for trivial fixes (typos, formatting).
- Do **not** set `updated` to the current date just to "refresh" the article in search engines.

### Format

```yaml
---
date: 2026-05-15
updated: 2026-06-03
title: "..."
---
```

- Must be `YYYY-MM-DD`.
- Must be **equal to or later than** `date`.
- If `updated` is absent, `generate-sitemap.mjs` falls back to `date` for `<lastmod>`.

### Validation

`scripts/audit-seo.mjs` now checks:

1. If `updated` is present, it must match `^\d{4}-\d{2}-\d{2}$`.
2. If both `date` and `updated` are present, `updated >= date`.

Failures will block the build test pipeline.

### Sitemap Impact

`scripts/generate-sitemap.mjs` uses:

```xml
<lastmod>{updated || date}</lastmod>
```

This means:
- Articles without `updated` use their original publication date.
- Articles with `updated` signal to crawlers that the content changed.

### Search Engine Note

`<lastmod>` is a **hint**, not a command. Google and Yandex may choose their own crawl frequency based on overall site authority, internal linking, and historical update patterns. Keeping `updated` honest prevents crawl budget waste on unchanged pages.
