-- Durable, non-bypassable rate limiting for authenticated UGC text writes
-- (bead sovetydoma-gx3). RLS already enforces ownership (auth.uid() = user_id),
-- but a single logged-in account could still flood comments/questions/articles/
-- feedback. A worker proxy would NOT prevent this — while RLS permits authenticated
-- inserts, a user can always call PostgREST directly with their JWT and skip the
-- proxy. A BEFORE INSERT trigger fires regardless of client, so the limit cannot
-- be bypassed.
--
-- Reuses the advisory-lock counter table from 202606040620_ingestion_rate_limits.
--
-- IMPORTANT: the trigger no-ops when auth.uid() is NULL. The only writer with a
-- null uid is the service-role worker (e.g. the /view anon-view ingestion), which
-- is legitimately high-volume and already rate-limited at the edge. Anonymous
-- direct writes are denied by RLS, so they never reach the trigger anyway.

begin;

create or replace function public.enforce_ugc_rate_limit(
  p_scope text,
  p_window_seconds int,
  p_max_hits int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bucket text;
  v_since timestamptz := now() - make_interval(secs => greatest(1, p_window_seconds));
  v_count int;
begin
  -- Only throttle real end-user (authenticated) writes. Service-role (worker)
  -- and anon paths are out of scope and must not be blocked here.
  if v_uid is null then
    return;
  end if;

  v_bucket := 'ugc:' || p_scope || ':' || v_uid::text;

  delete from public.ingestion_rate_limits rl
  where rl.bucket_key = v_bucket
    and rl.created_at < now() - interval '24 hours';

  perform pg_advisory_xact_lock(hashtextextended(v_bucket, 1001));

  select count(*)::int into v_count
  from public.ingestion_rate_limits rl
  where rl.bucket_key = v_bucket
    and rl.created_at >= v_since;

  if v_count >= greatest(1, p_max_hits) then
    raise exception 'rate_limited: too many % in the last % seconds', p_scope, p_window_seconds
      using errcode = 'check_violation';
  end if;

  insert into public.ingestion_rate_limits (bucket_key) values (v_bucket);
end;
$$;

revoke all on function public.enforce_ugc_rate_limit(text, int, int) from public;
-- Trigger functions execute as the table owner regardless of caller grants, but
-- keep execute off the public API surface.

-- Per-table trigger wrappers (a trigger fn takes no args, so wrap the limits).
create or replace function public.tg_rate_limit_comments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_ugc_rate_limit('comment', 60, 4);      -- <=4 / minute
  perform public.enforce_ugc_rate_limit('comment', 3600, 30);   -- <=30 / hour
  return new;
end; $$;

create or replace function public.tg_rate_limit_questions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_ugc_rate_limit('question', 300, 3);    -- <=3 / 5 min
  perform public.enforce_ugc_rate_limit('question', 86400, 15); -- <=15 / day
  return new;
end; $$;

create or replace function public.tg_rate_limit_user_articles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_ugc_rate_limit('article', 600, 2);     -- <=2 / 10 min
  perform public.enforce_ugc_rate_limit('article', 86400, 10);  -- <=10 / day
  return new;
end; $$;

create or replace function public.tg_rate_limit_feedback()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_ugc_rate_limit('feedback', 60, 12);    -- <=12 / minute
  perform public.enforce_ugc_rate_limit('feedback', 3600, 80);  -- <=80 / hour
  return new;
end; $$;

drop trigger if exists trg_rate_limit_comments on public.comments;
create trigger trg_rate_limit_comments
  before insert on public.comments
  for each row execute function public.tg_rate_limit_comments();

drop trigger if exists trg_rate_limit_questions on public.questions;
create trigger trg_rate_limit_questions
  before insert on public.questions
  for each row execute function public.tg_rate_limit_questions();

drop trigger if exists trg_rate_limit_user_articles on public.user_articles;
create trigger trg_rate_limit_user_articles
  before insert on public.user_articles
  for each row execute function public.tg_rate_limit_user_articles();

drop trigger if exists trg_rate_limit_feedback on public.feedback_events;
create trigger trg_rate_limit_feedback
  before insert on public.feedback_events
  for each row execute function public.tg_rate_limit_feedback();

commit;
