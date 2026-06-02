create table if not exists public.analytics_sessions (
  id text primary key,
  visitor_id text not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  classification text not null default 'unknown',
  bot_reason text,
  landing_path text,
  exit_path text,
  referrer text,
  referrer_domain text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  country text,
  device_type text,
  browser text,
  os text,
  language text,
  timezone text,
  viewport_width int,
  viewport_height int,
  page_count int not null default 0,
  total_duration_seconds int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_pageviews (
  id text primary key,
  session_id text not null references public.analytics_sessions(id) on delete cascade,
  visitor_id text not null,
  path text not null,
  title text,
  article_slug text,
  category text,
  referrer text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,
  sequence_index int not null default 0,
  classification text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  session_id text references public.analytics_sessions(id) on delete cascade,
  pageview_id text references public.analytics_pageviews(id) on delete cascade,
  visitor_id text,
  event_name text not null,
  path text,
  payload jsonb not null default '{}',
  classification text not null default 'unknown',
  created_at timestamptz not null default now()
);

create index if not exists analytics_sessions_started_at_idx on public.analytics_sessions(started_at desc);
create index if not exists analytics_sessions_classification_idx on public.analytics_sessions(classification);
create index if not exists analytics_sessions_referrer_domain_idx on public.analytics_sessions(referrer_domain);
create index if not exists analytics_pageviews_started_at_idx on public.analytics_pageviews(started_at desc);
create index if not exists analytics_pageviews_path_idx on public.analytics_pageviews(path);
create index if not exists analytics_pageviews_session_id_idx on public.analytics_pageviews(session_id);
create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at desc);

alter table public.analytics_sessions enable row level security;
alter table public.analytics_pageviews enable row level security;
alter table public.analytics_events enable row level security;

create or replace function public.admin_analytics_summary(days_back int default 7)
returns jsonb
language sql
stable
as $$
  with bounds as (
    select now() - make_interval(days => greatest(1, least(days_back, 90))) as since
  ),
  sessions as (
    select *
    from public.analytics_sessions, bounds
    where started_at >= bounds.since
  ),
  pageviews as (
    select *
    from public.analytics_pageviews, bounds
    where started_at >= bounds.since
  ),
  human_sessions as (
    select *
    from sessions
    where classification in ('human', 'likely_human')
  ),
  top_pages as (
    select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) as data
    from (
      select
        path,
        count(*)::int as views,
        count(distinct session_id)::int as sessions,
        coalesce(round(avg(nullif(duration_seconds, 0)))::int, 0) as avg_duration_seconds
      from pageviews
      where classification in ('human', 'likely_human')
      group by path
      order by views desc, sessions desc
      limit 20
    ) t
  ),
  referrers as (
    select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) as data
    from (
      select
        coalesce(nullif(referrer_domain, ''), 'direct') as source,
        count(*)::int as sessions
      from human_sessions
      group by coalesce(nullif(referrer_domain, ''), 'direct')
      order by sessions desc
      limit 20
    ) t
  ),
  paths as (
    select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) as data
    from (
      select
        coalesce(landing_path, '') as landing_path,
        coalesce(exit_path, '') as exit_path,
        count(*)::int as sessions
      from human_sessions
      group by coalesce(landing_path, ''), coalesce(exit_path, '')
      order by sessions desc
      limit 20
    ) t
  ),
  countries as (
    select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) as data
    from (
      select
        coalesce(nullif(country, ''), 'unknown') as country,
        count(*)::int as sessions
      from human_sessions
      group by coalesce(nullif(country, ''), 'unknown')
      order by sessions desc
      limit 20
    ) t
  ),
  daily as (
    select coalesce(jsonb_agg(row_to_json(t)::jsonb order by day), '[]'::jsonb) as data
    from (
      select
        date_trunc('day', started_at)::date as day,
        count(*) filter (where classification in ('human', 'likely_human'))::int as human_sessions,
        count(*) filter (where classification = 'bot')::int as bot_sessions,
        count(*)::int as total_sessions
      from sessions
      group by date_trunc('day', started_at)::date
      order by day
    ) t
  )
  select jsonb_build_object(
    'sessions_total', (select count(*) from sessions),
    'sessions_human', (select count(*) from human_sessions),
    'sessions_bot', (select count(*) from sessions where classification = 'bot'),
    'pageviews_human', (select count(*) from pageviews where classification in ('human', 'likely_human')),
    'avg_session_seconds', coalesce((select round(avg(nullif(total_duration_seconds, 0)))::int from human_sessions), 0),
    'bounce_rate', coalesce((
      select round((count(*) filter (where page_count <= 1)::numeric / nullif(count(*), 0)) * 100, 1)
      from human_sessions
    ), 0),
    'top_pages', (select data from top_pages),
    'referrers', (select data from referrers),
    'paths', (select data from paths),
    'countries', (select data from countries),
    'daily', (select data from daily)
  );
$$;

create or replace function public.admin_analytics_recent_sessions(days_back int default 7, row_limit int default 50)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  from (
    select
      id,
      started_at,
      last_seen_at,
      classification,
      bot_reason,
      landing_path,
      exit_path,
      referrer_domain,
      country,
      device_type,
      browser,
      os,
      page_count,
      total_duration_seconds
    from public.analytics_sessions
    where started_at >= now() - make_interval(days => greatest(1, least(days_back, 90)))
    order by started_at desc
    limit greatest(1, least(row_limit, 200))
  ) t;
$$;
