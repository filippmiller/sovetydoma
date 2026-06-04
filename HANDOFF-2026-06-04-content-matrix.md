# HANDOFF — Content Matrix autonomous factory (image-first)

**Date:** 2026-06-04
**Branch:** feat/content-matrix-pipeline
**Beads:** sovetydoma-ywl (epic), sovetydoma-p8c (5000 ideas + 100 articles)
**Design:** `docs/content-matrix-design.md` (+ ADDENDUM with locked decisions)
**CLI ops doc:** `C:\dev\knowledge\kimi-grok-cli-headless.md`

## What this is
A persistent, agent-fillable article matrix in Supabase (`content_matrix`) replacing the ad-hoc file-drop factory. **Image-first**: Grok pre-generates images; an image being ready triggers Kimi to draft that article. Scales to 50k; current target 5000 idea slots + first 100 full articles for верticals дача/огород/дом/рецепты.

## Agent roster (verified working)
- **Kimi** (`kimi.exe`, Windows) — Russian ideas + drafts. MUST run via PowerShell/native console (git-bash hangs it). `kimi --quiet --input-format text` reading a UTF-8 prompt FILE (stdin pipe corrupts Cyrillic). Slow (~3-6 min/call).
- **Grok** (WSL `/usr/local/bin/grok`, run -u root) — code + images. Images via embedded `imagine` skill: run with FULL default toolset (no `--tools`/`--disallowed-tools`/`--disable-web-search`), else the skill won't load. Output → `~/.grok/sessions/.../images/N.jpg` → cp to target.
- **Claude** — orchestration, reviews, DB/migrations.

## DB (Supabase project plwkjdpuxjkmpkqiqzkk = "sovetydoma")
- Migration `supabase/migrations/20260604105305_content_matrix.sql` — APPLIED to prod. 3 orthogonal axes: `text_status`, `image_status`, `disposition`. `frontmatter jsonb`. pg_trgm. Views: `v_images_to_generate`, `v_ready_to_write` (image-first), `v_publish_queue`. Audit: `content_matrix_events`.
- Seeded 329 live MDX → `text_status='published'` (12 flagged `needs_rework`). `image_prompt` bootstrapped from QUERY_MAP.
- Service role key in `.env.local` (gitignored): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Scripts (scripts/matrix/)
| File | Role |
|---|---|
| `lib.mjs` | env loader, service client, wordCount, mojibake, vertical map |
| `seed-from-current.mjs` | seed 329 live MDX (`npm run matrix:seed`) |
| `insert-ideas.mjs` | ingest Kimi idea JSON, dedup (slug + JS trigram title-sim 0.5) |
| `count-ideas.mjs` / `pick.mjs` / `mark.mjs` | counts, queue fetch, row update+event |
| `gen-images.mjs` | Grok image per row → public/images/<slug>.jpg → image_status=generated |
| `ingest-draft.mjs` | read Kimi .md → body_md, word_count, text_status=draft |
| `export-to-mdx.mjs` | matrix rows → validator-clean MDX in matrix-exports/ |
| `run-idea-gen.ps1` / `run-images.ps1` / `run-drafts.ps1` | the loop drivers |

Inputs: `.matrix-ideas/taxonomy.txt` (40 subtopics × 4 verticals), `prompt-template.txt`, `draft-template.txt`. `.matrix-ideas/` gitignored.

## Proven end-to-end (2026-06-04)
Idea (Kimi, 57, 0 dupes) → image (Grok, real 1408×768 JPEG) → v_ready_to_write → draft (Kimi, 576-word quality) → export MDX → **passes `node scripts/validate-article.mjs`**.

## Running detached (PIDs in .matrix-ideas/*.pid)
- `run-idea-gen.ps1` → 5000 idea slots; log `.matrix-ideas/idea-gen.out.log`
- `run-images.ps1` → 100 images; log `.matrix-ideas/img-gen.out.log`

## NEXT
1. After ~100 images: `run-drafts.ps1 -Limit 100` (pause idea-gen to avoid Kimi contention).
2. Optional Grok review → approved.
3. `export-to-mdx.mjs --status draft --limit 100` → validate → move to `src/content/articles/` → build → commit → deploy → mark published.
4. Monitor: `node scripts/matrix/count-ideas.mjs`.

## Gotchas
- Kimi: PowerShell only; prompt via FILE not stdin. Agentic/yolo — give it a file to write.
- Grok images: full default toolset only.
- WSL `/tmp` ≠ git-bash `/tmp`; share via `/mnt/c/...`.
- Generated images NOT committed (git bloat, design P0-1); publish step handles placement.
