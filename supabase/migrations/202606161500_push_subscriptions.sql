begin;
-- Feature 10: Web Push subscriptions for followed categories
-- One row per subscription + category. User can subscribe to multiple categories via multiple rows.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  category text not null,
  created_at timestamptz default now()
);

-- Index for fast fan-out per category
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_category ON public.push_subscriptions(category);

-- Enable RLS
alter table public.push_subscriptions enable row level security;

-- Default-deny: service_role explicit all access (for fan-out worker)
CREATE POLICY "service_role all access on push_subscriptions" ON public.push_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- NO anon policies. Subscribe + unsubscribe go through worker endpoints
-- (/push/subscribe, /push/unsubscribe) which write via the service role. A
-- `FOR DELETE TO anon USING (true)` policy (as originally drafted) would let
-- anyone holding the PUBLIC anon key run `DELETE FROM push_subscriptions` and
-- wipe every subscription, so it is intentionally omitted.

-- Defense-in-depth: strip default table grants so the public anon key cannot
-- read or mutate this table via PostgREST even if a policy is added later.
revoke all on public.push_subscriptions from anon, authenticated;

commit;
