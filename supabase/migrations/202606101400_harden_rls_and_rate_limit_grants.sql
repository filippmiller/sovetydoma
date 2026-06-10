-- Security hardening (2026-06-10).
-- 1) notification_check_rate_limit is SECURITY DEFINER and was executable by
--    anon/authenticated, letting any visitor poison rate-limit buckets. Only the
--    worker (service_role) calls it. Restrict execution to service_role.
revoke execute on function public.notification_check_rate_limit(text, integer, integer) from public;
revoke execute on function public.notification_check_rate_limit(text, integer, integer) from anon;
revoke execute on function public.notification_check_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.notification_check_rate_limit(text, integer, integer) to service_role;

-- 2) These tables have RLS enabled but zero policies (implicit deny). Make the
--    service-role-only intent explicit. service_role already bypasses RLS, so
--    this changes no behaviour — anon/authenticated stay denied.
do $$
declare t text;
begin
  foreach t in array array['notification_rate_limits','recipient_social_actions','analytics_sessions','analytics_pageviews','analytics_events']
  loop
    execute format('drop policy if exists %I_service_all on public.%I', t, t);
    execute format('create policy %I_service_all on public.%I for all to service_role using (true) with check (true)', t, t);
  end loop;
end $$;
