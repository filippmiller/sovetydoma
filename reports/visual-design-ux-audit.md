# Visual Design And UX Audit

## Checked Routes

- `/`
- `/search/?q=как избавится от одуванчиков`
- `/dacha-i-ogorod/borba-s-oduvanchikami/`
- `/contact/`
- `/about/`
- `/recepty/`
- `/admin/login/`

## Findings

1. Fixed: homepage card images were falling back or missing because the resolver used older frontmatter filenames instead of generated slug previews.
2. Fixed: URL-query search needed a static fallback so results appear even before React hydration.
3. Good: homepage hero is compact at about 101 px in the current desktop viewport.
4. Good: catalog thumbnails are small square previews around 93-100 px on 376 px cards, matching the requested compact card layout.
5. Good: cards now show the requested stat line shape: `Сегодня/relative date`, views, rating, likes, reading time.
6. Residual: authenticated pages render mostly client-side and need staging credentials for meaningful state validation.

## Page Scores

| Page | Clarity | Simplicity | Modernity | Hierarchy | Typography | Spacing | Color | Trust | Mobile Risk | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Home | 7 | 6 | 6 | 7 | 7 | 6 | 6 | 7 | 8 | Useful and readable, but too much content is loaded at once. Mobile feels long and heavy. |
| Search | 7 | 7 | 6 | 7 | 7 | 7 | 6 | 7 | 6 | Functionally better after fix, visually plain. Needs richer result previews. |
| Article | 8 | 7 | 7 | 8 | 7 | 7 | 6 | 8 | 7 | Strongest page. Content hierarchy is solid, but engagement blocks feel utilitarian. |
| Contact | 7 | 8 | 6 | 7 | 7 | 7 | 6 | 7 | 6 | Clear but generic. Needs stronger trust copy and delivery status clarity. |
| Recipes | 6 | 6 | 6 | 6 | 7 | 6 | 6 | 6 | 7 | Looks like a category index, not a recipe product surface. |
| Cabinet/auth pages | 5 | 6 | 5 | 5 | 6 | 6 | 6 | 5 | 7 | Client-only states make the pages feel unfinished before login. |
| Admin login | 5 | 6 | 5 | 5 | 6 | 6 | 5 | 6 | 7 | Functional but not polished; no visible security/trust framing. |

## Competitive Read

- Compared with Medium: article readability is close enough, but social/action modules are less refined.
- Compared with Дзен: the content grid is calmer and less clickbait, but lacks strong visual rhythm and feed controls.
- Compared with Tinkoff Journal: trust, authorship, and editorial polish are weaker; expert/AI author disclosure helps but needs stronger styling.
- Compared with Pinterest: image grid density and visual discovery are far weaker; current cards are text-first.
- Compared with Notion/Linear-style products: UI is much less crisp; spacing and component consistency are acceptable but not premium.

## Brutal Design Notes

- The site no longer looks broken, but it does not yet look premium.
- The homepage is overloaded: 180 cards on first load makes the page feel like an archive dump, not an edited front page.
- The color system is serviceable but generic; the red brand block is recognizable, while the rest of the UI relies on light beige/gray utility styling.
- Cards are now correctly compact, but the image previews are too small and same-shaped to create a strong magazine rhythm.
- Search is useful but visually underdesigned: no thumbnails, no highlighted matching terms, no "best match" treatment.
- Article pages are the best UX surface. They have clear H1, metadata, table of contents, short answer, and engagement controls.
- Auth/cabinet/admin areas need the most work. They read as features bolted onto a content site rather than a coherent account system.

## Recommended Visual Fixes

1. Replace the full homepage archive with: top 12 fresh articles, category tabs, then "load more".
2. Add thumbnails to search results and highlight matched tokens.
3. Give article engagement blocks a consistent compact panel style.
4. Make author/persona blocks visually trustworthy: stronger labels, "AI editor" disclosure, and updated date.
5. Add empty-state cards for cabinet, saved articles, user submissions, and admin pages.
6. Use a more editorial home section rhythm: featured article, two secondary articles, then compact list.

## Screenshots

Lighthouse final screenshots were extracted:

- `reports/screenshots/home-desktop.jpg`
- `reports/screenshots/home-mobile.jpg`
- `reports/screenshots/article-desktop.jpg`
- `reports/screenshots/article-mobile.jpg`
- `reports/screenshots/search-desktop.jpg`
- `reports/screenshots/contact-desktop.jpg`

## Post-Fix Browser Evidence

- Homepage: 180 images in DOM, 0 failed image loads, no console errors.
- Search query route: input value `как избавится от одуванчиков`, `Найдено: 14 статей`, first result `/dacha-i-ogorod/borba-s-oduvanchikami/`.
- Article/contact/about/recipes/admin-login routes: 0 failed images and no console errors in the browser sweep.
