-- Supabase security-advisor remediation (2026-06-10). All items verified safe:
-- affected functions are triggers or worker-only (service role); matrix views
-- are queried by the pipeline with the service role; feedback client inserts are
-- auth-gated. Closes: rls_enabled_no_policy, security_definer_view,
-- function_search_path_mutable, permissive feedback_events INSERT, and
-- anon/authenticated-executable SECURITY DEFINER functions.

-- 1) Explicit service_role policies on RLS-enabled-but-policyless tables.
do $$ declare t text; begin
  foreach t in array array['ingestion_rate_limits','notification_confirmations','notification_suppression_list'] loop
    execute format('drop policy if exists %I_service_all on public.%I', t, t);
    execute format('create policy %I_service_all on public.%I for all to service_role using (true) with check (true)', t, t);
  end loop;
end $$;

-- 2) Matrix views run as the querying role (pipeline uses service_role).
alter view public.v_images_to_generate set (security_invoker = on);
alter view public.v_ready_to_write set (security_invoker = on);
alter view public.v_publish_queue set (security_invoker = on);

-- 3) Pin search_path on flagged functions.
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('set_updated_at','admin_analytics_summary','admin_analytics_recent_sessions')
  loop execute format('alter function %s set search_path = public', r.sig); end loop;
end $$;

-- 4) Restrict EXECUTE on SECURITY DEFINER functions to service_role. They are
--    triggers (bump_feedback_counter, handle_new_user, refresh_answers_count) or
--    worker-only (check_ingestion_rate_limit, ingest_analytics_event). Revoke
--    the default PUBLIC grant plus anon/authenticated; keep service_role.
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('bump_feedback_counter','handle_new_user','refresh_answers_count','check_ingestion_rate_limit','ingest_analytics_event')
  loop
    execute format('revoke execute on function %s from public', r.sig);
    execute format('revoke execute on function %s from anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- 5) feedback_events: no anonymous inserts. Authenticated users insert only
--    their own rows; worker view-tracking uses service_role (bypasses RLS).
drop policy if exists "Anyone can submit feedback" on public.feedback_events;
create policy "Authenticated can submit own feedback" on public.feedback_events
  for insert to authenticated with check (auth.uid() = user_id);
