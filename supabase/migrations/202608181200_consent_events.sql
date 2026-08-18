-- 152-FZ compliance: account-level append-only consent evidence ledger
-- (canon: D:/DEV/CRM-INVITE/COMPLIANCE_152FZ_CANON.md §1.1/§2).
--
-- Deliberately a SIBLING to public.notification_consents (added in
-- 202606021300_omnichannel_subscriptions.sql), not a rewrite of it:
-- notification_consents.recipient_id is NOT NULL and points at
-- notification_recipients (frequency/timezone/delivery_window columns are
-- meaningless for a plain account-registration or contact-form consent), and
-- that table is live-wired into workers/subscriptions/src/index.ts, which is
-- explicitly out of scope to touch. consent_events below is the general
-- account/lead-level ledger used by RegisterForm signup and the contact form.
--
-- Append-only by construction: RLS is enabled with a SELECT-only policy for
-- the owning user. No INSERT/UPDATE/DELETE policy is granted to anon or
-- authenticated, so — per this project's established convention (see
-- 202606101400_harden_rls_and_rate_limit_grants.sql) — those roles are
-- implicitly denied all writes. Only service_role (which bypasses RLS) can
-- write, and it only ever does so via INSERT (see workers/photo-upload/src/consent.ts).
-- This table must NEVER be added to a generic audit-log/log-retention TTL
-- sweep — it is retained indefinitely as legal evidence of consent (canon §3).
--
-- 152-FZ audit 2026-08-18 (P0 fix): the paragraph above, and consent.ts's own
-- header comment, previously claimed immutability was "additionally enforced
-- at the DB level" — it was NOT. RLS-bypass means service_role (used by every
-- worker sharing SUPABASE_SERVICE_ROLE_KEY) could UPDATE/DELETE any row with
-- zero pushback; canon §1.1 explicitly calls for "Postgres: REVOKE UPDATE,
-- оставить только INSERT", and this was skipped. Fixed below with an explicit
-- REVOKE plus a trigger that unconditionally rejects UPDATE/DELETE regardless
-- of role (defense in depth against the REVOKE alone being bypassed by a
-- table-owner/superuser session) — same pattern as medkarta's
-- ConsentEvent_immutable trigger / Chestno.ru's consent_events triggers for
-- this same canon.

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid references auth.users(id) on delete set null,
  subject_lead_id uuid,
  subject_anon_id text,
  purpose text not null check (purpose in ('terms', 'privacy_policy', 'pd_processing_general', 'marketing')),
  document_version text not null,
  document_hash text,
  granted boolean not null default true,
  method text not null check (method in ('signup', 'lead_form', 'settings', 're_accept', 'continued_use')),
  ip_hash text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint consent_events_subject_present check (
    subject_user_id is not null or subject_lead_id is not null or subject_anon_id is not null
  )
);

create index if not exists consent_events_subject_user_id_idx on public.consent_events(subject_user_id);
create index if not exists consent_events_subject_lead_id_idx on public.consent_events(subject_lead_id);
create index if not exists consent_events_purpose_idx on public.consent_events(purpose);

alter table public.consent_events enable row level security;

drop policy if exists "users can read own consent events" on public.consent_events;
create policy "users can read own consent events" on public.consent_events
  for select to authenticated using (auth.uid() = subject_user_id);

-- Explicit REVOKE (belt-and-suspenders on top of "no policy = implicit deny"
-- for anon/authenticated), and — critically — from service_role too, which
-- bypasses RLS entirely and would otherwise retain whatever UPDATE/DELETE
-- privilege Supabase's default-privileges grant it on new tables.
revoke insert, update, delete on public.consent_events from anon, authenticated;
revoke update, delete on public.consent_events from service_role;

-- Defense in depth: a trigger fires regardless of role (RLS bypass, default
-- privileges, or a future migration accidentally re-granting UPDATE/DELETE
-- all fail to matter here) and unconditionally rejects any attempt to modify
-- or remove an existing row. consent_events is legal evidence; once written,
-- a row must never change or disappear.
create or replace function public.consent_events_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'consent_events is append-only: % is not permitted on existing rows', tg_op;
end;
$$;

drop trigger if exists consent_events_immutable on public.consent_events;
create trigger consent_events_immutable
  before update or delete on public.consent_events
  for each row execute function public.consent_events_block_mutation();
