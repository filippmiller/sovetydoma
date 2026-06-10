-- Version-control the RLS policies for core UGC tables (bead sovetydoma-39y).
--
-- These tables (comments, user_articles, photos, feedback_events, ratings,
-- reactions, saved_articles, profiles, questions) had RLS enabled with working
-- policies on the live DB, but those policies were created via the Supabase
-- dashboard and were never captured in git — so they could not be code-reviewed,
-- diffed, or audited in CI. This migration codifies the *current* live policy set
-- verbatim (idempotent drop+create), so applying it to the live DB is a no-op and
-- git becomes the source of truth. One hardening change is included and noted.
--
-- Access model (unchanged): every write is authenticated and ownership-checked
-- (auth.uid() = user_id / id / author_id); anonymous writes are denied at the DB
-- and the only anon ingestion path (article views) goes through the service-role
-- worker proxy (/view). Moderators (profiles.role in moderator|admin) manage all.

begin;

-- Ensure RLS is on (no-op where already enabled).
alter table public.comments        enable row level security;
alter table public.user_articles   enable row level security;
alter table public.photos          enable row level security;
alter table public.feedback_events enable row level security;
alter table public.ratings         enable row level security;
alter table public.reactions       enable row level security;
alter table public.saved_articles  enable row level security;
alter table public.profiles        enable row level security;
alter table public.questions       enable row level security;

-- ---------------------------------------------------------------- comments
drop policy if exists "Approved comments viewable by everyone" on public.comments;
create policy "Approved comments viewable by everyone" on public.comments
  for select to public using (is_approved = true and is_deleted = false);

drop policy if exists "Users see own comments" on public.comments;
create policy "Users see own comments" on public.comments
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can insert own comments" on public.comments;
create policy "Users can insert own comments" on public.comments
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update own comments" on public.comments;
create policy "Users can update own comments" on public.comments
  for update to authenticated using (auth.uid() = user_id)
  -- HARDENING: live policy had USING but no WITH CHECK, so an owner could mutate
  -- their row into an invalid/unowned state. Pin the post-update row to the owner.
  with check (auth.uid() = user_id);

drop policy if exists "Moderators can manage all comments" on public.comments;
create policy "Moderators can manage all comments" on public.comments
  for all to public using (
    exists (select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.role = any (array['moderator','admin']))
  );

-- ------------------------------------------------------------ user_articles
drop policy if exists "Approved articles viewable by everyone" on public.user_articles;
create policy "Approved articles viewable by everyone" on public.user_articles
  for select to public using (status = 'approved');

drop policy if exists "Authors can see own articles" on public.user_articles;
create policy "Authors can see own articles" on public.user_articles
  for select to public using (auth.uid() = author_id);

drop policy if exists "Authors can insert articles" on public.user_articles;
create policy "Authors can insert articles" on public.user_articles
  for insert to public with check (auth.uid() = author_id);

drop policy if exists "Authors can update own draft articles" on public.user_articles;
create policy "Authors can update own draft articles" on public.user_articles
  for update to public using (auth.uid() = author_id and status = any (array['draft','rejected']));

drop policy if exists "Moderators can manage all articles" on public.user_articles;
create policy "Moderators can manage all articles" on public.user_articles
  for all to public using (
    exists (select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.role = any (array['moderator','admin']))
  );

-- ------------------------------------------------------------------- photos
drop policy if exists "Approved photos are public" on public.photos;
create policy "Approved photos are public" on public.photos
  for select to public using (status = 'approved');

drop policy if exists "Users see own photos" on public.photos;
create policy "Users see own photos" on public.photos
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Authed users can submit photos" on public.photos;
create policy "Authed users can submit photos" on public.photos
  for insert to authenticated with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Moderators manage photos" on public.photos;
create policy "Moderators manage photos" on public.photos
  for all to public using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role = any (array['moderator','admin']))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role = any (array['moderator','admin']))
  );

-- ----------------------------------------------------------- feedback_events
-- Anonymous feedback (article views) is ingested only by the service-role worker
-- (/view) which bypasses RLS; authenticated feedback inserts its own rows here.
drop policy if exists "Authenticated can submit own feedback" on public.feedback_events;
create policy "Authenticated can submit own feedback" on public.feedback_events
  for insert to authenticated with check (auth.uid() = user_id);

-- ------------------------------------------------------------------ ratings
-- ALL policy: USING also applies as the INSERT/UPDATE check when WITH CHECK is
-- omitted, so ownership is enforced on writes.
drop policy if exists "Ratings viewable by everyone" on public.ratings;
create policy "Ratings viewable by everyone" on public.ratings
  for select to public using (true);

drop policy if exists "Users can manage own ratings" on public.ratings;
create policy "Users can manage own ratings" on public.ratings
  for all to public using (auth.uid() = user_id);

-- ---------------------------------------------------------------- reactions
drop policy if exists "Reactions viewable by everyone" on public.reactions;
create policy "Reactions viewable by everyone" on public.reactions
  for select to public using (true);

drop policy if exists "Users can manage own reactions" on public.reactions;
create policy "Users can manage own reactions" on public.reactions
  for all to public using (auth.uid() = user_id);

-- ------------------------------------------------------------ saved_articles
drop policy if exists "Users can manage own saved articles" on public.saved_articles;
create policy "Users can manage own saved articles" on public.saved_articles
  for all to public using (auth.uid() = user_id);

-- ----------------------------------------------------------------- profiles
-- profiles.role self-escalation is blocked separately (202606101900). Public
-- read is intentional (author pages). Update pinned to own id.
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone" on public.profiles
  for select to public using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert to public with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update to public using (auth.uid() = id);

-- ----------------------------------------------------------------- questions
drop policy if exists "Approved questions are public" on public.questions;
create policy "Approved questions are public" on public.questions
  for select to public using (status = 'approved');

drop policy if exists "Users see own questions" on public.questions;
create policy "Users see own questions" on public.questions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Authed users can ask" on public.questions;
create policy "Authed users can ask" on public.questions
  for insert to authenticated with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Moderators manage questions" on public.questions;
create policy "Moderators manage questions" on public.questions
  for all to public using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role = any (array['moderator','admin']))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role = any (array['moderator','admin']))
  );

commit;
