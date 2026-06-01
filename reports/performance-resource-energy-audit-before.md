# Performance, Resource, And Energy Audit Before

## Method

Lightweight local browser sweep plus production-style build. Full Lighthouse was not added as a dependency in this pass.

## Observations

- Before the thumbnail fix, the dev server log showed repeated 404s for catalog preview images such as `/images/previews/bliny.jpg`, `/images/previews/ogurcy.jpg`, and `/images/previews/ekonomiya.jpg`.
- Those 404s add avoidable network requests, server work, console noise, and delayed visual fallback.
- The homepage includes 180 article cards/images in the initial DOM, which is heavy for a landing page. Images are small previews, but the card count is still high.
- Static generation completed successfully: 623 static pages generated.

## Risk Areas

- Large homepage payload from rendering the full catalog.
- Third-party font CSS and metrics scripts can affect first paint.
- Supabase aggregate calls on the full catalog can become expensive as article count grows.

## Recommended Follow-Up

- Add pagination or "load more" for the homepage catalog.
- Keep slug preview images small and cacheable.
- Consider precomputed public stats JSON if Supabase aggregate calls become slow.
