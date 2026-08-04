# Deep production E2E

The suite has two deliberately separate layers.

`pnpm e2e:production` is a fail-closed, read-only live-service certification. It uses the production static site and Workers directly, verifies the deployed SHA, crawler entry points, 20 public routes, all 12 category pages, five health articles, a bounded sitemap sample, dynamic rendering, renderer indexes, public Worker reads, and an unauthenticated admin denial. It writes redacted response fingerprints under `qa/real-service/artifacts/`; those artifacts are ignored. Run `pnpm e2e:production -- --full-sitemap` only in a quiet maintenance window when every sitemap URL must be read.

`pnpm e2e:browser` drives installed Chrome at 1440×1000 and 390×844 against `https://1001sovet.ru` by default. It verifies real navigation, responsive overflow, mobile menu/focus behaviour, sidebar visibility and hash navigation, autocomplete, live client islands, local anonymous favourite storage, health-article semantic output, images, JSON-LD, page errors and failed same-origin GETs. It creates no production records.

The following are deliberately **BLOCKED**, not green or silently skipped: registration/recovery, email/VK/Yandex OAuth, comment/question/photo/rating/reaction lifecycle, category subscriptions/double opt-in, push delivery, admin publish/rollback, provider webhooks and analytics receipt. They require dedicated owned QA identities, private provider sandboxes, correlation IDs and a verified cleanup procedure. Do not use a visitor account or the interactive Chrome profile for those tests. Only after those resources are supplied may an owner run an active suite with `E2E_ALLOW_ACTIVE=1` and per-resource credentials kept in an ignored environment file.

`pnpm e2e:production:strict` treats both `FAIL` and `BLOCKED` as non-zero. This is intentional: it is a release certification gate only after the active QA resources exist.
