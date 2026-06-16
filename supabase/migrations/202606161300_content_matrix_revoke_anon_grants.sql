-- SECURITY M4 (audit 2026-06-15): content_matrix and content_matrix_events held
-- full table grants for anon + authenticated (SELECT/INSERT/UPDATE/DELETE), so
-- only RLS stood between the public anon key and every draft row. The renderer
-- worker and seed/agent scripts use the service_role key (which bypasses both
-- grants and RLS), and no anon/authenticated client reads these tables. Revoke
-- the grants for defense-in-depth: even if a future migration accidentally
-- disabled RLS or added a permissive policy, the public anon key still could
-- not read unpublished drafts via PostgREST.
revoke all on public.content_matrix from anon, authenticated;
revoke all on public.content_matrix_events from anon, authenticated;
