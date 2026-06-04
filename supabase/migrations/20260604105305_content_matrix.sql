-- ============================================================================
-- Migration: 202606041000_content_matrix.sql
-- Purpose: Autonomous, IMAGE-FIRST article-generation matrix (content_matrix).
-- Image-first pipeline: images are generated/approved BEFORE text writing/drafting.
--   - v_images_to_generate drives image gen
--   - v_ready_to_write is the trigger queue (image ready -> write article)
--   - v_publish_queue for final publish
-- Date: 2026-06-04
-- Tracked: sovetydoma-ywl
-- ============================================================================

create extension if not exists pg_trgm;

-- updated_at helper (reuse if present, else create; idempotent via create or replace)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $func$
begin
  new.updated_at := now();
  return new;
end;
$func$;

-- ============================================================================
-- Table: public.content_matrix
-- ============================================================================
create table if not exists public.content_matrix (
  id uuid primary key default gen_random_uuid(),
  domain text not null default '1001sovet.ru' check (domain ~ '^[a-z0-9.-]+$'),
  kb_source text not null default 'sovetydoma-home-core',
  taxonomy_path text,
  vertical text,  -- one of dacha / ogorod / dom / recepty / other (informal, no check)
  -- THREE ORTHOGONAL state axes (NOT one big enum):
  text_status text not null default 'idea' check (text_status in ('idea','outlined','draft','reviewed','approved','published')),
  image_status text not null default 'none' check (image_status in ('none','prompt_ready','generated','approved')),
  disposition text not null default 'active' check (disposition in ('active','needs_rework','rejected','on_hold')),
  needs_human_review boolean not null default false,
  priority int not null default 0,
  -- core identity (queried/deduped/ordered on — kept top-level on purpose):
  title text,
  slug text not null,
  category text check (category in ('kulinaria','dom-i-uborka','dacha-i-ogorod','layfkhaki','ekonomiya','rybalka')),
  description text,
  tags text[] not null default '{}',
  -- content:
  body_md text,
  outline jsonb,
  word_count int,
  -- rich/optional frontmatter mirror (recipe_*, series_*, quick_answer, time_estimate, needs, for_whom, author/persona, schema_type, etc.) lives here as jsonb to avoid column drift with ArticleFrontmatter:
  frontmatter jsonb not null default '{}',
  -- IMAGE pre-generation (first-class — image-first pipeline):
  image_prompt text,
  image_filename text,   -- e.g. 'zapakh-v-holodilnike.jpg' maps to MDX image: /images/<slug>.jpg
  image_url text,        -- canonical object-storage url (future R2/S3); git is NOT the store at scale
  image_source text,     -- 'grok-imagine','grok-cli-image_gen','openverse:xxx','pollinations','procedural','legacy-seed'
  image_model text,
  image_generated_at timestamptz,
  image_meta jsonb not null default '{}',
  -- quality / review:
  quality_score numeric,  -- SCALE 0..1 (see column comment)
  fact_check_status text check (fact_check_status in ('pending','passed','flagged','revised') or fact_check_status is null),
  review_notes text,
  review_agent text,
  review_at timestamptz,
  revision_count int not null default 0,
  human_edited boolean not null default false,
  -- cost / throughput guardrails:
  cost_estimate_usd numeric not null default 0,
  tokens_used int not null default 0,
  -- provenance / autonomy locks (with TTL):
  generated_by_agent text,
  last_filled_stage text,
  agent_claimed_by text,
  agent_claimed_at timestamptz,
  agent_claim_expires_at timestamptz,
  -- scheduling / lifecycle:
  scheduled_for timestamptz,
  published_at timestamptz,
  first_seen_at timestamptz not null default now(),
  -- links:
  source_article_slug text,
  superseded_by uuid references public.content_matrix(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_matrix_domain_slug_uniq unique (domain, slug)
);

comment on column public.content_matrix.quality_score is 'SCALE 0..1: composite quality / confidence score (0=unusable, 1=production-ready). Used for ranking/filtering in autonomous pipeline.';

-- ============================================================================
-- Indexes
-- ============================================================================
create index if not exists content_matrix_text_status_priority_idx on public.content_matrix (text_status, priority desc, created_at);
create index if not exists content_matrix_domain_text_status_idx on public.content_matrix (domain, text_status);
create index if not exists content_matrix_image_status_idx on public.content_matrix (image_status);
create index if not exists content_matrix_kb_source_idx on public.content_matrix (kb_source);
create index if not exists content_matrix_slug_idx on public.content_matrix (slug);
create index if not exists content_matrix_published_at_idx on public.content_matrix (published_at desc nulls last);
create index if not exists content_matrix_title_trgm_idx on public.content_matrix using gin (title gin_trgm_ops);
create index if not exists content_matrix_description_trgm_idx on public.content_matrix using gin (description gin_trgm_ops);

-- Partial: image-gen queue
create index if not exists content_matrix_image_gen_queue_idx on public.content_matrix (priority desc, created_at)
  where image_prompt is not null and image_status in ('none','prompt_ready');

-- Partial: IMAGE-FIRST write queue (the trigger: image ready -> write this article)
create index if not exists content_matrix_ready_to_write_idx on public.content_matrix (priority desc, image_generated_at)
  where text_status = 'idea' and image_status in ('generated','approved');

-- Partial: publish queue
create index if not exists content_matrix_publish_queue_idx on public.content_matrix (scheduled_for nulls last, priority desc)
  where text_status = 'approved' and image_status = 'approved' and disposition = 'active';

-- Claim TTL index
create index if not exists content_matrix_agent_claim_idx on public.content_matrix (agent_claim_expires_at)
  where agent_claimed_by is not null;

-- ============================================================================
-- Trigger
-- ============================================================================
create or replace trigger trg_content_matrix_updated
  before update on public.content_matrix
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- Audit table: public.content_matrix_events
-- ============================================================================
create table if not exists public.content_matrix_events (
  id uuid primary key default gen_random_uuid(),
  matrix_id uuid not null references public.content_matrix(id) on delete cascade,
  axis text,  -- 'text'|'image'|'disposition'|'publish'
  from_value text,
  to_value text,
  agent text,
  notes text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists content_matrix_events_matrix_id_created_at_idx on public.content_matrix_events (matrix_id, created_at desc);

-- ============================================================================
-- RLS (explicit-for-clarity; service_role bypasses RLS anyway)
-- ============================================================================
alter table public.content_matrix enable row level security;

drop policy if exists "service_role all access" on public.content_matrix;
create policy "service_role all access" on public.content_matrix
  for all
  to service_role
  using (true)
  with check (true);

comment on policy "service_role all access" on public.content_matrix is 'explicit-for-clarity (service_role bypasses RLS anyway)';

alter table public.content_matrix_events enable row level security;

drop policy if exists "service_role all access" on public.content_matrix_events;
create policy "service_role all access" on public.content_matrix_events
  for all
  to service_role
  using (true)
  with check (true);

comment on policy "service_role all access" on public.content_matrix_events is 'explicit-for-clarity (service_role bypasses RLS anyway)';

-- ============================================================================
-- Views (use create or replace view)
-- ============================================================================
create or replace view public.v_images_to_generate as
  select *
  from public.content_matrix
  where image_prompt is not null
    and image_status in ('none','prompt_ready')
    and disposition = 'active'
  order by priority desc, created_at;

create or replace view public.v_ready_to_write as
  select *
  from public.content_matrix
  where text_status = 'idea'
    and image_status in ('generated','approved')
    and disposition = 'active'
  order by priority desc, image_generated_at;  -- THE image-first writing queue

create or replace view public.v_publish_queue as
  select *
  from public.content_matrix
  where text_status = 'approved'
    and image_status = 'approved'
    and disposition = 'active'
    and (scheduled_for is null or scheduled_for <= now())
    and image_filename is not null
  order by scheduled_for nulls last, priority desc;
