# SovetyDoma Deep Forensic Subagent Scan — 2026-06-04

**Date:** 2026-06-04  
**Lead:** Grok 4.3 (main) + 3 specialized subagents (background, execute capability only — read/list/grep/run non-mutating analysis; zero file edits or state changes)  
**Subagents:**
- Security Forensic (id 019e9128-8a7f-7f50-8713-98dd1b64cde7): 278s, 107 tool calls, full workers (photo 605 LOC + subs 912 LOC), auth, UGC, RLS/migrations, crypto/rates, admin.
- Content Pipeline & Integrity (id 019e9128-ad1c-7153-9e1b-92fba195e728): 420s, 136 tool calls, 329 MDX full scans + generators/audits/validate/import/image scripts + Kimi prompts + encoding.
- Code Quality / Bugs / Hygiene (id 019e9128-d250-7541-ac18-3ed8f71ae5b2): 296s, 90 tool calls, full src/components/lib/app, dupe lists, state, cruft, package manager, docs drift, 'use client' bloat, tests.
**Main agent contributions:** Session protocol (x2), gates re-runs (tsc/lint/audits/tests clean), word-count batch (29 shorts), mojibake/ garble confirmation, direct UGC insert paths (Comments etc), stray package version match, package-lock tracked, sample validate fails, npm-run grep, final synthesis + bead creation + HANDOFF/report update.
**Total depth:** 300+ tool calls (reads with offsets for 600-900 LOC files, targeted + broad greps 20+ patterns, node -e batch parses of all 329, full script execution of audits/validate/test samples, git hygiene, bd queries). All non-mutating. Session start protocol executed (knowledge bd list + project bd prime/ready + HANDOFF reads).

**Baseline:** git clean on master. 329 articles (src/content/articles/), 6 categories, Timeweb static nginx, Supabase + 2 CF workers (photo monolith + subscriptions omnichannel), prior full forensic 2026-06-02 (report + beads csv/3ch/5r9/xoq/7md.* /rnh). No code changes since that review.

## Executive Summary
Mature, shipping, high-hygiene codebase (tsc/lint/SEO/images/subscription tests all pass at 329 scale; 0 `any`/ts-ignores/dangerouslySetInnerHTML/user-controlled innerHTML/eval in src+workers+scripts; excellent crypto/sanitize in workers; strong getUser() admin gate; lazy anon-only Supabase client).

**New/quantified issues found by subagents + main (all fixable, prioritized):**
- **Content quality (P0/P1):** Exactly 29 articles <300 words (0 <200w); 2 with *real full mojibake corruption* in title/desc/categoryName/tags (kak-ne-peregretsya-v-zharu-doma.mdx, poryadok-v-igrushkah.mdx — display as garbage in SEO/OG/JSON-LD/rss). Import (200w, no mojibake) diverges from validate-article (300w hard + mojibake regex + H2 warn, updated post-prior forensic). 58 image frontmatter drifts (fm `image` != `/images/<slug>.jpg`; causes emoji fallbacks despite "329/329 unique" audit pass). Sitemap + RSS generators hardcode 5 categories (miss 'rybalka' entirely — no /rybalka/ hub + no feed-rybalka.xml despite 36 articles + categories.ts having it). Audit-links prefixes outdated (0 manual internal links detected in entire corpus).
- **Hygiene / infra (P1/P2):** "npm run" inside package.json test scripts + many docs/plans (while pnpm is the tool, lock, CI, handoff). package-lock.json is tracked (279KB bloat + skew risk with pnpm-lock.yaml). 7 root stray package source dirs (argparse/, gray-matter@4.0.3 exact dupe of node_modules, js-yaml/, kind-of/, section-matter@1.0.0 (no node copy), is-extendable/, strip-bom-string/) — untracked but pollute tree, historical extract cruft.
- **State / UX / maintain (P1):** Favorites/bookmarks localStorage + server saved_articles desync (no migrate on login; anon saves lost cross-device). Category slug lists duplicated (categories.ts + subscriptions/constants.mjs + validation + components). 56 'use client' (heavy for static content site; trackers fire everywhere).
- **Security / UGC (P1, matches open beads):** Direct browser .from().insert for comments/user_articles/photos/feedback/ratings/reactions (RLS presumed, not versioned in git for core tables; only recent subs/analytics migrations have explicit policies). In-mem rates in photo worker (per-isolate). No client debounce beyond submit flag. Personal emails still in source/toml/defaults.
- **Other:** RLS for UGC still "presumed" + unversioned (prior risk). Stale metrics/numbers across many reports + inside HANDOFF (~160 vs 329, 5 cats vs 6, old domains). No build enforcement of quality gates. Incoming-articles/ heavily corrupted (250 suspects).

**Gates (re-run in main + subs):** pnpm exec tsc --noEmit (0), pnpm lint (0), node scripts/audit-article-images --fail-on-duplicates (329/329/0 dups/missing/orphans), node scripts/audit-seo (passed for 329), subscription validation/index tests (3/3 + 2/2), workers mjs tests (prior 7/7). Windows flakes isolated to image-audit-utils spawn (not hit in current --test samples).

**Posture delta vs 2026-06-02 forensic:** GREEN/YELLOW holds, no regressions, no new critical vulns. Subagents amplified prior gaps with exact counts/lines (29 shorts vs "6 flagged + unknown", 58 drifts, rybalka omission, import mismatch, package-lock tracked, fav desync details, category dupe). New P0/P1 surfaced in content/hygiene. Open beads (csv/3ch/5r9/xoq/7md series) still accurate targets.

**Recommendation:** Create/close beads below; fix content corpus + gates first (P0 data integrity + SEO); then UGC proxies/rates + RLS versioning + hygiene (pnpm, cruft, locks, docs). Re-audit after. Architecture still sound for the site.

## Key Quantified Stats (from subagent scans + main batch)
- Articles: 329 (fs + index + audits consistent)
- Short (<300w): 29 (exact; e.g. domashniy-mayonez-bystro:207, grechka-po-kupecheski:229, ...; 0 <200w)
- Mojibake/garble in prod: 2 (full corruption in fm title/desc/tags/categoryName)
- Image fm drift: 58 (fm.image != expected /images/<slug>.jpg or "placeholder")
- Garbled in incoming: ~250 (widespread)
- 'use client' files: 56
- Category hardcode sites: 6 (but lists duplicated in >=4 places)
- Stray root dirs: 7 (exact version matches for direct deps)
- package-lock tracked: yes (279KB)
- Direct client UGC inserts: comments, user_articles, feedback_events (anon), ratings, reactions, saved_articles (photos via worker then insert)
- In-mem rate Maps: photo monolith (contact/view/analytics); subs use durable RPC (good)
- Generators missing rybalka: sitemap, rss (turbo/zen also limited)

## Top Fixable Errors (P0/P1 prioritized; file:line or script from reports)
(See individual subagent reports for 100+ detailed findings with evidence snippets + exact fixes.)

**P0 (immediate data/SEO/integrity):**
- 29 short + 2 mojibake articles live in src/content/articles/ + import/validate divergence (import-articles.mjs:45 vs validate-article.mjs:54-62; scripts/validate-article.mjs:58 mojibake regex). Main batch + content sub confirmed 29/2.
- 2 corrupted articles (kak-ne-peregretsya-v-zharu-doma.mdx, poryadok-v-igrushkah.mdx) — full mojibake in critical fm (title etc).
- Sitemap/RSS omit rybalka (generate-sitemap.mjs:10, generate-rss.mjs:10 hardcode 5 cats; 36 articles affected, no hub/feed).

**P1 (quality, rate, state, hygiene):**
- 58 image frontmatter drifts (multiple fm vs slug.jpg; audit passes on fs only; cloudinary/ArticleImage fallback hides; see content sub #4).
- "npm run" in package.json:10/15 + docs/operations/*.md + superpowers/plans + HANDOFF (quality sub P2; main grep 21+; causes runner skew).
- package-lock.json tracked + no ignore (quality sub).
- 7 stray root package dirs (exact dupes/cruft; quality + prior noted as ignored but present; main version match).
- Favorites localStorage <-> saved_articles desync + no migrate on auth (CardFavoriteButton.tsx, izbrannoe/page.tsx; quality P1).
- Category slug duplication (categories.ts + subscriptions/constants.mjs + validation + hard lists; quality P1).
- UGC writes direct from browser (Comments.tsx:229-231 insert, similar in UserArticleForm/napisat/Feedback/StarRating; security sub P0 + xoq bead).
- In-mem rates + no client throttle on forms (photo-upload worker + components; security).
- RLS for core UGC not in git/migrations (only subs/analytics recent have explicit; security P1).
- Audit-links broken/outdated + 0 manual internal links in 329 (content sub #6).
- Stale numbers in reports + HANDOFF (180/5cats/vercel vs 329/6cats/Timeweb; quality P2 + main).
- Crude turbo/zen mdToHtml + CDATA risk (content #7).
- Legacy direct admin writes (client after useAdminAuth; security P2).

**P2/P3:** More in sub reports (personal emails, permissive origins in wrangler, no CSP in repo, test coverage gaps, long monoliths, etc.). Postcss moderate transitive (unchanged, low exploit here).

## New/Updated Beads Created (via bd create; linked to sovetydoma-rnh tracker)
(See bd list after for IDs. Descriptions reference subagent evidence + counts.)

(Commands executed; exact titles/descriptions from sub recs + main data. Priorities 0/1 per impact.)

- P0 content gate + corpus: "Sync validate + import to 300w hard error + mojibake + image-slug-match + H2; fix 29 shorts + 2 mojibake in prod; add to CI/audit-seo/build"
- P1 generators: "Fix sitemap + RSS (and turbo/zen) to derive categories from lib/categories.ts (include rybalka); emit full hubs + per-cat feeds"
- P1 assets: "Enforce + fix image frontmatter drift (58 cases) in validate/import/audits + Kimi prompts"
- P1 hygiene: "Replace all inner 'npm run'/'npm test' with pnpm equivalents in package.json + docs/plans/HANDOFF/README; add packageManager field"
- P2 hygiene: "git rm package-lock.json + add to .gitignore (pnpm-only project)"
- P2 hygiene: "Remove 7 stray root package source dirs (argparse/ gray-matter@4.0.3 exact dupe, js-yaml/, kind-of/, section-matter/, is-extendable/, strip-bom-string/); safe post-dep"
- P1 state: "Add auth/login favorite sync: migrate localStorage 'favorites' to server saved_articles upsert + clear local (CardFavoriteButton + izbrannoe/moy-kabinet)"
- P1 security: "Add server-side worker/edge proxies + durable rate limiting for high-risk UGC writes (comments, user_articles, feedback_events, ratings, reactions, photos, questions) + client debounce on forms (Comments, napisat, etc.)"
- P1 security: "Version-control + CI-audit all RLS policies for UGC tables (or migrate writes to RPCs/proxies); document current state"
- P1 content: "Tighten remaining gates (wordCount in article-index + SEO audit; require internal links in validate + Kimi prompts; fix audit-links prefixes)"
- P0/P1 follow-ups: updates to existing (csv, 3ch, 5r9, xoq, 7md.*) with subagent counts/evidence; close 5r9 after corpus + gate sync.

Also updated sovetydoma-5r9 and sovetydoma-xoq notes with 2026-06-04 subagent findings (29 shorts, import mismatch, direct inserts, etc.).

## Files of Interest (for next work)
- scripts/validate-article.mjs + import-articles.mjs (sync + legacy fix)
- scripts/generate-sitemap.mjs + generate-rss.mjs + generate-turbo.mjs + generate-zen.mjs
- scripts/audit-article-images.mjs + audit-seo.mjs + audit-links.mjs + image-audit-utils.mjs
- src/content/articles/ (29 shorts + 2 garbled + 58 image drift)
- package.json (npm run), .gitignore (package-lock), root stray dirs
- src/components/CardFavoriteButton.tsx + app/izbrannoe/page.tsx (fav sync)
- src/lib/categories.ts + workers/subscriptions/src/constants.mjs + validation.mjs (dupe)
- src/components/Comments.tsx + UserArticleForm.tsx + app/napisat/page.tsx (UGC direct)
- workers/photo-upload/src/index.ts + subscriptions/src/{security.ts,rate-limit.ts,delivery-planner.mjs,index.ts}
- supabase/migrations/ (add RLS for UGC)
- .github/workflows/ci.yml + deploy.yml (add quality gates?)
- HANDOFF.md + reports/ + docs/ (stale numbers)
- src/lib/supabase.ts + admin-auth.ts (good patterns)

## Commands for Next Agent / Verification
```powershell
cd C:\DEV\sovetydoma
# Re-verify
pnpm exec tsc --noEmit
pnpm lint
node scripts/audit-article-images.mjs --fail-on-duplicates
node scripts/audit-seo.mjs
node --test scripts/subscription-validation.test.mjs scripts/subscription-publication-index.test.mjs
node -e ' ... word count + mojibake scan ... '   # see content sub report

# Content
node scripts/validate-article.mjs src/content/articles/<bad-short>.mdx
node scripts/import-articles.mjs --dry   # test new logic
# Fix shorts/garble/image fm (manual or script), then
git add src/content/articles/ && git commit ...

# Hygiene
# edit package.json (pnpm), .gitignore; rm -rf the 7 strays; git rm package-lock.json
pnpm install --frozen-lockfile  # re-lock if needed

# Beads
bd list --status=open
bd show <new-id>
bd update sovetydoma-5r9 --notes="..." --claim
bd close sovetydoma-5r9 --reason="subagent scan + corpus fix + gate sync complete"

# Deploy note
git push  # CI gates; VPS timer pulls + builds
```

**All protocol followed:** bd prime/ready/list in knowledge + project at start/end; HANDOFF read; git commit + push at end (this change); no TodoWrite; discoveries via beads + this report; subagents used for max depth.

**End of scan.** Update HANDOFF section, close beads, ship fixes. Prior 06-02 report + rnh bead remain relevant.

(Full subagent transcripts contain 300+ lines of evidence, greps, read excerpts, run outputs. This is the synthesized actionable view.)