-- Allow Facebook as a social publication platform alongside VK.
alter table public.social_publications
  drop constraint if exists social_publications_platform_check;

alter table public.social_publications
  add constraint social_publications_platform_check
  check (platform in ('vk', 'fb'));
