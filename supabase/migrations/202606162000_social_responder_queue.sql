begin;
-- Social responder queue: incoming VK/FB comments + DMs, with a Claude-drafted
-- reply held for human review (draft-review-first; nothing is sent until an
-- admin approves). The subscriptions worker writes via the service role.

create table if not exists public.social_responder_queue (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('vk','fb')),
  event_type text not null check (event_type in ('comment','message')),
  group_ref text,                 -- VK group id / FB page id
  thread_ref text,                -- post id / conversation (peer) id
  external_id text not null,      -- comment id / message id (for dedup + reply target)
  from_ref text,                  -- author id (never reply to our own group/bot)
  incoming_text text,
  draft_reply text,               -- Claude-generated suggestion
  sent_reply text,                -- what was actually posted (may be admin-edited)
  status text not null default 'pending_review'
    check (status in ('pending_review','approved','sent','skipped','failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_id)  -- idempotency: webhook retries don't double-enqueue
);

create index if not exists idx_responder_status_created
  on public.social_responder_queue (status, created_at desc);

alter table public.social_responder_queue enable row level security;

-- service_role only writes (worker). No anon/authenticated grants.
create policy "service_role all responder" on public.social_responder_queue
  for all to service_role using (true) with check (true);

-- Moderators/admins read + update (approve/edit/skip) via their authenticated session.
create policy "moderators manage responder" on public.social_responder_queue
  for all to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any(array['moderator','admin']))
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any(array['moderator','admin']))
  );

revoke all on public.social_responder_queue from anon;
commit;
