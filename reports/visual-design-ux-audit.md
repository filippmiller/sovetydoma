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
| Home | 8 | 7 | 7 | 8 | 7 | 7 | 7 | 7 | 6 | Strong utility layout; 180-card first page is heavy. |
| Search | 8 | 8 | 7 | 8 | 7 | 8 | 7 | 7 | 7 | Query fallback fixed; result cards are clear. |
| Article | 8 | 7 | 7 | 8 | 7 | 7 | 7 | 8 | 7 | Good content hierarchy; engagement needs authenticated test. |
| Contact | 8 | 8 | 7 | 8 | 7 | 8 | 7 | 8 | 7 | Clear form and direct email fallback. |
| Recipes | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 6 | Needs deeper recipe filtering UX review later. |
| Admin login | 6 | 7 | 6 | 6 | 6 | 7 | 6 | 7 | 6 | Functional surface; full admin UX requires credentials. |

## Screenshot Note

The requested screenshot capture was attempted through the browser tooling, but the capture command timed out. No screenshot files were produced in this pass.

## Post-Fix Browser Evidence

- Homepage: 180 images in DOM, 0 failed image loads, no console errors.
- Search query route: input value `как избавится от одуванчиков`, `Найдено: 14 статей`, first result `/dacha-i-ogorod/borba-s-oduvanchikami/`.
- Article/contact/about/recipes/admin-login routes: 0 failed images and no console errors in the browser sweep.
