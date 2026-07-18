# Autonomous completion handoff — 1001sovet.ru

Repository: `https://github.com/filippmiller/sovetydoma.git`

Primary entry point: bead `sovetydoma-11g` and all of its children.

## Mission

Bring the whole project to a genuinely finished, production-verified state. Build a secure admin control plane that manages every article and its media immediately without a static rebuild, restore feature parity on dynamic articles, run exhaustive browser QA, and triage/complete every existing open or in-progress bead. Work autonomously and persist until all actionable work is implemented, tested, deployed and verified.

Do not interpret “finish every bead” as permission to fabricate completion. Tasks that require the owner's personal account, a new paid provider, legal approval, CAPTCHA, secret value, or irreversible external action must be reduced to the smallest exact operator action and marked as an evidenced operator blocker. Stale or duplicate beads must be reconciled and explicitly marked superseded, never silently discarded.

## Bootstrap on the new machine

1. Clone the repository; check out `master`; fetch and fast-forward to `origin/master`. Do not begin from a copied working directory.
2. Install the repository-declared Node/pnpm versions and `bd` tooling. Use the tracked lockfile; do not casually regenerate it.
3. Restore beads using the canonical Dolt sync protocol described by `bd prime` and `AGENTS.md`. If the Dolt remote is unavailable on the new machine, initialize the local `sovetydoma` database and import the tracked `.beads/issues.jsonl` without losing newer remote data.
4. Run `bd prime`, then read `AGENTS.md`, `CLAUDE.md`, `bd show sovetydoma-cxl`, every relevant passport child, `bd show sovetydoma-11g`, and all ten `sovetydoma-11g.*` children.
5. Enumerate the complete backlog with unlimited output: all `open` and `in_progress` beads, including child issues. Do not rely on the default 50-item limit.
6. Inspect code, production and provider state directly. Treat historical notes as leads, not proof. Record conflicts as `SUPERSEDED` or `NEEDS VERIFICATION` in the proper passport bead.
7. Before preparing external prompts or sharing logs, run a tracked-tree secret scan. Never print or commit secret values. This handoff's current-checkout pattern scan found zero matches, but that is not a substitute for a full scan after cloning the entire tree.

## Verified starting facts (2026-07-18)

- Publishing an article must never trigger a site rebuild. This is a hard project rule; see `sovetydoma-0q8`, `sovetydoma-289` and `docs/NO-REDEPLOY-PUBLISHING.md`.
- Dynamic articles are served from `content_matrix` by `workers/renderer`; article media is in R2. Static files currently win at Caddy, which creates a split source of truth for instant edits/unpublishing.
- The production renderer was updated to RENDER_VERSION 9. A replacement hero for `kak-snizit-davlenie-za-10-minut-bez-tabletok` uses a new immutable R2 key ending in `-no-person.jpg`; never overwrite an immutable media URL for a replacement.
- The owner found that the first attempted replacement reused an immutable URL and Chrome kept showing feet in a basin. Bead `sovetydoma-u0l` was reopened. Close it only after a screenshot/visual check in a previously warm browser proves the new no-person image is actually displayed.
- Dynamic questions/comments now render approved rows or explicit empty/error states; however, interactive UGC/reactions/favorites parity is still absent because the renderer strips Next hydration. This is `sovetydoma-11g.7`.
- The existing admin is not a content control plane:
  - `src/components/admin/AdminArticlesList.tsx` calls build-time `getAllArticles()` and lists only the static MDX corpus (486 in the inspected UI), not roughly 1700 dynamic articles.
  - `AdminArticleDetail.tsx` is read-only and only copies MDX. The repository has no generated `src/app/admin/articles/[slug]/page.tsx`, even though list links point there.
  - `AdminPhotoModeration.tsx` only moderates reader uploads; it cannot inspect, generate, assign, replace or roll back article hero images.
  - `AdminShell.tsx` exposes Categories, Tags and Settings links with `href="#"`.
  - Several admin data paths swallow errors with empty `catch` blocks, and direct navigation can show a blank/fallback state while auth resolves.
- Root renderer checks passed after the cache-busting fix: TypeScript clean and 23/23 renderer tests green.
- Admin/backlog work is captured in epic `sovetydoma-11g` with ten children. Do not replace this with a markdown TODO list.

## Required architecture outcomes

Treat `sovetydoma-11g` acceptance criteria as binding. In particular:

1. Establish one runtime source of truth for every article, including revision history and draft/published/unpublished/scheduled state. Reconcile MDX, `content_matrix`, live URLs, sitemaps and indexes idempotently. Back up and dry-run before migrations.
2. Route privileged mutations through a server-side admin API/BFF/Worker. Validate the Supabase JWT and admin role on every request. Keep service-role and image-provider credentials server-side. Add validation, optimistic concurrency, idempotency, audit events and abuse controls.
3. Replace the build-time admin list/detail flow with a paginated runtime manager and editor: search/filter, preview, metadata/body editing, quality gate, autosave, schedule, publish/unpublish/republish and revision rollback.
4. Build article-media management, separate from reader-photo moderation: preview current media, upload/select, generate multiple candidates from an editable prompt, compare, assign, set alt/crop/focal point, roll back and inspect job status. Use new immutable versioned URLs for every replacement and update HTML, OpenGraph, Twitter and JSON-LD atomically.
5. Make cache invalidation targeted and automatic. Content/media/status changes must appear in both cold and previously warm browsers within a documented SLO, without a code or static deploy.
6. Restore interactive behavior on dynamic pages with safe progressive enhancement or equivalent islands: authentication intent, favorites, ratings/reactions, comments, questions, feedback/reporting and photo submission. Preserve server-rendered SEO HTML and RLS/moderation.
7. Add real taxonomy/settings surfaces or remove dead navigation. Add safe bulk actions, risky-topic disclaimer work and description-quality queues.
8. Add audit visibility, structured redacted logs, retry/dead-letter behavior for generation jobs, alerts, backups and a tested restore/rollback runbook.

## Exhaustive QA requirement

Use a signed-in Chrome session when needed and inspect visible UI, screenshots, console and network state. Test desktop and mobile. Cover at minimum:

- main navigation, search, categories, tags, archives, hubs and representative static/dynamic articles;
- login, registration, logout, email confirmation, password recovery and configured OAuth providers;
- favorites, ratings, reactions, comments, questions/answers, feedback/reporting and reader photo upload/moderation;
- subscription channels, confirmation/status/error states, share buttons and social links;
- every admin route, direct navigation, auth denial, article/media CRUD, publish/unpublish/restore, cache behavior and rollback;
- empty, loading, denied, validation, network failure and provider failure states;
- console errors, failed requests, broken assets, dead links, permanent spinners, misleading or meaningless controls.

Create/update a bead before fixing each reproducible defect. Maintain a versioned route/flow matrix with expected result, actual result and evidence. Automate critical smoke/E2E paths. Do not claim a provider flow works if it was not exercised end to end; distinguish code completion from owner/provider configuration.

## Multi-agent execution strategy

Use subagents aggressively but safely. Prefer cheaper/faster agents for bounded read-only inventory, route crawling, test writing, visual QA matrices, duplicate-bead analysis and documentation reconciliation. Use the strongest available agent for architecture, database migrations, auth/RLS/security, destructive operations, deployment decisions and final review.

- Give each subagent a concrete bead or non-overlapping bounded workstream, explicit files/scope, acceptance criteria and required evidence.
- Do not let two agents edit the same files or migration simultaneously. Use isolated branches/worktrees where supported and integrate through reviewed commits.
- Require every subagent to report commands, results, risks and changed paths; the primary agent independently reviews and runs the gates.
- Keep at least one reviewer/tester independent of each implementation workstream.
- Never delegate interpretation of `AGENTS.md`, passport rules or secret-handling policy; the primary agent must read and enforce them.

## Priority and operating rules

1. First stabilize P0 production regressions and security/data-integrity risks.
2. Then complete `sovetydoma-11g.1` through `.5` and `.9`; these form the admin/no-redeploy critical path.
3. Complete interactive parity, operations and taxonomy work.
4. Triage and resolve every remaining open/in-progress bead under `sovetydoma-11g.10`, respecting dependencies and explicit operator approvals.

Do not mutate production merely to explore. For migrations, bulk backfills, external messages/posts, account creation, paid generation or destructive changes: perform read-only discovery, backups and dry-runs first; execute only when already authorized by the bead/owner and the exact scope is verified. Never build on the VPS. Use `wrangler secret bulk` for Worker secrets. Never place secrets in prompts, commits, beads or logs.

## Gates and definition of done

Use canonical project gates and CI. At minimum for relevant changes run deterministic install checks, secret scan, lint, TypeScript, unit/integration tests, content/SEO/image audits, production build and browser E2E. Never pipe a gate through output truncation when its exit code matters.

A bead closes only when its acceptance criteria are met with code/test/deploy/production evidence. Update the proper passport children after durable changes, preserve history with `SUPERSEDED`, export/sync beads, commit them with code, `git pull --rebase`, push, and verify the branch is clean and up to date. Monitor CI/deploy to success and recheck production after activation.

Do not stop at a plan, partial patch, local green test or “ready to push”. Continue until all actionable beads are completed and production-verified. The final report must map every originally open/in-progress bead to one of: completed with evidence, superseded with evidence, or genuinely operator-blocked with the exact single next action.
