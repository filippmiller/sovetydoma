-- Tighten EXECUTE on public functions (beads sovetydoma-5sn / -u15).
-- Found on the live DB: admin-only analytics RPCs and internal trigger helpers
-- were executable by anon/authenticated. Restrict to the minimum needed.

begin;

-- Admin analytics RPCs: only the service-role worker calls these, and it
-- validates the caller is an admin first (validateAdmin in the worker). End
-- users (anon/authenticated) must not be able to invoke them directly.
revoke execute on function public.admin_analytics_summary(integer) from public, anon, authenticated;
revoke execute on function public.admin_analytics_recent_sessions(integer, integer) from public, anon, authenticated;
grant execute on function public.admin_analytics_summary(integer) to service_role;
grant execute on function public.admin_analytics_recent_sessions(integer, integer) to service_role;

-- Trigger / helper functions are invoked by the trigger machinery (running as the
-- table owner), never called directly by a client. Drop the default PUBLIC/anon/
-- authenticated EXECUTE surface — triggers keep firing regardless of these grants.
revoke execute on function public.enforce_ugc_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.tg_rate_limit_comments() from public, anon, authenticated;
revoke execute on function public.tg_rate_limit_feedback() from public, anon, authenticated;
revoke execute on function public.tg_rate_limit_questions() from public, anon, authenticated;
revoke execute on function public.tg_rate_limit_user_articles() from public, anon, authenticated;
revoke execute on function public.guard_profiles_role() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

commit;
