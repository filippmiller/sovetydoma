create or replace function public.ingest_analytics_event(event_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_name text := coalesce(event_data->>'event_name', '');
  v_session_id text := nullif(event_data->>'session_id', '');
  v_pageview_id text := nullif(event_data->>'pageview_id', '');
  v_visitor_id text := nullif(event_data->>'visitor_id', '');
  v_path text := left(coalesce(event_data->>'path', ''), 500);
  v_duration int := greatest(0, least(coalesce((event_data->>'duration_seconds')::int, 0), 86400));
  v_classification text := coalesce(nullif(event_data->>'classification', ''), 'unknown');
  v_page_inserted int := 0;
begin
  if v_session_id is null or v_visitor_id is null or v_event_name = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_required_fields');
  end if;

  insert into public.analytics_sessions (
    id,
    visitor_id,
    started_at,
    last_seen_at,
    classification,
    bot_reason,
    landing_path,
    exit_path,
    referrer,
    referrer_domain,
    utm_source,
    utm_medium,
    utm_campaign,
    country,
    device_type,
    browser,
    os,
    language,
    timezone,
    viewport_width,
    viewport_height
  ) values (
    v_session_id,
    v_visitor_id,
    now(),
    now(),
    v_classification,
    nullif(event_data->>'bot_reason', ''),
    nullif(v_path, ''),
    nullif(v_path, ''),
    nullif(left(coalesce(event_data->>'referrer', ''), 1000), ''),
    nullif(left(coalesce(event_data->>'referrer_domain', ''), 200), ''),
    nullif(left(coalesce(event_data->>'utm_source', ''), 120), ''),
    nullif(left(coalesce(event_data->>'utm_medium', ''), 120), ''),
    nullif(left(coalesce(event_data->>'utm_campaign', ''), 200), ''),
    nullif(left(coalesce(event_data->>'country', ''), 16), ''),
    nullif(left(coalesce(event_data->>'device_type', ''), 40), ''),
    nullif(left(coalesce(event_data->>'browser', ''), 80), ''),
    nullif(left(coalesce(event_data->>'os', ''), 80), ''),
    nullif(left(coalesce(event_data->>'language', ''), 40), ''),
    nullif(left(coalesce(event_data->>'timezone', ''), 80), ''),
    nullif(event_data->>'viewport_width', '')::int,
    nullif(event_data->>'viewport_height', '')::int
  )
  on conflict (id) do update set
    last_seen_at = now(),
    updated_at = now(),
    classification = case
      when analytics_sessions.classification = 'bot' then 'bot'
      when excluded.classification = 'bot' then 'bot'
      when analytics_sessions.classification = 'human' then 'human'
      else excluded.classification
    end,
    bot_reason = coalesce(excluded.bot_reason, analytics_sessions.bot_reason),
    exit_path = coalesce(nullif(v_path, ''), analytics_sessions.exit_path),
    country = coalesce(excluded.country, analytics_sessions.country),
    device_type = coalesce(excluded.device_type, analytics_sessions.device_type),
    browser = coalesce(excluded.browser, analytics_sessions.browser),
    os = coalesce(excluded.os, analytics_sessions.os),
    language = coalesce(excluded.language, analytics_sessions.language),
    timezone = coalesce(excluded.timezone, analytics_sessions.timezone),
    viewport_width = coalesce(excluded.viewport_width, analytics_sessions.viewport_width),
    viewport_height = coalesce(excluded.viewport_height, analytics_sessions.viewport_height);

  if v_event_name = 'page_view_start' and v_pageview_id is not null then
    insert into public.analytics_pageviews (
      id,
      session_id,
      visitor_id,
      path,
      title,
      article_slug,
      category,
      referrer,
      started_at,
      sequence_index,
      classification
    ) values (
      v_pageview_id,
      v_session_id,
      v_visitor_id,
      v_path,
      nullif(left(coalesce(event_data->>'title', ''), 300), ''),
      nullif(left(coalesce(event_data->>'article_slug', ''), 160), ''),
      nullif(left(coalesce(event_data->>'category', ''), 120), ''),
      nullif(left(coalesce(event_data->>'referrer', ''), 1000), ''),
      now(),
      greatest(0, coalesce((event_data->>'sequence_index')::int, 0)),
      v_classification
    )
    on conflict (id) do nothing;

    get diagnostics v_page_inserted = row_count;
    if v_page_inserted > 0 then
      update public.analytics_sessions
      set page_count = page_count + 1,
          updated_at = now()
      where id = v_session_id;
    end if;
  elsif v_event_name = 'page_view_end' and v_pageview_id is not null then
    update public.analytics_pageviews
    set ended_at = now(),
        duration_seconds = greatest(coalesce(duration_seconds, 0), v_duration),
        updated_at = now()
    where id = v_pageview_id;

    update public.analytics_sessions
    set total_duration_seconds = coalesce((
          select sum(coalesce(duration_seconds, 0))::int
          from public.analytics_pageviews
          where session_id = v_session_id
        ), 0),
        exit_path = coalesce(nullif(v_path, ''), exit_path),
        last_seen_at = now(),
        updated_at = now()
    where id = v_session_id;
  end if;

  insert into public.analytics_events (
    session_id,
    pageview_id,
    visitor_id,
    event_name,
    path,
    payload,
    classification
  ) values (
    v_session_id,
    v_pageview_id,
    v_visitor_id,
    v_event_name,
    nullif(v_path, ''),
    coalesce(event_data->'payload', '{}'::jsonb),
    v_classification
  );

  return jsonb_build_object('ok', true);
end;
$$;
