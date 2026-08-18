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
