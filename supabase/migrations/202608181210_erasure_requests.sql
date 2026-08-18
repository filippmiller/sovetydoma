-- 152-FZ compliance: self-service account erasure, two-phase soft-delete
-- (canon: D:/DEV/CRM-INVITE/COMPLIANCE_152FZ_CANON.md §1.2/§3, gdeUslugi/
-- localsdoit reference pattern). This row IS the audit-log entry the canon
-- requires be written before the anonymizing mutation: it is inserted at
-- request time (status='pending') and the anonymize mutation only happens
-- later, when the retention worker finalizes it after grace_period_ends_at.
--
-- Scope note (see workers/photo-upload/src/erasure.ts for the actual
-- anonymize step): finalization anonymizes public.profiles / public.comments
-- / public.saved_articles / public.user_articles only, per this site's task
-- scope. It does NOT delete or ban the auth.users row — see erasure.ts
-- comment + session report for the LEGAL follow-up this implies.

create table if not exists public.erasure_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  grace_period_ends_at timestamptz not null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  ip_hash text not null,
  user_agent text
);

create index if not exists erasure_requests_user_id_idx on public.erasure_requests(user_id);
create index if not exists erasure_requests_status_idx on public.erasure_requests(status);
create index if not exists erasure_requests_grace_period_ends_at_idx on public.erasure_requests(grace_period_ends_at);

-- At most one active (pending) request per user — the worker also checks this
-- before inserting, but the partial unique index makes it a DB-level guarantee.
create unique index if not exists erasure_requests_one_pending_per_user
  on public.erasure_requests(user_id) where status = 'pending';

alter table public.erasure_requests enable row level security;

-- Read-only for the owner (so moy-kabinet can show "scheduled for <date>").
-- All writes (request/cancel/finalize) go through the service-role worker,
-- which is the only place ip_hash/user_agent/grace_period_ends_at are
-- computed and where the audit-before-mutation ordering can be guaranteed.
drop policy if exists "users can read own erasure requests" on public.erasure_requests;
create policy "users can read own erasure requests" on public.erasure_requests
  for select to authenticated using (auth.uid() = user_id);
