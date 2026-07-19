-- Article Media Control Plane (bead sovetydoma-11g.4)
-- Versioned article heroes, generation jobs, and immutable audit events.
-- Service-role only (admin-api worker). Never store provider secrets here.

-- ---------------------------------------------------------------------------
-- content_matrix: pointer to active media version (additive, nullable)
-- ---------------------------------------------------------------------------
alter table public.content_matrix
  add column if not exists active_media_id uuid;

create index if not exists content_matrix_active_media_id_idx
  on public.content_matrix (active_media_id)
  where active_media_id is not null;

-- ---------------------------------------------------------------------------
-- article_media: immutable versioned hero/candidate records
-- ---------------------------------------------------------------------------
create table if not exists public.article_media (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.content_matrix(id) on delete cascade,
  version int not null,
  storage_key text not null,
  preview_key text,
  mime text not null default 'image/jpeg',
  width int,
  height int,
  sha256 text,
  source text not null default 'generated',  -- generated | upload | legacy
  provider text,                            -- fal | manual | legacy
  prompt text,
  negative_prompt text,
  alt text,
  status text not null default 'candidate'
    check (status in ('live', 'candidate', 'generating', 'failed', 'rejected', 'archived')),
  parent_media_id uuid references public.article_media(id) on delete set null,
  generation_job_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  retired_at timestamptz,
  constraint article_media_article_version_uniq unique (article_id, version),
  constraint article_media_storage_key_uniq unique (storage_key)
);

create index if not exists article_media_article_status_idx
  on public.article_media (article_id, status, created_at desc);
create index if not exists article_media_job_idx
  on public.article_media (generation_job_id)
  where generation_job_id is not null;
create index if not exists article_media_status_created_idx
  on public.article_media (status, created_at desc);

alter table public.article_media enable row level security;
revoke all on public.article_media from anon, authenticated;

-- FK from content_matrix.active_media_id once article_media exists (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'content_matrix_active_media_id_fkey'
  ) then
    alter table public.content_matrix
      add constraint content_matrix_active_media_id_fkey
      foreign key (active_media_id) references public.article_media(id)
      on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- media_generation_jobs: async provider work (2+ candidates)
-- ---------------------------------------------------------------------------
create table if not exists public.media_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.content_matrix(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  provider text not null default 'fal',
  model text,
  prompt text not null,
  negative_prompt text,
  candidate_count int not null default 2,
  progress int not null default 0,
  attempt int not null default 0,
  max_attempts int not null default 3,
  retryable boolean not null default true,
  error_code text,
  error_message text,
  cost_usd numeric,
  cost_meta jsonb not null default '{}',
  media_ids uuid[] not null default '{}',
  created_by uuid,
  idempotency_key text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create unique index if not exists media_generation_jobs_idempotency_uidx
  on public.media_generation_jobs (idempotency_key)
  where idempotency_key is not null;
create index if not exists media_generation_jobs_article_idx
  on public.media_generation_jobs (article_id, created_at desc);
create index if not exists media_generation_jobs_status_idx
  on public.media_generation_jobs (status, created_at desc);

alter table public.media_generation_jobs enable row level security;
revoke all on public.media_generation_jobs from anon, authenticated;

-- article_media.generation_job_id → media_generation_jobs (optional FK)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'article_media_generation_job_id_fkey'
  ) then
    alter table public.article_media
      add constraint article_media_generation_job_id_fkey
      foreign key (generation_job_id) references public.media_generation_jobs(id)
      on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- article_media_events: immutable media-specific audit (complements admin_audit_events)
-- ---------------------------------------------------------------------------
create table if not exists public.article_media_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,           -- media.generate | media.assign | media.archive | media.rollback | media.upload | media.job.retry
  article_id uuid not null references public.content_matrix(id) on delete cascade,
  media_id uuid,
  job_id uuid,
  before jsonb,
  after jsonb,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create index if not exists article_media_events_article_idx
  on public.article_media_events (article_id, created_at desc);
create unique index if not exists article_media_events_idempotency_uidx
  on public.article_media_events (idempotency_key)
  where idempotency_key is not null;

alter table public.article_media_events enable row level security;
revoke all on public.article_media_events from anon, authenticated;
