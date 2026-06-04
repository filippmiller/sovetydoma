create table if not exists public.ingestion_rate_limits (
  id bigserial primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists ingestion_rate_limits_bucket_created_idx
  on public.ingestion_rate_limits (bucket_key, created_at desc);

alter table public.ingestion_rate_limits enable row level security;

create or replace function public.check_ingestion_rate_limit(
  bucket_key text,
  window_seconds int,
  max_hits int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_seconds int := greatest(1, least(coalesce(window_seconds, 60), 86400));
  v_max_hits int := greatest(1, least(coalesce(max_hits, 1), 10000));
  v_since timestamptz := now() - make_interval(secs => v_window_seconds);
  v_count int := 0;
begin
  if nullif(bucket_key, '') is null then
    return jsonb_build_object('allowed', false, 'error', 'missing_bucket');
  end if;

  delete from public.ingestion_rate_limits rl
  where rl.bucket_key = check_ingestion_rate_limit.bucket_key
    and rl.created_at < now() - interval '24 hours';

  perform pg_advisory_xact_lock(hashtextextended(bucket_key, 1001));

  select count(*)::int
  into v_count
  from public.ingestion_rate_limits rl
  where rl.bucket_key = check_ingestion_rate_limit.bucket_key
    and rl.created_at >= v_since;

  if v_count >= v_max_hits then
    return jsonb_build_object('allowed', false, 'remaining', 0);
  end if;

  insert into public.ingestion_rate_limits (bucket_key)
  values (check_ingestion_rate_limit.bucket_key);

  return jsonb_build_object('allowed', true, 'remaining', v_max_hits - v_count - 1);
end;
$$;

revoke all on function public.check_ingestion_rate_limit(text, int, int) from public;
grant execute on function public.check_ingestion_rate_limit(text, int, int) to service_role;
