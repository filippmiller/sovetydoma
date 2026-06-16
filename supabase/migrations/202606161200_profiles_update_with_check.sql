-- SECURITY M1 (audit 2026-06-15): the "Users can update own profile" policy on
-- public.profiles had USING (auth.uid() = id) but NO with-check clause, so the
-- post-update row was unconstrained by RLS. Role escalation was already blocked
-- by the guard_profiles_role() trigger (202606101900), but the RLS layer should
-- enforce ownership too (belt-and-suspenders) and the policy should target the
-- authenticated role rather than public (anon can never satisfy auth.uid()=id).
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
