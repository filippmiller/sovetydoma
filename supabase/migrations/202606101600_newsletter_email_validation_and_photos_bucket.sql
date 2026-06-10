-- 1) Replace the always-true newsletter INSERT policy with email format validation.
--    Still allows anonymous subscriptions; now rejects malformed emails at the DB layer.
drop policy if exists "Anyone can subscribe" on public.newsletter_subscribers;
create policy "Anyone can subscribe with valid email" on public.newsletter_subscribers
  for insert to anon, authenticated
  with check (
    email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
    and char_length(email) <= 254
  );

-- 2) Photos bucket: replace the broad object SELECT with a path-scoped policy.
--    Allows reading individual objects (needed for public URLs) but prevents
--    listing all files in the bucket via the PostgREST /storage/v1/object endpoint.
drop policy if exists "photos read public" on storage.objects;
create policy "photos read public by path" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] is not null
  );
