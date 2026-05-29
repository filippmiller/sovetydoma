# СоветыДома — Production Readiness Plan

## Project Context (read this first)

- **Site:** СоветыДома — Russian lifestyle/lifehack content portal
- **Repo:** `C:\DEV\sovetydoma`
- **Live URL:** https://pogovorim.vsedomatut.com
- **Stack:** Next.js 16.2.6 App Router, TypeScript, Tailwind CSS v4, MDX articles
- **Deploy workflow:** `vercel build --prod` (local) → `vercel deploy --prebuilt --prod --yes` → alias if needed
- **Package manager:** pnpm ONLY (npm fails due to Next.js 16.2.6 semver issue)
- **Articles:** 28 MDX files in `src/content/articles/`, 5 categories
- **Categories:** kulinaria, dom-i-uborka, dacha-i-ogorod, layfkhaki, ekonomiya

## What Has Been Built

- All 5 category pages + article pages with static params
- Homepage with featured articles and category chips
- Article pages: JSON-LD (Article + BreadcrumbList + Recipe/HowTo schema), TOC, related articles, share buttons (VK/TG/WA)
- SEO: robots.txt, sitemap.xml (build-time), RSS feed (build-time), og-default.png
- RSS: `scripts/generate-rss.mjs` → `public/feed.xml`
- Sitemap: `scripts/generate-sitemap.mjs` → `public/sitemap.xml`
- Schema markup: Recipe on borsch/bliny/mayonez/solyanka; HowTo on nakip/skovoroda/stirka-pukhovika/chistka-dukhovki

---

## Phase Overview

```
P1 → Build & Deploy          (fix, build, verify live site)
P2 → UI/UX Homepage          (visual audit + fixes)
P3 → UI/UX Article Page      (reading experience + mobile)
P4 → Performance             (Core Web Vitals, Lighthouse)
P5 → SEO Verification        (sitemap, RSS, meta, OG, schema)
P6 → Security Audit          (headers, exposure, injection)
P7 → Content & Feature Check (all pages, links, schema test)
P8 → Accessibility           (WCAG, keyboard, contrast, aria)
P9 → E2E Tests               (role-based: User / SEO / Security)
```

---

## PROMPT QUEUE

Copy each block below verbatim and paste it as a new message to Claude.

---

### PROMPT 1 — Build Fix & Full Deploy

```
You are continuing work on СоветыДома, a Russian lifestyle content portal at C:\DEV\sovetydoma, deployed at https://pogovorim.vsedomatut.com on Vercel.

TECH CONTEXT:
- Next.js 16.2.6 App Router, TypeScript, Tailwind v4, MDX articles
- Package manager: pnpm ONLY (npm breaks with this Next.js version)
- Deploy workflow: vercel build --prod (local) → vercel deploy --prebuilt --prod --yes
- vercel.json buildCommand: "node scripts/generate-sitemap.mjs && node scripts/generate-rss.mjs && npx next build"
- output: 'export' (static HTML), outputDirectory: "out"
- The Linux sandbox CANNOT build this — node_modules are on Windows filesystem. Use PowerShell via the Windows MCP for build commands.

WHAT NEEDS TO HAPPEN:
1. Run `vercel build --prod` in C:\DEV\sovetydoma via PowerShell (Windows MCP)
2. Watch for and fix any TypeScript/build errors
3. Run `vercel deploy --prebuilt --prod --yes` to deploy
4. Confirm the alias pogovorim.vsedomatut.com points to the new deployment
5. Do a smoke test: fetch https://pogovorim.vsedomatut.com, https://pogovorim.vsedomatut.com/feed.xml, https://pogovorim.vsedomatut.com/sitemap.xml and confirm all return 200 with correct content
6. Fetch one article page (e.g. /kulinaria/idealnyy-borshch/) and confirm Recipe JSON-LD is present in the HTML

Report: deployment URL, any errors fixed, confirmation of live checks.
```

---

### PROMPT 2 — UI/UX Audit: Homepage & Navigation

```
You are doing a UI/UX audit and improvement pass on СоветыДома, a Russian lifestyle portal at https://pogovorim.vsedomatut.com.

Tech stack: Next.js 16.2.6 App Router, Tailwind CSS v4, TypeScript. All UI code is in C:\DEV\sovetydoma\src\.

TASK: Audit and improve the HOMEPAGE and NAVIGATION experience.

Step 1 — Take screenshots using computer-use tools:
- Desktop homepage (1280px width)
- Mobile homepage (390px width) — resize browser or use DevTools mobile emulation
- Navigation header (note: sticky, defined in src/components/Header.tsx)

Step 2 — Evaluate against these UX criteria:
- Visual hierarchy: is the most important content (featured article, categories) immediately obvious?
- Category navigation: are the 5 categories clear, accessible, and easy to tap on mobile?
- Article cards: do they show enough info (title, category, reading time, excerpt)?
- CTA clarity: is there a clear "read more" affordance?
- Header: does it work at all scroll positions? Is the logo/brand clear?
- Footer: does it have useful links? Newsletter signup present?
- White space and typography: comfortable reading, no cramped sections?
- Color scheme: warm/earthy tones (current: #c0392b red accent, #f5f0e8 cream background)

Step 3 — Implement the top 5-8 improvements you find. Edit files directly in C:\DEV\sovetydoma\src\.
Key files:
  - src/app/page.tsx (homepage)
  - src/components/Header.tsx
  - src/components/Footer.tsx
  - src/components/ArticleCard.tsx
  - src/app/globals.css

Step 4 — After edits, run the build via PowerShell to confirm no errors: cd C:\DEV\sovetydoma && pnpm build

Document: what you found (with screenshots), what you changed and why.
```

---

### PROMPT 3 — UI/UX Audit: Article Reading Experience & Mobile

```
You are doing a UI/UX audit and improvement pass on the ARTICLE PAGE of СоветыДома at https://pogovorim.vsedomatut.com.

Tech stack: Next.js 16.2.6 App Router, Tailwind CSS v4. Repo: C:\DEV\sovetydoma\src\.

TASK: Audit and improve the article reading experience.

Step 1 — Take screenshots of these pages at desktop AND mobile widths:
- https://pogovorim.vsedomatut.com/kulinaria/idealnyy-borshch/ (recipe article)
- https://pogovorim.vsedomatut.com/dacha-i-ogorod/kompost-bystro/ (how-to article)

Step 2 — Evaluate against these criteria:
- Readability: font size (should be ≥16px body), line-height (should be ≥1.6), max-width (~680px for body text)
- Heading hierarchy: H1 prominent, H2 sections clear, visual separation
- Table of Contents: is it visible, useful, properly anchored?
- Category/date/reading-time meta: visible and scannable?
- Mobile layout: does the TOC collapse or scroll well? No horizontal overflow?
- Share buttons (VK, Telegram, WhatsApp): visible, well-spaced, tap-friendly (≥44px touch target)?
- Related articles: visible, styled well?
- Tags: visible and clickable?
- Prose styles: are H2/H3/strong/lists/code styled properly in globals.css .prose class?
- Breadcrumb: present and correct?

Step 3 — Implement the top improvements. Key files:
  - src/app/[category]/[slug]/page.tsx (article page layout)
  - src/components/TableOfContents.tsx
  - src/components/RelatedArticles.tsx
  - src/app/globals.css (the .prose class governs MDX rendering)

Step 4 — Mobile-specific check: make sure the category stripe (colored top bar), header meta (date/time/words), and share buttons are all properly styled on 390px viewport.

Step 5 — Rebuild: cd C:\DEV\sovetydoma && pnpm build. Fix any errors.

Document findings with screenshots and list all changes made.
```

---

### PROMPT 4 — Performance Audit & Core Web Vitals

```
You are doing a performance audit on СоветыДома at https://pogovorim.vsedomatut.com.

This is a statically-exported Next.js 16.2.6 site (output: 'export'), served via Vercel CDN. Repo: C:\DEV\sovetydoma\.

TASK: Audit and improve performance.

Step 1 — Use the Chrome MCP or computer-use to run Lighthouse on these URLs:
- https://pogovorim.vsedomatut.com/ (homepage)
- https://pogovorim.vsedomatut.com/kulinaria/idealnyy-borshch/ (article)
Record: LCP, CLS, FID/INP, Performance score, Accessibility score, SEO score.

Step 2 — Alternatively (or additionally) use web_fetch on:
- https://pagespeed.web.dev/report?url=https://pogovorim.vsedomatut.com
to get scores.

Step 3 — Check these specific performance issues in the codebase:
a) Google Fonts: loaded via @import in globals.css — verify it's preconnected or loaded with display=swap
b) Images: all images are unoptimized (next.config.ts has images.unoptimized:true for static export). Check if public/images/ has any large files.
c) JavaScript bundle: any large client components? The site should be mostly server-rendered.
d) CSS: Tailwind v4 should purge unused styles — verify.
e) Preloading: is the PT Sans font preloaded in layout.tsx <head>?

Step 4 — Implement fixes:
- Add <link rel="preconnect" href="https://fonts.googleapis.com"> to layout.tsx if missing
- Add font-display:swap to the @import if not present
- Add <link rel="preload"> for the main font
- Compress any large images in public/images/ using sharp or Python Pillow
- Add fetchPriority="high" to hero images if using next/image anywhere

Step 5 — Check vercel.json for cache headers — add long-cache for static assets:
{
  "headers": [
    { "source": "/(.*)\\.(?:js|css|woff2|png|jpg|svg)$", "headers": [{"key":"Cache-Control","value":"public, max-age=31536000, immutable"}] },
    { "source": "/feed.xml", "headers": [{"key":"Cache-Control","value":"public, max-age=3600"}] }
  ]
}

Step 6 — Rebuild and deploy: cd C:\DEV\sovetydoma && vercel build --prod && vercel deploy --prebuilt --prod --yes

Document before/after Lighthouse scores and all changes.
```

---

### PROMPT 5 — SEO Verification & Hardening

```
You are doing a thorough SEO verification pass on СоветыДома at https://pogovorim.vsedomatut.com.

This is a Yandex-first Russian content site built with Next.js 16.2.6 static export. Repo: C:\DEV\sovetydoma\.

TASK: Verify and harden all SEO elements.

Step 1 — Sitemap check:
- Fetch https://pogovorim.vsedomatut.com/sitemap.xml
- Confirm it contains: homepage, 5 category pages, all 28 article pages
- Verify all URLs use the correct domain (pogovorim.vsedomatut.com)
- Verify dates are present on article URLs

Step 2 — RSS feed check:
- Fetch https://pogovorim.vsedomatut.com/feed.xml
- Confirm valid RSS 2.0 structure, 20 items, correct domain
- Confirm the <atom:link> self-reference is correct
- Confirm <language>ru</language> is present

Step 3 — robots.txt check:
- Fetch https://pogovorim.vsedomatut.com/robots.txt
- Confirm Yandex bots are explicitly allowed: YandexBot, YandexImages, YandexVideo, YandexMedia
- Confirm sitemap URL is listed
- Confirm no important pages are blocked

Step 4 — Meta tags check (fetch raw HTML of these pages):
- https://pogovorim.vsedomatut.com/ → check title, description, og:image, og:type=website, canonical
- https://pogovorim.vsedomatut.com/kulinaria/idealnyy-borshch/ → check title, description, og:type=article, og:published_time, keywords, canonical

Step 5 — Schema validation:
- Fetch HTML of the borsch article and extract the JSON-LD <script> tags
- Verify: Article schema has headline, datePublished, author, publisher
- Verify: Recipe schema has name, recipeIngredient, prepTime, cookTime, recipeYield
- Verify: BreadcrumbList has 3 items with correct URLs

Step 6 — Internal linking audit:
- Check that the homepage links to all 5 categories
- Check that article pages link to related articles in the same category
- Check that tag pages exist and link back to articles
- Check there are no broken hrefs in src/app/

Step 7 — Fix any issues found. Key files:
  - public/robots.txt
  - scripts/generate-sitemap.mjs
  - scripts/generate-rss.mjs
  - src/app/layout.tsx (global metadata)
  - src/app/[category]/[slug]/page.tsx (article metadata)

Step 8 — If changes made: rebuild and deploy.

Document all findings with pass/fail for each check.
```

---

### PROMPT 6 — Security Audit

```
You are doing a security audit on СоветыДома at https://pogovorim.vsedomatut.com.

This is a statically-exported Next.js 16.2.6 site (no server-side code runs in production — all pages are pre-rendered HTML). Repo: C:\DEV\sovetydoma\.

TASK: Audit security posture and implement improvements.

Step 1 — HTTP Headers audit (fetch response headers from the live site):
Use web fetch or curl equivalent to check response headers for:
- https://pogovorim.vsedomatut.com/
- https://pogovorim.vsedomatut.com/kulinaria/idealnyy-borshch/

Check for presence and correctness of:
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN (or DENY)
- X-XSS-Protection: 1; mode=block (legacy, but still useful)
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()
- Content-Security-Policy (CSP) — should allow: self, fonts.googleapis.com, fonts.gstatic.com, vk.com, t.me, wa.me, mc.yandex.ru (Yandex Metrika)
- Strict-Transport-Security (HSTS) — Vercel adds this automatically, confirm

Step 2 — Add security headers to vercel.json if missing:
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {"key": "X-Content-Type-Options", "value": "nosniff"},
        {"key": "X-Frame-Options", "value": "SAMEORIGIN"},
        {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
        {"key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()"},
        {"key": "X-XSS-Protection", "value": "1; mode=block"}
      ]
    }
  ]
}
Note: Merge with any existing headers in vercel.json (cache-control headers may already be there from P4).

Step 3 — Information disclosure check:
- Verify there is NO .env file committed in C:\DEV\sovetydoma\ (check .gitignore)
- Check that no API keys, tokens, or secrets appear in any source files
- Check that next.config.ts does not expose sensitive env vars to the client (NEXT_PUBLIC_ prefix only for non-sensitive values)
- Confirm there is no /api/ route that could expose data (this is a static export — there should be none)
- Check that src/components/YandexMetrika.tsx does not hardcode a real tracking ID

Step 4 — Dependency audit:
- Run: cd C:\DEV\sovetydoma && pnpm audit 2>&1 (via Windows PowerShell MCP)
- Document any HIGH or CRITICAL vulnerabilities
- Update vulnerable packages if safe to do so

Step 5 — robots.txt security check:
- Confirm /admin, /.env, /api are either non-existent or disallowed in robots.txt
- Confirm Disallow rules don't accidentally block important pages

Step 6 — Content injection check:
- MDX articles are pre-rendered at build time — no runtime user input
- Confirm newsletter form (if present) has no server-side handler that could be exploited
- Check if the newsletter form in Footer.tsx actually does anything (it should be a placeholder/cosmetic)

Step 7 — Fix all issues found. Rebuild and deploy if changes made.

Document all findings as PASS / FAIL / FIXED with explanations.
```

---

### PROMPT 7 — Content & Feature Completeness Check

```
You are doing a content and feature completeness check on СоветыДома at https://pogovorim.vsedomatut.com.

This is a Russian lifestyle content portal with 28 MDX articles across 5 categories. Repo: C:\DEV\sovetydoma\.

TASK: Verify every feature and page works correctly end-to-end.

Step 1 — Article inventory check:
Read all .mdx files in src/content/articles/ and create a table:
- Article slug, category, title, date, schemaType (if any), has recipeIngredient (for Recipe type)
- Confirm exactly 4 articles per category (20 new + 8 original = 28 total):
  - kulinaria: 4 original + 4 new = 8 total? (check)
  - dom-i-uborka: 4 new
  - dacha-i-ogorod: 4 new
  - layfkhaki: 4 new
  - ekonomiya: 4 new
- Flag any articles with missing required frontmatter fields (title, slug, category, description, date, image, tags)

Step 2 — Page routing check (use Chrome MCP to visit each):
- Homepage: https://pogovorim.vsedomatut.com/
- All 5 category pages: /kulinaria/, /dom-i-uborka/, /dacha-i-ogorod/, /layfkhaki/, /ekonomiya/
- 2 articles from each category (pick first and last)
- Search page: /search/
- About page: /about/
- Tag page: /tag/борщ/ (or any tag from an article)
- 404 page: /nonexistent-page/
For each: confirm it loads, no blank content, no JS errors in console

Step 3 — Interactive feature check on article page:
Visit https://pogovorim.vsedomatut.com/kulinaria/idealnyy-borshch/
- Table of Contents: click an H2 link → confirm it scrolls to the section
- Share buttons: click VK button → confirm it opens correct VK share URL in new tab
- Tags: click a tag → confirm it goes to /tag/[tag]/ and shows articles
- Related articles: confirm 3 related articles are shown, links work
- Back to Top button: scroll down, confirm button appears, click → scrolls to top

Step 4 — RSS & Sitemap content check:
- Fetch /feed.xml → count items, verify titles are in Russian, verify URLs are correct domain
- Fetch /sitemap.xml → count URLs, spot-check 3 article URLs match actual routes

Step 5 — 404 behavior:
- Fetch https://pogovorim.vsedomatut.com/nonexistent/ → should show custom 404, not a blank page
- Verify 404 page has navigation back to homepage

Step 6 — Schema correctness (copy-paste test):
- Fetch raw HTML of /kulinaria/idealnyy-borshch/ 
- Extract the Recipe JSON-LD script
- Paste into https://validator.schema.org to check validity
- Do the same for a HowTo article (/dom-i-uborka/nakip-v-chaynike/)

Step 7 — Fix any broken features found. Rebuild and deploy if needed.

Document as a checklist: ✅ PASS / ❌ FAIL / 🔧 FIXED for each item.
```

---

### PROMPT 8 — Accessibility Audit (WCAG 2.1 AA)

```
You are doing an accessibility audit on СоветыДома at https://pogovorim.vsedomatut.com.

Target standard: WCAG 2.1 AA. Tech stack: Next.js 16.2.6, Tailwind CSS v4. Repo: C:\DEV\sovetydoma\src\.

TASK: Audit and fix accessibility issues.

Step 1 — Automated scan:
Use the Chrome MCP to run axe-core on the homepage and one article page:
javascript: const script=document.createElement('script'); script.src='https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js'; document.head.appendChild(script); setTimeout(()=>axe.run().then(r=>console.log(JSON.stringify(r.violations,null,2))),1000);
Run this in the browser console via Chrome MCP's javascript_tool, record all violations.

Step 2 — Manual checks:
a) Skip link: page has <a href="#main-content" class="skip-link"> — confirm it's present and functional (becomes visible on focus)
b) Keyboard navigation: Tab through homepage — can you reach all nav links, article cards, category buttons without mouse?
c) Focus indicators: are focused elements visibly highlighted? (check globals.css for :focus-visible styles)
d) Images: all <img> tags and Next.js <Image> components have descriptive alt text?
e) Heading hierarchy: H1 exists on every page? H2s don't skip to H4?
f) Color contrast: primary text (#1a1a1a on #f5f0e8) ✓, but check: category badges, article meta text (#aaa), tags (#666 on #f0ede8) — all must meet 4.5:1 for normal text
g) Form labels: newsletter form input has an associated <label>?
h) ARIA: any custom interactive elements (BackToTop button, TOC links) have aria-label?
i) Lang attribute: <html lang="ru"> present in layout.tsx? ✓ (verify)
j) Link text: no "click here" or "read more" without context?

Step 3 — Fix issues found. Priority order:
1. Any axe violations rated "critical" or "serious"
2. Missing alt texts
3. Contrast failures
4. Missing focus styles
5. Missing ARIA labels

Key files to edit:
  - src/app/globals.css (focus styles, skip link styles)
  - src/components/Header.tsx (nav aria-labels)
  - src/components/ArticleCard.tsx (alt text, link text)
  - src/components/BackToTop.tsx (aria-label on button)
  - src/components/Footer.tsx (form label)
  - src/app/layout.tsx (skip link)

Step 4 — Re-run axe after fixes to confirm zero critical/serious violations.

Step 5 — Rebuild if changes made: pnpm build via Windows PowerShell MCP.

Document: list of violations found, fixes applied, final axe score.
```

---

### PROMPT 9 — End-to-End Tests (All Roles)

```
You are running end-to-end tests on СоветыДома at https://pogovorim.vsedomatut.com.

This is a Russian lifestyle content portal (static Next.js site). Tests are divided by role.
Use Chrome MCP for browser interaction, web_fetch for HTTP checks, and computer-use for screenshots.

═══════════════════════════════════════════════
ROLE 1: END USER (Russian visitor, mobile-first)
═══════════════════════════════════════════════

Scenario A — Discovery via homepage:
1. Navigate to https://pogovorim.vsedomatut.com/
2. Screenshot the page. Confirm: logo visible, 5 categories listed, articles shown.
3. Click the "Кулинария" category → confirm /kulinaria/ loads with article list.
4. Click the first article → confirm article page loads with title, content, TOC.
5. Click a share button (Telegram) → confirm it opens correct URL.
6. Scroll to bottom → confirm related articles are shown.
7. Click a related article → confirm it navigates correctly.

Scenario B — Article search/browse:
1. Navigate to https://pogovorim.vsedomatut.com/search/
2. Confirm the page loads and shows articles or category browse.
3. Click a tag on any article → /tag/[tag]/ → confirm articles appear.

Scenario C — Mobile experience:
1. Resize browser to 390px width (use Chrome DevTools via Chrome MCP).
2. Screenshot homepage — confirm no horizontal scroll, nav is usable.
3. Screenshot an article page — confirm TOC, share buttons, content are all readable.

═══════════════════════════════════════════════
ROLE 2: SEO CRAWLER (Googlebot / YandexBot perspective)
═══════════════════════════════════════════════

1. Fetch robots.txt — confirm YandexBot is allowed, sitemap URL is present.
2. Fetch sitemap.xml — confirm 28+ article URLs, all with correct domain.
3. Fetch feed.xml — confirm valid RSS, 20 items, Russian titles.
4. Fetch raw HTML of homepage — confirm:
   - <title> tag present and correct
   - <meta name="description"> present
   - <link rel="canonical"> present and correct
   - <html lang="ru"> present
   - JSON-LD WebSite schema present
   - hreflang tag present
5. Fetch raw HTML of /kulinaria/idealnyy-borshch/ — confirm:
   - <title> is article title
   - Article JSON-LD with @type:Article
   - Recipe JSON-LD with recipeIngredient array
   - BreadcrumbList JSON-LD
   - og:type = article
   - og:published_time present
   - <link rel="canonical"> matches the page URL
6. Fetch raw HTML of /tag/борщ/ — confirm robots noindex meta is present (tag pages should be noindex).

═══════════════════════════════════════════════
ROLE 3: SECURITY AUDITOR
═══════════════════════════════════════════════

1. HTTP Headers — fetch headers for https://pogovorim.vsedomatut.com/ and confirm:
   - X-Content-Type-Options: nosniff ✓
   - X-Frame-Options: SAMEORIGIN ✓
   - Referrer-Policy present ✓
   - HSTS (Strict-Transport-Security) present (added by Vercel) ✓
   - No Server header revealing tech stack
   - No X-Powered-By: Next.js header (can reveal framework)

2. Path traversal — fetch these URLs and confirm they return 404 (not file contents):
   - https://pogovorim.vsedomatut.com/.env
   - https://pogovorim.vsedomatut.com/package.json
   - https://pogovorim.vsedomatut.com/next.config.ts
   - https://pogovorim.vsedomatut.com/.git/config

3. Information disclosure — fetch page HTML and confirm:
   - No debug output or stack traces in HTML
   - No commented-out credentials or TODO notes with sensitive info
   - Yandex Metrika counter ID is placeholder (empty string), not a real ID

4. External links — on the article page, confirm all external share links (VK, Telegram, WhatsApp) use HTTPS and point to correct domains (not spoofed).

5. Newsletter form — submit the newsletter form with test@test.com:
   - Confirm it does NOT actually send data anywhere (it's a UI placeholder)
   - Confirm no XSS is possible in the email input field

═══════════════════════════════════════════════
ROLE 4: PERFORMANCE ENGINEER (final check)
═══════════════════════════════════════════════

1. Check response times via web_fetch for:
   - Homepage: should respond in < 300ms (Vercel CDN)
   - Article page: same
2. Check Content-Encoding header — Vercel should serve gzip/br compressed responses.
3. Verify cache headers: static assets (.js, .css, images) should have long Cache-Control.
4. Check /feed.xml cache header — should be max-age=3600 or similar.
5. Check if og-default.png exists and is accessible: https://pogovorim.vsedomatut.com/og-default.png
6. Verify the RSS link is in the HTML <head>: <link rel="alternate" type="application/rss+xml">

═══════════════════════════════════════════════
FINAL REPORT
═══════════════════════════════════════════════

After running all 4 roles, produce a final report:
- Role 1 (User): [PASS/FAIL] with issues
- Role 2 (SEO): [PASS/FAIL] with issues  
- Role 3 (Security): [PASS/FAIL] with issues
- Role 4 (Performance): [PASS/FAIL] with issues
- Overall production readiness: READY / NOT READY
- Remaining action items if any

If any issues found: fix them in C:\DEV\sovetydoma\src\, rebuild, and deploy before closing.
```

---

## Summary of Queue Order

| # | Prompt | Focus | Est. Time |
|---|--------|-------|-----------|
| P1 | Build & Deploy | Fix build, deploy new content | 20 min |
| P2 | UI/UX Homepage | Visual audit + fixes | 30 min |
| P3 | UI/UX Article | Reading UX + mobile | 30 min |
| P4 | Performance | Lighthouse, caching, fonts | 25 min |
| P5 | SEO Verification | Sitemap, RSS, meta, schema | 25 min |
| P6 | Security Audit | Headers, secrets, injection | 20 min |
| P7 | Feature Check | All pages, all features | 30 min |
| P8 | Accessibility | WCAG 2.1 AA, axe scan | 25 min |
| P9 | E2E Tests | 4 roles, final report | 40 min |

**Total estimated time to full production readiness: ~4 hours of Claude execution**
