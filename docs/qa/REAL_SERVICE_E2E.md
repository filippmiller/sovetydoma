# Real-service E2E certification

`pnpm e2e:real` is an evidence-producing, read-only production probe. It never uses a mock, fixture, local emulator, fake API response, or fabricated record. It writes only a redacted JSON report under `qa/real-service/artifacts/` (ignored by Git).

`pnpm e2e:real:strict` is the certification gate. It exits non-zero for any `FAIL` **or** `BLOCKED` stage. A green unit suite, build, worker health check, dry-run, or mocked handler test does not satisfy it.

## What the default run proves

It checks the live release identity, public static site, robots and sitemap, real renderer indexes, a renderer record through the live production article URL, dynamic-page JSON-LD/worker integration wiring, public UGC read, public subscription state, admin dependency health, and a real unauthenticated admin denial. Each result contains HTTP status and a SHA-256 body fingerprint, rather than a copied raw response.

## What remains deliberately blocked until QA resources exist

The full system has stateful and third-party branches that cannot be truthfully proven by a read-only production probe: password and OAuth identity lifecycle; UGC, photos, collections and moderation; double opt-in and outbound delivery; push device receipt; admin publish/unpublish/rollback/cache propagation; R2 writes; Telegram/MAX/WhatsApp/Resend/VK/Facebook callbacks and sends; hourly digest/autopost; and GA4/Yandex provider receipt.

To convert a stage from `BLOCKED` to `PASS`, use only dedicated owned QA resources and record all of the following in the report/run log:

1. The exact live endpoint and correlation ID (never tokens, cookies, passwords, or full provider payloads).
2. Preconditions and the complete user/provider journey, including reload persistence where relevant.
3. Provider-side delivery/receipt evidence for every outbound or callback flow.
4. The exact database/object/provider cleanup query or action and its verified zero-residue result.
5. A fresh post-cleanup read proving the normal public state is unchanged.

Never run state-changing production probes against a real visitor, a public social group, or an unowned mailbox. If an isolated staging environment is supplied, point a copied manifest at that environment and preserve the same no-mock, real-provider requirement.

## Gate policy

Only `PASS` gives credit. `FAIL` is a verified broken contract. `BLOCKED` is a missing prerequisite, unsafe side-effect boundary, inaccessible provider, or absent cleanup authority. There is intentionally no `SKIPPED` or `ASSUMED PASS` state.
