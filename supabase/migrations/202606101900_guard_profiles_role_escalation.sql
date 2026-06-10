-- SECURITY P0 (audit 2026-06-10): privilege-escalation fix.
-- The "Users can update own profile" RLS policy on public.profiles had
-- USING (auth.uid() = id) and NO with-check / column guard, so any
-- authenticated user could run `update profiles set role='admin'` on their
-- own row and pass the client admin gate (useAdminAuth checks profiles.role).
--
-- This trigger reverts any role change attempted by a browser-facing JWT role
-- (authenticated/anon via PostgREST). Direct SQL (no jwt claims) and the
-- service_role can still assign roles legitimately. The JSON parse is guarded
-- so an unset/empty/invalid request.jwt.claims never breaks profile updates.
create or replace function public.guard_profiles_role()
returns trigger
language plpgsql
as $$
declare
  claims text := current_setting('request.jwt.claims', true);
  jwt_role text := '';
begin
  if claims is not null and claims <> '' then
    begin
      jwt_role := coalesce((claims::json ->> 'role'), '');
    exception when others then
      jwt_role := '';
    end;
  end if;
  if new.role is distinct from old.role and jwt_role in ('authenticated', 'anon') then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profiles_role on public.profiles;
create trigger trg_guard_profiles_role
  before update on public.profiles
  for each row execute function public.guard_profiles_role();
