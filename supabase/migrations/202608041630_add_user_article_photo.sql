-- A user recipe can carry one optional dish photo stored in the existing
-- authenticated R2 upload flow. The object key, not a public URL, is stored.
alter table public.user_articles
  add column if not exists photo_path text;

comment on column public.user_articles.photo_path is
  'Optional R2 object key for a user-submitted recipe photo; populated only after authenticated upload.';
