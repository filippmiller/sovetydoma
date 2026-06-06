-- Table for tracking social media autoposting results
-- Admin/service-role only. No public write access.

create table if not exists public.social_publications (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('vk')),
  article_slug text not null references public.articles_publication_index(article_slug) on delete restrict,
  body_hash text not null,
  status text not null check (status in ('dry_run', 'posted', 'failed')) default 'dry_run',
  provider_post_id text,
  provider_payload jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique(platform, article_slug)
);

-- Enable RLS
alter table public.social_publications enable row level security;

-- No public write policy; admin/service-role only via Worker secrets
-- Read-only policy for authenticated users if needed later; for now keep fully private
