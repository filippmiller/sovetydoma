# Accessibility Audit Before

## Method

Browser DOM checks over public anonymous routes plus source inspection of key components.

## Findings

- Good: the layout includes a skip link to `#main-content`.
- Good: public routes generally have one clear H1.
- Good: image cards use article titles as `alt` text.
- Good: icon-only favorite buttons expose labels in the components inspected earlier.
- Needs follow-up: some client-only/account pages do not expose a stable H1 before authentication state resolves.
- Needs follow-up: form input labeling needs a full pass with a staging-authenticated browser session; the simple DOM heuristic reported unlabeled hidden or dynamic inputs on several pages.

## Not Completed

- Keyboard-only full path testing for authenticated flows.
- Screen-reader role/name pass for modals after opening them.
- WCAG color contrast tooling pass.
