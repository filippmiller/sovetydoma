-- Admin control plane (beads sovetydoma-11g.1 / 11g.2 / 11g.3 / 11g.5):
-- 1) Extend content_matrix.text_status with 'unpublished' and 'scheduled' so
--    publish-state changes are instant DB transitions (no static rebuild).
--    The renderer only serves text_status='published', so 'unpublished'
--    immediately removes a dynamic article from public serving.
-- 2) Add scheduled_for + published_via columns (published_via was previously
--    only inside the frontmatter JSONB; promoted for indexing/admin filters).
-- 3) Append-only admin_audit_events (actor/action/before/after/idempotency).
-- 4) article_revisions: full-row snapshots enabling rollback.

-- 1) text_status: drop whatever CHECK currently constrains the column, re-add
--    with the extended state list. Idempotent.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute a
      on a.attrelid = con.conrelid and a.attnum = any(con.conkey)
    where con.conrelid = 'public.content_matrix'::regclass
      and con.contype = 'c'
      and a.attname = 'text_status'
  loop
    execute format('alter table public.content_matrix drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.content_matrix
  add constraint content_matrix_text_status_check
  check (text_status in ('idea','outlined','draft','reviewed','approved','published','unpublished','scheduled'));

-- 2) New columns (nullable; safe additive changes).
alter table public.content_matrix
  add column if not exists scheduled_for timestamptz;
alter table public.content_matrix
  add column if not exists published_via text;

create index if not exists content_matrix_published_via_idx
  on public.content_matrix (published_via)
  where published_via is not null;
create index if not exists content_matrix_scheduled_for_idx
  on public.content_matrix (scheduled_for)
  where scheduled_for is not null and text_status = 'scheduled';

-- 3) Append-only audit events for every privileged admin mutation.
create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  actor_email text,
  action text not null,              -- article.update / article.publish / article.unpublish / media.assign / ...
  target_type text not null,         -- content_matrix | media | taxonomy
  target_id text not null,           -- uuid or slug/key
  before jsonb,
  after jsonb,
  result jsonb,                      -- stored handler result for idempotent replay
  idempotency_key text,
  request_id text,                   -- cf-ray or equivalent correlation id
  created_at timestamptz not null default now()
);

create unique index if not exists admin_audit_events_idempotency_key_uidx
  on public.admin_audit_events (idempotency_key)
  where idempotency_key is not null;
create index if not exists admin_audit_events_target_idx
  on public.admin_audit_events (target_type, target_id, created_at desc);
create index if not exists admin_audit_events_created_at_idx
  on public.admin_audit_events (created_at desc);

alter table public.admin_audit_events enable row level security;
-- No policies: only the service_role key (admin-api worker) may read/write.
revoke all on public.admin_audit_events from anon, authenticated;

-- 4) Full-row revision snapshots for rollback.
create table if not exists public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  matrix_id uuid not null references public.content_matrix(id) on delete cascade,
  revision int not null,
  snapshot jsonb not null,           -- full content_matrix row BEFORE the change
  actor_id uuid,
  created_at timestamptz not null default now(),
  unique (matrix_id, revision)
);

alter table public.article_revisions enable row level security;
revoke all on public.article_revisions from anon, authenticated;
