begin;
-- Anonymous moderated comments on dynamic (renderer-served) articles.
-- The photo-upload worker POST /article-comment inserts via service_role
-- (bypasses RLS). user_id becomes nullable for anonymous submissions;
-- author_name labels the display name (default «Аноним»).
-- Do NOT add an anon INSERT policy — that would let bots bypass Turnstile
-- and the worker rate limit. Authenticated-user RLS is left unchanged.

-- Allow anonymous comments (worker sets user_id = null).
alter table public.comments alter column user_id drop not null;

-- Display name for anonymous (and optionally authenticated) commenters.
alter table public.comments
  add column if not exists author_name text not null default 'Аноним';

commit;
