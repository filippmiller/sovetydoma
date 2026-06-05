-- P1 Profile reliability: guarantee profiles row for every auth.users
-- Run this migration (via supabase CLI or dashboard SQL editor) if not already applied.
-- This makes profile creation guaranteed at DB level for new signups.
-- Idempotent: uses on conflict do nothing, create or replace.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, bio, avatar_url, role, articles_count)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    '',
    '',
    'user',
    0
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- attach trigger (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Optional backfill for any existing auth users missing profile (safe, idempotent)
insert into public.profiles (id, display_name, bio, avatar_url, role, articles_count)
select 
  au.id,
  coalesce(au.raw_user_meta_data ->> 'display_name', split_part(coalesce(au.email, ''), '@', 1)),
  '',
  '',
  'user',
  0
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null
on conflict (id) do nothing;

comment on function public.handle_new_user() is 'Auto-creates minimal profile row for new Supabase Auth users (idempotent).';