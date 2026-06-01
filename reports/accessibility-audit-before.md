# Accessibility Audit Before

## Method

Browser DOM checks over public anonymous routes, source inspection of key components, and Lighthouse accessibility scoring. Standalone `@axe-core/cli` was attempted but failed because its ChromeDriver only supported Chrome 149 while installed Chrome is 148. Direct axe injection into the in-app browser was blocked by the browser sandbox (`Function`, `eval`, and `document.createElement` unavailable in page evaluate).

## Lighthouse Accessibility Scores

| Route | Score |
| --- | ---: |
| Home desktop | 96 |
| Article desktop | 91 |
| Article mobile | 91 |
| Search desktop | 94 |
| Contact desktop | 91 |

## Findings

- Good: the layout includes a skip link to `#main-content`.
- Good: public routes generally have one clear H1.
- Good: image cards use article titles as `alt` text.
- Good: icon-only favorite buttons expose labels in the components inspected earlier.
- Needs follow-up: some client-only/account pages do not expose a stable H1 before authentication state resolves.
- Needs follow-up: form input labeling needs a full pass with a staging-authenticated browser session; the simple DOM heuristic reported unlabeled hidden or dynamic inputs on several pages.
- Needs follow-up: modal focus trapping and keyboard return focus were not proven.

## Not Completed

- Keyboard-only full path testing for authenticated flows.
- Screen-reader role/name pass for modals after opening them.
- Full axe-core pass, blocked by local ChromeDriver mismatch.
