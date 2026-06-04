# Content Matrix Design — 50k-scale autonomous article factory with Grok image pre-generation
**Date:** 2026-06 (based on 2026-06-04 forensic + current 329 live articles)  
**Tracked:** sovetydoma-ywl (P0)  
**Goal:** Replace ad-hoc Kimi file-drop factory with a persistent, agent-fillable matrix in DB. Pre-plan/fill 50 000+ articles across domains and knowledge bases. Pre-generate images with Grok. Use status flags + timestamps for workflow, continuous filling, periodic publishing. Seed all current articles. Preserve (and strengthen) existing quality gates.

## 1. Current factory (what we are replacing / evolving)
From code exploration:

- **Source of truth today**: `src/content/articles/*.mdx` (329 files, git-committed). Frontmatter strictly defined in `src/lib/articles.ts:ArticleFrontmatter` + `scripts/article-validation.mjs` (title, slug ascii, category one of 6, categoryName exact, description<=160-200, date YYYY-MM-DD, `image: "/images/<slug>.jpg"` **exact**, tags non-empty array, optional Recipe fields, series, quickAnswer, author/persona, min 300 words body, H2s, no mojibake via regex, no duplicate slugs).
- **Generation**: External (Kimi). Prompts in `docs/kimi-articles.md` (single), `kimi-100-topics.md` (curated list + master), `kimi-500-batch.md` (self-managed 500, Kimi invents topics, verifies own slugs, writes direct or via incoming, 10 commits of 50). `kimi-50-next-batch-2026-06-01.md` for incremental.
- **Intake**: Drop `.mdx` to `incoming-articles/` (currently ~250) → `node scripts/import-articles.mjs` (validates via article-validation, skips collisions, moves to src/content/articles). Or Kimi writes direct to src (in batch mode).
- **Validation gates** (run in `pnpm run build` + explicit): `validate-articles.mjs`, `validate-article.mjs`, `audit-article-images.mjs --fail-on-duplicates --fail-on-drifts`, `audit-seo.mjs`, `audit-links.mjs`. `fix-image-frontmatter-drifts.mjs`.
- **Images** (critical for proposal): Per-article `public/images/<slug>.jpg` committed to git. Provenance tracked in `public/images/.sources.json`. Primary: `scripts/fetch-openverse-images.mjs` (keyless CC via openverse.org, uses `QUERY_MAP` slug→english visual query + `CATEGORY_QUERY` fallback in `image-audit-utils.mjs`). Fallbacks: `generate-photo-like-images.mjs` (pollinations), `generate-procedural-photo-images.py`, `generate-card-images.py`. Previews: `generate-image-previews.py`. Normalize: `normalize-article-images.py`. `resolveArticleImage` in `src/lib/cloudinary.ts` (now mostly serves local /images/ or falls back; Cloudinary legacy). `ArticleImage.tsx` 404→category emoji. All 329 have images + correct fm as of 2026-06 fixes. Audit enforces match.
- **Indexes/feeds** (build-time, from MDX): `generate-article-index.mjs` (client-safe slug→{category,title}), `generate-questions-index`, `generate-sitemap.mjs` + `generate-rss.mjs` (now use CATEGORIES dynamic, includes rybalka), `generate-turbo.mjs`, `generate-zen.mjs`, `generate-build-metadata.mjs`.
- **Other**: `src/lib/personas.ts` (4: maryana-sidorova for dom/kulinaria, petr-pupkin layfkhaki, petr-ivanov dacha/ekonomiya, andrey-rybak rybalka). `src/lib/life-taxonomy.ts` + `docs/category-expansion-research-2026-06-01.md` (for future sections). `scripts/export-knowledge-articles.mjs` → `knowledge-export.json` (structured blocks for future "HowBase Knowledge Core" shared KB). `articles_publication_index` table (from omnichannel subs migration) + `sync-subscription-publication-index.mjs` / `build-...` (denorm published for notifications; pulls from MDX fm).
- **Problems at scale (from 2026-06-02/06-04 forensics + handoff)**: Manual/orchestrated (copy-paste prompts, human git diff gate, no codified review queue or "human_edited" flag). No central backlog/state (what is planned vs drafted vs ready). Images always post-text (tied to existing MDX). Incoming-articles ~250 "heavily corrupted/suspects" at scan time. 29 shorts <300w + 2 real mojibake live (title/desc garbage) at one point (gates tightened post). Sitemap/RSS previously missed rybalka. No multi-domain/kb support. 50k impossible (repo bloat, build time, manual). No pre-planning of images or autonomous fill.

**Preserve on migration**: All gates (validate, image audit, seo, min words, exact fm/image, no mojibake), MDX as runtime source for Next static export (for now), build pipeline, committed images under /images/, persona mapping, subs index sync, KB export seam, git history for published content.

## 2. Vision for the matrix
A single source-of-truth table (or small set) in Supabase:
- **Plan & backlog at 50k scale**: Rows exist before any text or image is written. Agents fill columns/stages continuously.
- **Flags / state machine** for autonomy + periodic publish: `status` + timestamps + bools + scores. E.g. `published_at`, `scheduled_publish_date`, `image_filename` (pre-generated), `reviewed_at`, `needs_human_review`.
- **Multi-domain + multi-KB**: `domain` (e.g. '1001sovet.ru', 'pogovorimdoma.ru', future other sites), `kb_source` (e.g. 'sovetydoma-home-core', 'fishing-expert-v2', 'category-expansion-2026-06', 'howbase-life-hacks'), `taxonomy_path` or tags.
- **Grok images pre-gen**: Every row can/should have `image_prompt` (rich visual description, generated early). Separate stage/agent: Grok (Imagine/Flux via our image_gen or xAI API) produces the file **before** full text. Record `image_filename` (exact, like current `/images/<slug>.jpg`), `image_source`, `image_model='grok-imagine'`, `image_generated_at`. Image can live in git (public/images) or object storage (future Timeweb S3 / R2). Pre-gen allows visual validation of idea, stock of ready visuals for publish batches.
- **Agent分工**: 
  - Kimi (strong long-form RU): ideas, outlines, full drafts, titles, tags, recipe structs.
  - Grok: idea critique, review (accuracy vs KB, practicality, tone, SEO, anti-hallucination), image generation + perhaps image prompt refinement, final polish.
  - Humans: final approve, taste, legal, series curation, taxonomy.
- **Fill continuously, publish periodically**: Matrix fills 24/7 (autonomous loops or scheduled agents). "Ready" rows (approved + image_ready + reviewed) sit until a publish run: select batch by `scheduled_publish_date` or manual "publish queue", export to MDX + images, run full validate/audit gates, human `git diff` gate (or trusted auto), commit/push → existing deploy. Update matrix `status='published'`, `published_at`.
- **Seed current**: All 329 validated live articles (from `src/content/articles/`) **must** appear in matrix on day 1 with `status='published'`, full data (fm fields + body_md + word count + image_filename + author_persona + dates). This:
  - Prevents duplicates in future gens.
  - Surfaces the 29 shorts + 2 mojibake (flag `needs_rework` or `status='needs_rework'` for re-gen/repair via agents).
  - Provides training/golden data for agents.
  - Keeps subs/analytics working (sync from matrix or keep dual for now).
- **Autonomy enablers**: Service-role scripts that `SELECT ... WHERE status='idea' ORDER BY priority, created_at LIMIT 20`, call LLM (parametrized prompt with row data), `UPDATE` specific columns + `status` + `last_filled_stage` + `review_agent`. Event log table for full audit ("agent X set status Y at Z, notes"). Rate limits, backoff, "claimed_by" temp lock.
- **50k ideas launch**: After seed + schema, run idea-gen agents (expand taxonomy first from life-taxonomy + category research + competitor data → hundreds of narrow subtopics → per subtopic 20-100 specific practical titles). Check uniqueness (slug exact + title similarity). Insert as `status='idea'` with pre-filled `image_prompt` (Grok or Kimi can propose visuals too).

## 3. Proposed DB schema (content_matrix)
Add via new migration: `supabase/migrations/20260605xxxx_content_matrix.sql` (or later timestamp).

```sql
create table if not exists public.content_matrix (
  id uuid primary key default gen_random_uuid(),

  -- multi-domain / multi-KB
  domain text not null default '1001sovet.ru',
  kb_source text not null default 'sovetydoma-home-core',
  taxonomy_path text,  -- e.g. 'dacha-i-ogorod/ovoschi/ogurcy/bolezni'

  -- workflow state machine (primary flag)
  status text not null default 'idea' check (status in (
    'idea',           -- minimal: title+slug+cat+desc+image_prompt + kb
    'outlined',       -- outline jsonb filled
    'draft',          -- body_md + most fm fields
    'in_review', 
    'reviewed',       -- review_notes + quality_score + fact_check_status
    'images_pending',
    'images_ready',   -- image_filename + image_* set (can happen early, even from 'idea')
    'finalizing',
    'approved',       -- ready for publish queue (human or auto gate)
    'scheduled',      -- planned_publish_date set
    'published',      -- published_at set, exported to MDX/deployed
    'rejected',
    'needs_rework'
  )),
  priority int not null default 0,  -- higher = fill first
  needs_human_review boolean not null default false,

  -- core identity (unique per domain)
  title text,
  slug text not null,  -- ascii lowercase digits hyphens, unique(domain, slug)
  category text,
  category_name text,
  description text,
  tags text[] not null default '{}',

  -- scheduling / publishing
  planned_publish_date date,
  published_at timestamptz,
  first_seen_at timestamptz not null default now(),

  -- full content (single source for export)
  body_md text,                    -- the article body (after --- fm)
  outline jsonb,                   -- [{ "h2": "...", "bullets": [".."], "key_facts": [...] }, ...]
  word_count int,

  -- optional rich fields (mirror ArticleFrontmatter + more)
  updated_at_source timestamptz,   -- for refresh
  sponsored boolean default false,
  schema_type text check (schema_type in ('Recipe','HowTo') or schema_type is null),
  prep_time text, cook_time text, recipe_yield text,
  recipe_ingredient text[],
  recipe_steps text[],
  difficulty text check (difficulty in ('Легко','Средне','Сложно') or difficulty is null),
  cost text,
  series_name text,
  series_order int,
  quick_answer text,
  time_estimate text,
  needs text[],
  for_whom text,
  author_persona text,             -- from personas.ts or free

  -- Grok image pre-generation (key new capability)
  image_prompt text,               -- detailed prompt for generator (can be set at 'idea' stage)
  image_filename text,             -- e.g. 'zapakh-v-holodilnike.jpg' (maps to /images/...)
  image_url text,                  -- if in object storage (future)
  image_source text,               -- 'grok-imagine', 'grok-imagine-refined', 'openverse:xxx', 'pollinations', 'procedural', 'human-stock', 'legacy-seed'
  image_model text,                -- 'xai-imagine-v1', 'flux-1', ...
  image_generated_at timestamptz,
  image_approved boolean default false,
  image_meta jsonb default '{}',   -- aspect, seed, negative_prompt, etc.

  -- quality / review (Grok + Kimi + human)
  quality_score numeric,           -- 0-1 or 1-10
  fact_check_status text check (fact_check_status in ('pending','passed','flagged','revised') or fact_check_status is null),
  review_notes text,
  review_agent text,               -- 'grok-review-2026-06', 'kimi-draft', 'human:filip', ...
  review_at timestamptz,
  revision_count int default 0,

  -- provenance / agents
  generated_by_agent text,         -- 'kimi-500-batch', 'grok-idea-gen-v1', 'legacy-mdx-seed-2026-06-05', 'human-curation'
  last_filled_stage text,
  agent_claimed_by text,           -- temp for autonomy loops (set + clear)
  agent_claimed_at timestamptz,

  -- links to existing / sources
  source_article_slug text,        -- for "based on" or refresh of legacy
  source_article_id uuid references public.content_matrix(id),
  inspired_by jsonb default '[]',  -- array of slugs or ids

  -- flexible / future
  extra jsonb default '{}',        -- recipe extras, seo overrides, custom for other domains

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (domain, slug)
);

-- indexes for agent queries (critical for autonomy)
create index if not exists content_matrix_status_priority_idx on public.content_matrix (status, priority desc, created_at);
create index if not exists content_matrix_domain_status_idx on public.content_matrix (domain, status);
create index if not exists content_matrix_kb_source_idx on public.content_matrix (kb_source);
create index if not exists content_matrix_slug_idx on public.content_matrix (slug);
create index if not exists content_matrix_published_at_idx on public.content_matrix (published_at desc nulls last);
create index if not exists content_matrix_images_ready_idx on public.content_matrix (status, image_filename) where image_filename is null;  -- for image gen queue
create index if not exists content_matrix_approved_idx on public.content_matrix (status, planned_publish_date) where status in ('approved','scheduled');

-- updated_at trigger (standard)
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger trg_content_matrix_updated before update on public.content_matrix for each row execute function public.set_updated_at();

-- optional: event log for full audit (who changed what when)
create table if not exists public.content_matrix_events (
  id uuid primary key default gen_random_uuid(),
  matrix_id uuid not null references public.content_matrix(id) on delete cascade,
  stage text,
  from_status text,
  to_status text,
  agent text,
  notes text,
  payload jsonb,
  created_at timestamptz default now()
);
create index if not exists content_matrix_events_matrix_id_idx on public.content_matrix_events (matrix_id, created_at desc);

-- RLS: everything locked down; only service role (used by our scripts/agents) + perhaps admin users
alter table public.content_matrix enable row level security;
alter table public.content_matrix_events enable row level security;

-- Example policies (tighten as needed; service_role bypasses RLS usually, but explicit good)
create policy "content_matrix_service" on public.content_matrix
  for all to service_role using (true) with check (true);
create policy "content_matrix_events_service" on public.content_matrix_events
  for all to service_role using (true) with check (true);

-- Optional: admin read via role (if we have user roles)
-- create policy "content_matrix_admin_read" on public.content_matrix for select using (auth.role() = 'authenticated' and ...);

-- Views for common agent queues (example)
create or replace view public.v_ideas_for_draft as
  select * from public.content_matrix
  where status = 'idea' and title is not null and image_prompt is not null
  order by priority desc, created_at;

create or replace view public.v_images_to_generate as
  select * from public.content_matrix
  where image_prompt is not null and image_filename is null and status in ('idea','outlined','draft','reviewed')
  order by priority desc, created_at;

create or replace view public.v_publish_queue as
  select * from public.content_matrix
  where status in ('approved','scheduled')
    and (planned_publish_date is null or planned_publish_date <= current_date)
    and image_filename is not null
  order by planned_publish_date nulls last, priority desc;
```

Also consider a small `content_domains` or just config in code for allowed categories per domain + default personas.

Sync/augment `articles_publication_index` from matrix rows where status='published' (extend existing sync script).

## 4. Workflow & agent mechanics (autonomous operation)
Statuses are the "флаги". Transitions are explicit in agent code + events.

Typical flow for a new article:
1. **Idea stage** (Kimi or Grok idea agent): insert row with title, slug (pre-validated unique), category (from allowed), description, tags, image_prompt (detailed: "realistic photo of ... in home kitchen, natural window light, practical step-by-step visual, SovetyDoma style, no text overlay"), domain, kb_source, taxonomy_path, priority, target_word_count=700, generated_by_agent='grok-idea-gen-2026-06'.
2. **Outline** (Kimi): agent picks from v_ideas_for_draft or status=idea, generates structured outline (jsonb), UPDATE ... SET outline=..., status='outlined', last_filled_stage='outline', ...
3. **Draft** (Kimi): from outline + title/desc + any source KB snippets, write full practical body (700-1200w, lists, numbers, no conclusion boilerplate, no AI mention), plus fill other fm (quick_answer, recipe fields if kulinaria, author_persona=resolve(category), ...). Set status='draft'.
4. **Review** (Grok): pick drafts, run review prompt ("You are strict Russian home-advice editor for SovetyDoma. Critique this draft for practicality, safety, accuracy vs known KB, duplicates with existing published [pass list of similar titles], SEO, length, tone. Output: quality_score 0-1, fact_check_status, review_notes, suggested_fixes. Then decide: 'reviewed' or 'needs_rework'."). UPDATE status, scores, notes, review_agent='grok-review-v1', review_at=now().
5. **Images** (Grok, can be parallel/early): independent of text. Query v_images_to_generate or where image_prompt and no filename. For each: refine prompt if needed, call image generation (see 5.), save file as public/images/{slug}.jpg (or temp then normalize), UPDATE image_filename=..., image_source='grok-imagine', image_generated_at=now(), image_model=..., status=... (or just set image fields, leave status). Run audit/normalize.
6. **Finalize/Approve**: assemble full frontmatter mentally, re-validate locally if needed, set status='approved' (or 'needs_rework' if issues). Human can flip needs_human_review or bulk approve in admin.
7. **Schedule/Publish**: set planned_publish_date or status='scheduled'. Publish agent/batch: `export-to-mdx --status approved --limit 50`, which writes temp MDX files + ensures images in public/images, then (human or script) moves to src/content/articles/ (or incoming), runs full `validate-articles && audit:images && ...`, diffs, commits with message "content(matrix): publish batch N from matrix", push. Post-deploy: UPDATE matrix SET status='published', published_at=now() for those slugs.

**Autonomy loops** (examples to implement as scripts or cron):
- `node scripts/matrix/fill-ideas.mjs --count 200 --domain 1001sovet.ru --kb sovetydoma-home-core` (uses LLM API or interactive).
- `node scripts/matrix/fill-stage.mjs --from idea --to outlined --limit 30`
- `node scripts/matrix/review-batch.mjs --limit 20 --agent grok`
- `node scripts/matrix/generate-images-grok.mjs --limit 50` (core for pre-gen)
- Long-running: while [condition] { claim N rows, process, release; sleep 5s; } with claim to avoid overlap.

**Parameterized prompts** (store in docs/matrix-prompts/ or code):
- Idea prompt template includes: current taxonomy, list of recent published titles (to avoid dup), example good ideas, output format (JSON array of rows to insert).
- Draft prompt: full Kimi-articles style + "use this exact outline: {outline}", "target {word_count} words", "for domain {domain} kb {kb_source}".
- Review prompt: strict, cite specific issues, output structured.

**Deduplication**: On idea insert (and in gen scripts): check exact (domain,slug), plus query similar titles (ilike or later pg_trgm / vector). Agent must "verify uniqueness before insert".

**Logging & monitoring**: content_matrix_events + simple counts views + "matrix:stats" script. Beads or separate for agent runs.

## 5. Grok image pre-generation integration
- **In matrix**: `image_prompt` is first-class (set at idea time; can be refined). `image_filename` is the contract (exactly as current fm expects).
- **Generation step** (new script `scripts/matrix/generate-images-grok.mjs` or equivalent):
  - Query ready rows (image_prompt + !image_filename).
  - For row: full_prompt = `Detailed, photorealistic image for Russian home-advice article titled "${title}". ${image_prompt}. Practical, everyday home/dacha/garden/fishing scene, natural lighting, high detail, no text, no logos, SovetyDoma aesthetic, 16:9 or 4:3.`
  - Call generator:
    - In this Grok Build / agent sessions: use the `image_gen` tool (prompt=full_prompt, aspect_ratio='16:9' or '4:3' or 'auto' based on content). Tool returns saved image path. Copy/rename to `public/images/${row.slug}.jpg`.
    - In autonomous prod: call xAI Imagine / Grok image endpoint (add `XAI_API_KEY` to secrets, similar to Resend/Anthropic). Or fallback to current openverse/pollinations if no key.
  - Post-gen: run `python scripts/normalize-article-images.py` (or specific), update row: image_filename=`${slug}.jpg`, image_source='grok-imagine', image_generated_at=now(), image_model='xai-imagine-2026', image_meta={prompt: full_prompt, aspect:.., tool: 'grok-build' or 'xai-api'}.
  - Optional: also generate variants or card preview.
- **Pre-gen advantage**: Can image 'idea' rows immediately (visual sanity check for the idea itself). Stockpile images for future publish waves. Different flags/styles per kb/domain (e.g. "fishing realistic" vs "kitchen cozy").
- **Audit**: Extend `audit-article-images` to also check matrix rows (image_filename present where expected, file exists on disk or in storage, fm would match).
- **Storage evolution**: For 50k keep in git for now (like current 329), or move primary to object storage (Timeweb S3 as in D-2 plan) + CDN, with local copy only for build if needed. Record image_url + filename.

**Example in this environment (how we will bootstrap)**: After seeding + some ideas with prompts, I (as Grok) will:
- Query matrix for N rows needing images.
- Make parallel `image_gen` tool calls with their prompts.
- For each result path, copy to correct public/images/<slug>.jpg .
- Use search_replace or a update script + supabase client (with service key) to set the columns in DB.
- Commit the new jpgs + any matrix updates.

This matches "Grog может генерировать изображения заранее для каждой статьи. И где-то в базе данных, в матрице указывать название изображения, которое уже будет загружено."

## 6. Seeding current articles (mandatory)
Script: `scripts/matrix/seed-from-current.mjs` (or .ts)

- Use SUPABASE_SERVICE_ROLE_KEY (load from .env or `C:\Users\filip\.secrets\...` like other secrets; never commit).
- `const { data: files } = ...` or fs read of src/content/articles.
- For each: parse with gray-matter, compute wordCount, derive author_persona (from fm or PERSONA_BY_CATEGORY[cat] or null), image_filename = path.basename(fm.image || '') or `${slug}.jpg`.
- `await supabase.from('content_matrix').upsert({ 
    domain: '1001sovet.ru',
    kb_source: 'sovetydoma-home-core',
    status: 'published',
    published_at: toTimestamptz(fm.date),
    title: fm.title,
    slug: fm.slug,
    ... all other fm fields mapped (tags as array, etc.),
    body_md: content,
    word_count: wordCount,
    image_filename,
    image_source: 'legacy-seed',
    generated_by_agent: 'legacy-mdx-seed-2026-06-05',
    // extra: { original_mdx_path: ..., had_mojibake: detect... }
  }, { onConflict: 'domain,slug' })`
- After bulk: `node scripts/sync-subscription-publication-index.mjs` (or extend it to also source from matrix published rows).
- Verification: `select count(*) from content_matrix where status='published' and domain='1001sovet.ru';` should == 329 (or current live count after any cleanup).
- Post-seed: run full `pnpm run audit:images && validate:articles` + spot check 5 rows (body present, image_filename correct, status published, published_at set).
- Flag problems: for the known 29 shorts or mojibake ones (if still present), set status='needs_rework', needs_human_review=true, review_notes='short body from legacy; re-gen recommended'.
- Also seed a few from incoming if they pass validate (optional, or treat as 'draft' from prior batch).

This ensures "текущие статьи в ней уже оказались".

Run as part of "first setup": after migration, `pnpm run matrix:seed`.

## 7. 50k ideas generation launch
- **Prep**: Script or agent run to expand taxonomy using `life-taxonomy.ts` + `category-expansion-research-2026-06-01.md` + competitor patterns → output `docs/taxonomy-expanded-2026-06.json` (cats → subcats → leaf topics, 100s-1000s leaves).
- **Idea gen agent(s)**: 
  - For batch of leaves: construct prompt "You are SovetyDoma editor. For subtopic X under cat Y in kb Z, invent 30 brand-new, narrow, practical, never-before-seen article ideas that real people would search. Avoid anything similar to these existing [SELECT title,slug FROM content_matrix WHERE ... LIMIT 200 recent or keyword match]. Output strict JSON array of {title, proposed_slug (ascii hyphen, verify unique yourself), description (1 sent), tags[4-6], image_prompt (detailed visual for Grok photo gen), target_wc: 800, priority: 5, ...}".
  - Kimi or Grok executes, we (or script) validate slugs unique in batch + against DB, insert.
- **Scale**: Run multiple overlapping sessions/agents. Target distribution (example): 8-10k per major cat, more for rybalka/expansion, plus cross-KB. 50k total rows in 'idea' or further.
- **Automation**: After initial, "perpetual idea miner": every day pick under-covered taxonomy leaves (count per taxonomy_path < threshold), gen 10 more.
- **Quality**: Ideas must be specific ("Как отмыть пригоревшую эмалированную кастрюлю" not "Уборка на кухне"), with numbers/ seasons/ concrete in mind.

## 8. Export / publish bridge (preserve current everything)
`scripts/matrix/export-to-mdx.mjs --domain=1001sovet.ru --status=approved --limit=50 --dry`

- Query v_publish_queue or filtered.
- For each row: reconstruct full MDX string:
  ```
  ---
  title: "${title}"
  slug: "${slug}"
  category: "${category}"
  categoryName: "${category_name}"
  description: "..."
  date: "${planned or today}"
  image: "/images/${image_filename}"
  tags: ${JSON.stringify(tags)}
  author: "${author_persona || ''}"
  ... other optionals
  ---
  ${body_md}
  ```
- Write to `matrix-exports/<slug>.mdx` (or configurable).
- Ensure `public/images/${image_filename}` exists (copy from storage if needed).
- Then user/script can: `node scripts/validate-article.mjs matrix-exports/xxx.mdx`, bulk move to src/content/articles/ or incoming-articles/, run `pnpm run build` (which does full validate + gens), audit, commit "content: publish 47 articles from matrix (sovetydoma-ywl)".
- Post-success: UPDATE content_matrix SET status='published', published_at=now() WHERE slug IN (...)
- This way: **no breakage** to static Next, nginx, CI, image audit, subs index, everything. Matrix is upstream "source of sources".

Later (D-2 or big refactor): could make runtime read published matrix rows at build time (still static) or go fully dynamic.

## 9. Implementation plan & files (after approval)
1. Create migration SQL (as above + any seed data or functions).
2. Create `scripts/matrix/` dir + core files:
   - `seed-from-current.mjs` (the mandatory seeder)
   - `supabase-client.mjs` helper (service role)
   - `export-to-mdx.mjs`
   - `generate-images-grok.mjs` (skeleton + comments for tool vs API)
   - `fill-ideas.mjs` (or prompts-only + manual insert helper)
   - `update-matrix-row.mjs` (cli util)
   - `matrix-stats.mjs`
3. `docs/matrix-prompts/` : reusable prompt templates (idea, outline, draft, review, image-refine).
4. Update `package.json` scripts: `"matrix:seed": "node scripts/matrix/seed-from-current.mjs", "matrix:export": "...", "matrix:gen-images": "..." , etc.`
5. Update `HANDOFF.md` (section on new factory), `CONTENT_TOOLS.md`, add to forensic notes.
6. Write/run seed (verify 329), then initial 1k-5k ideas (using this session's Grok power + taxonomy).
7. For first Grok image batch: populate prompts for a few seeded rows or new ideas, use `image_gen` tool calls here, land files in public/images, update DB rows.
8. Add basic event logging on key updates.
9. (future) Admin UI bits, pgvector for semantic search/dedup in matrix, integration with other domains' repos.

**Order**: migration + seed script first (so current articles "already in"), then image gen wiring, then idea gen, then full export.

**Verification gates for this work**:
- After seed: matrix count published == live MDX count, spot-check bodies/images/statuses match, no dup slugs.
- Idea gen: 0 collisions with seeded, good distribution, all have image_prompt + valid slugs.
- Image gen: generated files exist, named correctly, matrix rows updated, pass `audit:images`.
- Export: produced MDX passes validate-article, builds cleanly, images present.
- Autonomy demo: manual "take 5 ideas → outline → draft → review (Grok) → image" loop succeeds end-to-end.

## 10. Open questions / decisions for you
- Table name: `content_matrix` (general, good for multi-domain) vs `sovetydoma_article_pipeline`?
- Body storage: inline `body_md text` (simple, queryable) or separate `content_blobs` / object storage refs (for very large scale)?
- Publish gate: always human `git diff` + commit, or "approved" rows auto-export + auto-deploy in future?
- Other domains right now: just '1001sovet.ru' + perhaps 'pogovorimdoma.ru' alias, or start modeling worldspot/gene etc. immediately?
- API keys for autonomous Kimi/Grok text: add to secrets now, or keep "paste prompt" mode longer?
- xAI image gen in prod: do we have / will get official key, or rely on this Grok Build tool + manual batches for pre-gen phase?
- Incoming 250: seed only clean validated ones as published, or bulk-insert as 'draft'/'idea' for re-processing?
- RLS / access: service_role scripts only, or also a "content_editor" role in Supabase Auth?
- Size target: 50k for sovetydoma verticals first, or global across all your projects/KBs from day 1?
- Any must-have columns I missed (e.g. internal_notes, estimated_time_to_fill, monetization_flag)?

This design directly addresses the request: giant pre-created matrix, agent-fillable autonomously, Grok images pre-gen + filename in DB, flags for published/scheduled/revised/etc, continuous fill + periodic publish from finished, seed current articles guaranteed, foundation for 50k ideas gen.

**Next**: Confirm / tweak this design (or specific columns/prompts). On OK I will:
- Create the migration file + seed script (using beads tracking).
- Run seed (you may need to supply/confirm SERVICE_ROLE_KEY location).
- Start taxonomy expansion + first idea batches + Grok image examples.
- Update docs.

All per session protocol (bd, exploration first, no premature code). 

See also related: HANDOFF.md (current factory), docs/kimi-*.md, scripts/image-audit-utils.mjs (QUERY_MAP), supabase/migrations/202606021300_omnichannel_subscriptions.sql (articles_publication_index), reports/forensic-subagent-deep-scan-2026-06-04.md (exact issues we will fix via matrix: shorts, mojibake surfacing, etc.).

---

## ADDENDUM — locked decisions & IMAGE-FIRST pivot (2026-06-04, picked up by Claude after Grok review)

This addendum **supersedes** any conflicting detail above. It folds in the full P0/P1 review and the operator's decisions.

### A. The image-first pipeline (the core mental model)
Images are **not** a downstream step — they are the **trigger**. The order is:
1. Idea rows are created in bulk with `image_prompt` filled (no body yet).
2. Grok **pre-generates images ahead of time** from `image_prompt` → sets `image_status='generated'`/`'approved'` + `image_filename`/`image_url`.
3. **The presence of a ready image is what schedules the article for writing.** When a batch of ~1000 images exists, *those specific rows* get drafted (queue view `v_ready_to_write` = `text_status='idea' AND image_status IN ('generated','approved')`).
4. Draft → review → approve → publish-batch export to MDX.

This is why state is modelled as **three orthogonal axes** (`text_status`, `image_status`, `disposition`) rather than one 13-value enum (fixes review **P0-5**): the image axis advances independently of and ahead of the text axis.

### B. Grok CLI in WSL = code-writer + reviewer ONLY (NOT an image provider)
Verified 2026-06-04: the Grok CLI at `/usr/local/bin/grok` (WSL Ubuntu-24.04, run `-u root`) has full coding tools (`write`, `search_replace`, `run_terminal_command`, `grep`, `spawn_subagent`). Headless usage:
```bash
wsl -d Ubuntu-24.04 -u root -- bash -lc '
  export PATH="$HOME/.grok/bin:$PATH"; cd /mnt/c/DEV/sovetydoma
  grok --prompt-file <spec> --cwd /mnt/c/DEV/sovetydoma \
       --permission-mode bypassPermissions --tools "read_file,write,search_replace,list_dir,run_terminal_command" \
       --disable-web-search --no-subagents --output-format plain'
```
- **Code generation** is delegated to Grok against a precise spec; Claude reviews every file. This works well (this doc's migration + seeder were Grok-written, Claude-reviewed).
- ✅ **Grok CLI generates images** (xAI Imagine via the embedded `imagine` skill) — verified 1408×768 JPEG, high quality, **no API key needed** (session auth). This resolves **P0-2**. **CRITICAL gotcha:** run with the FULL default toolset — do NOT pass `--tools`/`--disallowed-tools`/`--disable-web-search`, or the imagine skill won't load (it loads via `search_tool`/`use_tool`). Output lands in `~/.grok/sessions/<cwd>/<session>/images/N.jpg` → `cp` to `public/images/<slug>.jpg`. Full recipe in `C:\dev\knowledge\kimi-grok-cli-headless.md`.
- **Image provider = Grok** (primary). Keyless repo fallbacks if Grok is rate-limited/down: `scripts/fetch-openverse-images.mjs` (CC) + `scripts/generate-photo-like-images.mjs` (Pollinations).
- **Text drafting = Kimi CLI** (`kimi.exe`, run via PowerShell/native Windows console — NOT git-bash, which hangs it). `kimi --quiet -p "..."`. Model Kimi-k2.6, strong Russian long-form. See knowledge doc.
- Repo↔WSL path map: `C:\DEV\sovetydoma` = `/mnt/c/DEV/sovetydoma`.

### C. Decisions locked
| Topic | Decision |
|---|---|
| First verticals | **дача, огород, дом, рецепты** (`category` ∈ dacha-i-ogorod, dom-i-uborka, kulinaria; `vertical` tags dacha/ogorod/dom/recepty). rybalka/layfkhaki/ekonomiya later. |
| Cadence | **100 articles/day via cron** (serial, ~1 per 15 min). |
| Image provider | **Grok CLI** (xAI Imagine via `imagine` skill) — CONFIRMED working, high quality, no key. Run with full default toolset. Fallbacks: `fetch-openverse-images.mjs`, `generate-photo-like-images.mjs`. |
| Image storage at scale | **NOT git.** `image_url` (canonical, future R2/S3) + `image_filename` (MDX compat). Git keeps only the legacy 329 + build-time prefetched batch (gitignored). (P0-1) |
| Schema | top-level columns for queried/deduped fields; **`frontmatter jsonb`** mirrors rich/optional FM to avoid drift (P0-3); `category` CHECK-constrained (P0-4); pg_trgm dedup from day 1 (P1-1); claim TTL (P1-4). |
| Build strategy trigger | full `next build` until `published > 5000`, then incremental publish (P0-9). |
| Multi-domain | `domain` column exists, but only `1001sovet.ru` rows in phase 1. |
| Seed | All 329 live MDX → matrix as `text_status='published'`; shorts/mojibake flagged `disposition='needs_rework'`. Incoming-articles 250 **not** seeded (P1-6). |
| Beads | close `sovetydoma-izh` as dup of `sovetydoma-ywl` (P1-10). |

### D. Build order (this pickup)
1. ✅ Verify Grok CLI capability (code + image). 
2. ◐ Migration `supabase/migrations/202606041000_content_matrix.sql` (Grok-written, Claude-reviewed) — three-axis schema, image-first views.
3. Seed script `scripts/matrix/seed-from-current.mjs` (needs `SUPABASE_SERVICE_ROLE_KEY` — location TBD from operator). Bootstrap `image_prompt` for seeds from `QUERY_MAP` (P1-3); reuse `resolvePersona` (P1-2).
4. Taxonomy + idea-gen for the 4 verticals → idea rows with `image_prompt`.
5. Grok image pre-gen loop (full-toolset invocation) → fills `image_status`/`image_filename`/`image_url`.
6. `v_ready_to_write` → Grok/Kimi drafting → review → `export-to-mdx` publish batch.

