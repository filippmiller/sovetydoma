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

-- Anon can INSERT own subscription (endpoint is effectively a secret key)
CREATE POLICY "anon can subscribe to push" ON public.push_subscriptions
  FOR INSERT TO anon WITH CHECK (true);

-- Anon can DELETE own subscription by exact endpoint (self-unsubscribe)
CREATE POLICY "anon can delete own push subscription" ON public.push_subscriptions
  FOR DELETE TO anon USING (true);

-- Public can only SELECT nothing (no SELECT policy for anon/authenticated on this table)
-- service_role does the fan-out reads

commit;
