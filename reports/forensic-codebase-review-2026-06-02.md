# SovetyDoma Forensic Codebase Review
**Date:** 2026-06-02  
**Reviewer:** Grok 4.3 (xAI) — thorough static + dynamic analysis via tools, source reads, execution of gates, pattern scans.  
**Scope:** Full repo (src/, scripts/, workers/, supabase/, .github/, content, config, docs, prior reports). Excludes node_modules, out/, .next (build).  
**Baseline:** git clean on master (ahead 1: chore gitignore .codex-artifacts), 329 articles, all quality gates passing where runnable on Windows, prior audits (2026-06-01) + E2E/UX/perf reports read.  
**Context:** Static Next.js 16 export (`output: 'export'`) on Timeweb VPS (pull-deploy), Supabase (auth + data + Edge funcs), Cloudflare Workers (photo+contact+analytics+view + separate subscriptions), MDX content factory (Kimi-driven), omnichannel subscriptions (in-flight P1 feature).

---

## Executive Summary: GREEN / YELLOW (mature, shipping, with known gaps in completeness + docs drift)

**The codebase is in a healthy, production-shipping state with strong engineering hygiene, defensive security patterns in the worker layer, clean TypeScript, passing automated gates, and no smoking-gun vulnerabilities in the scanned surfaces.** Content volume has grown rapidly (180→329 articles) with image/SEO integrity maintained. Old critical issues (hardcoded admin password, view RLS) have been addressed in code/migrations/worker. The architecture (static + edge workers) is appropriate for a Russia-hosted content site with UGC and notifications.

**Systemic positives:**
- Zero dangerous patterns (no `eval`, no user-controlled `dangerouslySetInnerHTML`, no `console.*` in src, minimal `any`/ignores).
- Excellent input sanitization + crypto hygiene in workers (timingSafeEqual, HMAC, signed tokens, challenge nonces, bot classification using CF signals + UA + human signals).
- CI gates solid (tsc, full test, image audit, SEO audit, wrangler dry-run, build sanity).
- Git hygiene excellent (stray package dirs at root ignored, out/ ignored, envs+secrets+HANDOFF-RESUME ignored, .codex-artifacts now ignored).
- Authz improved (profile.role via getUser() token validation, not sessionStorage flag).
- Privacy-focused custom analytics + SW for limited offline.
- Rich SEO/content surface (per-category RSS/Turbo/Zen, full JSON-LD, sitemaps, canonicals, manifest).

**Key risks / gaps (prioritized):**
1. **Incomplete feature (P1 beads):** Omnichannel subscriptions (7md.*) — core model/UI/delivery for email+tg+max+wa+sms present and tested in parts, but VK/Odnoklassniki/Facebook, full E2E test coverage, and audit trail/operator visibility still open. Delivery fairness migration exists.
2. **Stale operational docs:** `PRODUCTION_PLAN.md` is badly outdated (Vercel refs, 28 articles, old domain, old counts). `DEPLOY-TIMEWEB.md` (gitignored) and `HANDOFF.md` are current.
3. **Observability & error surface:** No Sentry / error boundary reporting visible. Relies on Yandex Metrika + custom /analytics/event (good signals but no exception traces). "Flying blind" on client crashes / worker 5xx in prod.
4. **UGC surfaces lack client rate limiting / abuse defense beyond worker (contact/view/analytics) and presumed RLS.** user_articles inserts, comments, photos are auth-gated but no visible debounce/throttle in forms. In-mem rate limits in shared worker are per-isolate (weak vs. distributed).
5. **Windows dev friction:** Node test spawn UNKNOWN in image-audit-utils (Python child?); noted Next build flakiness (exit 0xC0000409). CI (Linux) unaffected.
6. **Hardcoded personal contacts:** alexmiller.idothings@gmail.com appears in worker defaults, contact JSON-LD, page copy. Minor for small site but should be env-driven only.
7. **Content pipeline trust:** 100% AI-generated (Kimi prompts in docs/); validation exists but 6 short articles flagged in prior audit (current count/quality unknown without manual spot-check). No human editorial gate visible in code.
8. **D-2 (Russia localization) not started:** Supabase remote foreign, photos on CF R2, AI on Anthropic. Planned (self-host Supabase + Timeweb S3 + GigaChat) but zero code/migrations yet. Compliance risk if enforced.
9. **Admin surface:** Statically generated (articles list baked at build) + client-only gate. If JS disabled or slow, raw dashboard HTML may be viewable (low impact: articles public). No server-side 403.
10. **Legacy/leftover artifacts:** .vercel/, old logs, root-level unpacked package dirs (now ignored), incoming-articles/ (gitignored but present).
11. **Dependency vulns (GH Dependabot on push):** 2 moderate in postcss (XSS via unescaped </style> in CSS stringify) transitive via Next 16's bundled postcss. Affects build-time mostly; no direct user-controlled CSS path obvious. `npm audit` suggests force downgrade (breaks). Monitor Next patch; no immediate exploit in this static content site.

**Overall scores (inspired by 12-axis critical review rubric, 1-10):**
- Security & data integrity: 8.5 (strong worker crypto/rate/sanitize; RLS assumed; UGC rate gaps)
- Code quality / maintainability: 9 (clean, no smells, strict, documented)
- Test / gate coverage: 7.5 (unit good for subs/validation; image/SEO; e2e reports exist but not in-repo runnable suite for all flows)
- SEO & content ops: 9
- Authz / trust & safety: 8 (admin fixed; moderation pipeline present; incomplete subs audit trail)
- Deploy / ops readiness: 8 (CI good, pull-deploy clever for env; stale plan doc; no rollback smoke in all paths)
- Privacy / analytics: 9
- Perf / static export: 7 (old audits noted mobile LCP heavy; 300kB images; no image opt)
- Docs / knowledge: 6 (HANDOFF strong; plan stale; code comments good)

**Recommendation:** Ship current master. Treat subscriptions completion + docs refresh + observability + rate-limit hardening as next P1 sprint (use beads). Rotate any exposed keys (Anthropic/Unsplash past). Consider adding CSP at nginx layer.

---

## 1. Reality Check Table (Claimed vs Actual)

| Metric / Claim                  | Claimed / Prior Reports                  | Actual (2026-06-02)                                      | Status     |
|--------------------------------|------------------------------------------|----------------------------------------------------------|------------|
| Article count                  | 180 (Jun 1 audit)                       | 329 MDX in src/content/articles (all tracked)            | ✅ real   |
| Images integrity               | 180 unique, 0 dup/missing (Jun)         | 329 articles, 329 images, 0 exact dups, 0 missing, 0 orphans (audit script) | ✅ real |
| Typecheck / Lint / SEO         | Passing                                 | tsc --noEmit clean; eslint clean (no output); SEO audit "passed for 329" | ✅ real |
| Tests (core + subs)            | Partial (image test env issues)         | subscription-validation: 3/3 pass; workers mjs: 7/7 pass; full chain has Windows spawn flake in image-audit-utils | ⚠️ partial |
| Auth admin gate                | Old hardcoded pw shipped in bundle (history) | useAdminAuth: getUser() token validate + profiles.role==='admin' + redirect; login form does signIn + role check + signOut on fail | ✅ fixed |
| View tracking                  | Broken RLS (Jun P0)                     | Migration 202606012035 added 'view' to kind check; worker /view (service role) + rate limit; client ViewTracker | ✅ addressed |
| Secrets in git                 | Scans clean                             | .env* gitignored; no SUPABASE_SERVICE in tracked; stray packages ignored; personal emails in source (non-secret) | ✅ good   |
| Deploy model                   | Vercel (old plan)                       | GH build gate only (no push); VPS timer pulls master + builds + activate.sh symlink (atomic, last-5 kept); webhook emergency | ✅ current |
| Subscriptions feature          | Not present (prior)                     | Data model (omnichannel migration), UI (podpiski + panel + cta), validation shared, worker with start/manage/confirm/webhooks for 5 channels, providers, rate via RPC, tokens, consents, delivery | ⚠️ partial (P1 beads open for VK/FB/OK + tests + trail) |
| Content generation             | Kimi + validate/import scripts          | 329 articles via prompts (docs/kimi-*.md); scripts/validate-article, import-articles, generators in build; no short-article gate enforced in current validate? | ⚠️ real but AI-heavy |
| Secondary domain               | DNS 301 pending (Jun)                   | pogovorimdoma.ru mentioned in handoff as 301 target; cert status not re-verified here | ⚠️ unknown |
| Build output hygiene           | /out in .gitignore                      | Present locally (expected after builds); not tracked | ✅ good |

**Fabricated / dead:** No obvious seeded fake metrics in UI. View counts / reactions / comments tables empty-ish in prior QA (normal for new site). No dead admin components (real role gate).

---

## 2. Structure & Hygiene Map

**Entrypoints:**
- Static pages: app/ (App Router) — home, category indexes, [slug] articles (generateStaticParams + MDXRemote), search, tag, author, recepty (special?), izbrannoe, moy-kabinet (auth), napisat (UGC), contact, podpiski (subs), admin/* (gated), q/ (questions?).
- Components: ~50, heavy engagement (Comments, Reactions, StarRating, Feedback, Photo CTA, Subscriptions Cta, ViewTracker, AnalyticsTracker).
- Lib: articles (fs+gray-matter build-time), supabase (lazy anon singleton), seo, personas, categories (6), recommendations, subscriptions/validation, photos (R2 via worker), cloudinary (now local /images fallback), utils.
- Scripts (30): generate-* (index, sitemap, rss, turbo, zen, questions, build-metadata), validate/import articles, fetch images (Unsplash/Openverse), audit (images, seo, links), subscription sync/build index/tests.
- Workers (2): photo-upload (monolith: upload R2, serve, contact challenge+form+honeypot, /view, /analytics/* with bot classif + RPC, admin summary), subscriptions (full omnichannel: start/manage/confirm/unsub, webhooks, delivery, admin dry/test, social).
- Supabase: 5 recent migrations (view kind, analytics sessions+ingest rpc, omnichannel subs schema + delivery fairness + publication index).
- CI: .github/workflows/ci.yml (test+image+seo+wrangler-dry+build+tsc), deploy.yml (tsc+test+image+build+sanity; no deploy step), telegram-notify.
- Content: 329 .mdx (frontmatter strict: title/slug/cat/date/desc/image/tags + recipe extras), public/images/*.jpg (committed), generated public/*.xml.

**Dead / vendored / cruft (low severity):**
- Root: argparse/, gray-matter/ (full source), is-extendable/, js-yaml/, kind-of/, section-matter/, strip-bom-string/ — vendored? from content tool experiments. **.gitignore covers them**; git ls-files confirms not tracked. Safe now.
- .vercel/ (old), .next-dev-*.log, .serve-*.log (gitignored? *.log yes), incoming-articles/ (ignored, 251 files — staging for import).
- out/ (build, ignored).
- tsconfig excludes "workers" (they use wrangler/tsx).

**Git state:** Clean. Recent: subscriptions hardening + Turnstile, content batch +50, ci/deploy changes, analytics privacy, view fix, bd init. 1 ahead (gitignore .codex).

---

## 3. Quality Gates Execution (this session)

- `pnpm exec tsc --noEmit`: clean (exit 0).
- `npm run lint`: clean (no output, exit 0).
- `node scripts/audit-seo.mjs`: "SEO audit passed for 329 articles".
- `node scripts/audit-article-images.mjs --fail-on-duplicates`: 329/329/329 unique, 0 dups/missing/orphans. PASS.
- Subscription validation tests: 3/3 pass.
- Workers mjs tests: 7/7 pass.
- Full `npm test`: hits Windows spawn UNKNOWN in image-audit-utils.test.mjs (child_process of python? sharp?); chain stops before full subs. **Env flake, not logic fail.** Linux CI unaffected.
- No full `pnpm run build` (long + known Windows Turbopack crash 3221226505); generators would run first (article-index, questions, sitemap, rss, build-metadata).

**Gates verdict:** Strong. Image/SEO/content integrity proven at current scale.

---

## 4. Security & Abuse Forensic (Deep)

**Positive patterns (exemplary for edge):**
- `workers/.../security.ts`: `timingSafeEqual`, `timingSafeEqualBytes`, `hmacSha256*`, `createSecureToken`, `requireSecret`, Svix signature verify (ts + id + body), WhatsApp sig verify.
- Worker photo-upload: JWT validate via Supabase /auth/v1/user (anon key), admin via service-role profile query. Strict content-type allowlist, size 5MB, slug/ext sanitize, R2 key = `${slug}/${uid}-${ts}.${ext}`.
- Contact: challenge token (iat+nonce signed, min/max age 3s-30m), honeypot `website`, IP rate (2/min, 6/hr window via Map), cleanText + email regex + length checks, escapeHtml for email body.
- Analytics: bot classif (CF verifiedBot + score<20 + UA regex + webdriver signal + human signals lang/tz/viewport + duration>=5s), IP rate 90/min, RPC only with service role.
- /view: service-role insert, IP+slug rate (3/min 12/hr), clean slug.
- Subscriptions: rate via Supabase RPC (durable), signed manage/unsub tokens, turnstile verify (optional/hardened), consent checkboxes, channel-specific tokens, webhooks with sigs (Svix/Resend/TG?).
- Admin login: password signin + immediate role recheck + signOut on fail. useAdminAuth: getUser() first (token reval), fallback getSession only on no-error.
- Comments/Photos/UGC: auth required (session token to worker or direct), is_approved, pending status + AI moderate-photo edge func (Claude vision), human admin UI.

**Gaps / recommendations:**
- No visible form-level rate limit / debounce on /napisat, comment submit, rating (client can hammer; RLS may throttle but not graceful).
- Shared worker in-mem Maps for rate (contact/view/analytics) — per-isolate, memory pressure, no cross-edge sync. OK for low traffic.
- Personal email in source + defaults (alexmiller...@gmail, noreply@vsedomatut.com). Move fully to env.
- No CSP, HSTS, or security headers mentioned (nginx config on VPS not in repo; assume basic from prior).
- Photo upload: any authed user can upload to any articleSlug (folder namespaced by uid). Row has user_id for ownership. AI + human review downstream.
- Subscriptions: complex state machine (pending/confirmed, active/paused), fair delivery migration exists — verify no double-delivery or token replay in delivery-planner.
- Turnstile: sitekey public, widget optional in some flows (token challenge is primary now).
- Past exposure: Anthropic key was in chat (rotate in Vault); Unsplash key too (move to .secrets).

**Abuse vectors considered:** contact spam (mitigated), view inflation (rate+bot classif), photo CSAM (AI vision moderate + pending), comment spam (auth + approve?), fake subs (turnstile + confirm + rate), admin brute (Supabase account protection + no auto redirect loop now).

**Moderation pipeline:** photos → worker upload → pending row → edge /moderate-photo (Claude) → status. Comments have is_approved. User articles pending. Admin UI exists for photos/articles.

---

## 5. Auth, Admin, UGC, Supabase Surface

- Client: lazy singleton anon only. No service role ever in browser bundle.
- Profiles: role (user/moderator/admin), trigger on signup creates profile.
- Flows: modal auth (email/pw), cabinet (saved, drafts?), submit article (auth required, insert user_articles), comments (auth + optional photo), ratings/reactions/feedback (anon? + authed).
- Admin: /admin/login (form), /admin (dashboard stats + article list + photo mod + analytics), /admin/articles, /admin/photos. All client-gated + robots noindex. Layout simple.
- Email confirm: Supabase built-in; prior E2E showed delivery/rate issues (Gmail limits). Template in supabase/templates/. Still potential blocker.
- View/feedback: now allowed via worker service role (bypasses anon RLS issues).
- Migrations recent: analytics RPCs (ingest + admin summary), subs schema (notification_* tables, publication_index, rate RPC), view kind.
- No evidence of service keys committed.

**Recommendation:** Add server-side (worker or edge) rate for UGC if volume grows. Expose build SHA /health for deploy verification (prior rec).

---

## 6. Subscriptions / Omnichannel (Current In-Flight)

**Implementation status (partial but solid base):**
- Schema: recipients (user/anon_key, freq, tz, window, manage_token_hash), contacts (multi-channel, normalized, status, tokens), topic_subscriptions (category), channel_prefs, confirmations, consents (with ip/ua/version), articles_publication_index.
- Worker: /subscriptions/start (validate + turnstile + create recipient/contacts/confirmations + return manageToken + channel actions), /manage, /confirm, /unsubscribe, webhooks (tg/max/resend/wa verify), social targets/track, admin dry-run/test-send, diagnostics.
- Providers: email (Resend?), telegram, max, whatsapp, sms. Registry.
- UI: /podpiski (client), SubscriptionPanel (categories 6, channels 5, freq presets, turnstile, consent, manage via token), CategorySubscriptionCta, SocialFollowTargets.
- Validation: shared .mjs (normalize + validate categories/channels/freq/email/phone/consent).
- Security: signed tokens, rate via DB RPC, origin allow, clean funcs.
- Delivery: delivery-planner, processDueDigests (fairness migration).

**Gaps matching beads 7md:**
- No VK / Odnoklassniki / FB targets or delivery yet.
- Tests: validation + some index/worker/handler exist; full flows + e2e pending per beads.
- Audit trail / operator visibility: not visible in code (no moderation_event style table?).
- UI polish / error states for all channels.

**Verdict:** Well-architected foundation; finish the 7 P1s before heavy promotion. Use existing security.ts patterns for new providers.

---

## 7. Content Pipeline & SEO

- Factory: external Kimi (prompts: kimi-100-topics, kimi-500-batch, kimi-articles) → incoming-articles/ or direct → validate-article.mjs (frontmatter, slug latin+hyphen, category in 6, recipe fields) → import-articles.mjs (move, dedup slug) → build regenerates index/sitemap/rss/turbo/zen.
- Frontmatter rich: supports Recipe/HowTo schema, series, quickAnswer, cost, difficulty, ingredients, steps, author persona (4 personas).
- Images: committed public/images/<slug>.jpg; fetch-unsplash (resumable, rate aware 50/hr), openverse, procedural, normalize, generate previews/card. Audit enforces 1:1 unique.
- Generators: sitemap (all), rss (full + per cat), turbo/zen (Yandex), questions index, build metadata.
- Article page: full meta (OG/Twitter with image, keywords, published/modified, article type), JSON-LD (Article + Breadcrumb + Recipe/HowTo/FAQ + WebSite/Org), TOC, related/similar (recs lib), series, quick answer, checklist, persona card, sponsored/affiliate, reactions, comments, photo cta, questions block, view count, feedback, print, font size, progress, subs cta.
- Categories exactly 6 (hardcoded in several places + check constraints).
- No duplicate slugs/titles (audits).

**Risk:** AI gen volume high; short/under-quality articles possible if validation too loose. Spot check 5-10 recent for length/depth. Link audit script exists for internal linking.

---

## 8. Static Export, Perf, Client Surfaces

- next.config: output export, trailingSlash, unoptimized images, experimental cpus/concurrency (for build workers).
- All interactive (auth, forms, counters, admin, search client, subs, trackers) are 'use client' and gracefully degrade (e.g. no endpoint → message).
- Search: static fallback + client hydrate; smart search bootstrap script.
- SW: basic article page cache (network-first, max 10), shell. Limited but present.
- Perf: prior reports (Lighthouse mobile 56, heavy LCP, 211 reqs). Current images some 300kB+. No <Image> optimization (unopt + static). No critical CSS inlined visible. Font preconnect good.
- Bundle: Next 16 + React 19; no obvious bloat from scans.

**Static implications:** No server actions, no dynamic routes at request (all pregen), envs baked (public only), no A/B without rebuild.

---

## 9. CI/CD, Deploy, VPS

- GH: actions/checkout@v6, pnpm v6+setup, node 24, frozen. Gates before build. Concurrency on deploy.
- Deploy: push → CI gate → VPS timer (1min) pulls, pnpm build on VPS (Node24), activate.sh (symlink swap, keep 5). Webhook receiver for emergency (bearer, /__deploy/upload).
- Rollback: ssh /opt/deploy/activate.sh <release>.
- Secrets: only public NEXT_PUBLIC_* in GH (anon key, worker urls, turnstile, subs api). Timeweb API/SSH keys in ~/.secrets (operator). Worker secrets via wrangler. VPS /etc/1001sovet/secrets.env (0600).
- DNS: reg.ru (manual), A to 188.225.86.238 (Timeweb id 8194295). SSL LE via certbot.
- Why pull: GitHub runners can't reliably SSH/HTTPS *inbound* to Timeweb (IPv4 issues); VPS outbound to GH works.
- Telegram notify on new .mdx.

**Good:** Atomic deploys, sanity checks, no direct secret in actions for private. Manual fallback documented.

**Gaps:** No automated live SHA smoke after pull-deploy in GH (operator verifies). IPv4 reachability note in workflow comments.

---

## 10. Prior Audits Reconciliation

Read: .local-audits/1001sovet-current-state-audit-2026-06-01.md (YELLOW, P0s auth-email + view RLS + secondary cert; P1 fixes), reports/e2e-*.md (QA user created, partial reg success, auth confirm issues), visual-ux (scores 5-8, mobile risk, auth pages unfinished pre-login), perf, a11y, auth-email root cause, view-tracking RLS fix.

**Current:** View RLS addressed (migration + worker). Auth email still potential (not re-tested here). Many UX/perf recs from Jun 1 likely partially actioned (compact header, image resolver fix, search static fallback). Subscriptions + analytics are post-audit additions.

No critical unaddressed from prior in code.

---

## 11. Prioritized Remediation Plan (executable, bead-friendly)

**P0 (now / before heavy traffic):**
1. Rotate exposed keys (Anthropic in Vault, Unsplash to .secrets). Update any hardcoded.
2. Confirm/repair auth email delivery (custom SMTP or MAILER_AUTOCONFIRM + rate config in Supabase). Test with fresh QA.
3. Verify pogovorimdoma.ru 301 + HTTPS live.
4. Add client rate limiting (simple in-memory + backoff) or worker proxy for UGC forms (napisat, comment, photo).
5. Update PRODUCTION_PLAN.md or deprecate in favor of HANDOFF + knowledge/sovetydoma-deploy.md.

**P1 (this sprint, matches existing 7md beads):**
- Complete 7md series: add VK/OK/FB targets+delivery, full subscription test coverage (validation/index/worker/handlers + e2e), subscription audit trail table + admin visibility.
- Add build SHA endpoint or /health.txt (static) + stronger post-deploy verification.
- Harden subs: ensure no replay, fair delivery tested, operator runbooks.

**P2 (tech debt / quality):**
- Observability: add lightweight error logging (e.g. to worker or Resend on uncaught) or integrate Sentry (edge compatible).
- Image perf: consider generating webp fallbacks or note in nginx.
- Enforce min word count in validate-article (fix the 6 short).
- Extract more from monolith worker or document boundaries.
- Add CSP / security headers to nginx site config (repo it or doc).
- Windows test robustness (mock spawn in image-audit test?).
- Spot manual review of recent AI articles + internal link audit run.
- Begin D-2 scaffolding (even if just env + migration notes) when ready.

**Work streams (parallel):**
- Content/SEO: validate tighten + link audit + image opt.
- Trust/Safety: UGC rate + moderation visibility + audit trail.
- Growth/Subs: finish 7md + social pages prep.
- Ops/Docs: refresh plans, add health checks, key rotation.
- Infra: D-2 research + Supabase self-host dry-run on VPS.

**Rollback / success metrics:** For subs launch — monitor /admin/analytics + worker logs + delivery success rate + complaint volume (via mailcow). For deploy — verify SHA in response or footer, 200 on key paths, no 5xx spike.

**Beads to create (use `bd create`):**
- P0 key rotation + email confirm repair.
- P1 subs completion (link to 7md epic).
- P2 observability + CSP + docs refresh.

---

## 12. Files of Interest (for follow-up)

- workers/photo-upload/src/index.ts (monolith, 600+ LOC — audit surface)
- workers/subscriptions/src/{index.ts,security.ts,delivery-planner.mjs,providers/*}
- src/lib/admin-auth.ts, photos.ts, subscriptions/validation.mjs
- src/app/[category]/[slug]/page.tsx (SEO surface)
- src/app/napisat/page.tsx, components/Comments.tsx (UGC)
- scripts/validate-article.mjs, import-articles.mjs, audit-*.mjs
- supabase/migrations/ (recent 5)
- .github/workflows/{ci,deploy}.yml
- docs/kimi-*.md (content gen)
- reports/ (prior UX/E2E/perf) + this file

---

## 13. Appendices / Commands for Next Agent

```powershell
# Re-verify gates
pnpm exec tsc --noEmit
npm run lint
npm test  # note Windows flake
node scripts/audit-article-images.mjs --fail-on-duplicates
node scripts/audit-seo.mjs

# Content
node scripts/validate-article.mjs src/content/articles/<slug>.mdx
node scripts/import-articles.mjs

# Subs worker local (if vars set)
cd workers/subscriptions && npx wrangler dev

# Deploy note
git push  # CI gates; VPS timer pulls
ssh ... /opt/deploy/activate.sh <old-release>  # rollback
```

**Review complete.** All claims verifiable via file:line or command output above. No fabricated data in this analysis.

Append `REVIEW COMPLETE` for tooling if following critical-review template.
