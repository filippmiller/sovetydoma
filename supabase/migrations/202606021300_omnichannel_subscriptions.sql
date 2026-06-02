create extension if not exists pgcrypto;

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_key text,
  status text not null default 'active' check (status in ('active', 'paused', 'suppressed')),
  frequency text not null default 'weekly_digest_3' check (frequency in ('daily_one', 'daily_digest_3', 'weekly_digest_3', 'weekly_digest_7')),
  timezone text not null default 'Europe/Moscow',
  delivery_window text not null default 'evening' check (delivery_window in ('morning', 'day', 'evening')),
  source_path text not null default '/',
  manage_token_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_recipient_identity check (user_id is not null or anonymous_key is not null)
);

create index if not exists notification_recipients_user_id_idx on public.notification_recipients(user_id);
create index if not exists notification_recipients_anonymous_key_idx on public.notification_recipients(anonymous_key);
create index if not exists notification_recipients_status_idx on public.notification_recipients(status);

create table if not exists public.notification_contacts (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.notification_recipients(id) on delete cascade,
  channel text not null check (channel in ('email', 'telegram', 'max', 'whatsapp', 'sms')),
  contact_value text not null,
  normalized_contact_value text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'paused', 'failed', 'unsubscribed', 'provider_unconfigured')),
  confirmed_at timestamptz,
  provider_metadata jsonb not null default '{}'::jsonb,
  unsubscribe_token_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, normalized_contact_value)
);

create index if not exists notification_contacts_recipient_id_idx on public.notification_contacts(recipient_id);
create index if not exists notification_contacts_channel_idx on public.notification_contacts(channel);
create index if not exists notification_contacts_status_idx on public.notification_contacts(status);

create table if not exists public.notification_topic_subscriptions (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.notification_recipients(id) on delete cascade,
  category_slug text not null check (category_slug in ('kulinaria', 'dom-i-uborka', 'dacha-i-ogorod', 'layfkhaki', 'ekonomiya', 'rybalka')),
  status text not null default 'active' check (status in ('active', 'paused', 'unsubscribed')),
  created_at timestamptz not null default now(),
  unique (recipient_id, category_slug)
);

create index if not exists notification_topic_subscriptions_recipient_id_idx on public.notification_topic_subscriptions(recipient_id);
create index if not exists notification_topic_subscriptions_category_slug_idx on public.notification_topic_subscriptions(category_slug);
create index if not exists notification_topic_subscriptions_status_idx on public.notification_topic_subscriptions(status);

create table if not exists public.notification_channel_preferences (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.notification_recipients(id) on delete cascade,
  contact_id uuid not null references public.notification_contacts(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (recipient_id, contact_id)
);

create index if not exists notification_channel_preferences_recipient_id_idx on public.notification_channel_preferences(recipient_id);
create index if not exists notification_channel_preferences_contact_id_idx on public.notification_channel_preferences(contact_id);

create table if not exists public.notification_confirmations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.notification_contacts(id) on delete cascade,
  token_hash text not null unique,
  channel text not null check (channel in ('email', 'telegram', 'max', 'whatsapp', 'sms')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notification_confirmations_contact_id_idx on public.notification_confirmations(contact_id);
create index if not exists notification_confirmations_channel_idx on public.notification_confirmations(channel);
create index if not exists notification_confirmations_expires_at_idx on public.notification_confirmations(expires_at);

create table if not exists public.notification_consents (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.notification_recipients(id) on delete cascade,
  contact_id uuid references public.notification_contacts(id) on delete set null,
  consent_type text not null check (consent_type in ('category_notifications', 'advertising', 'privacy')),
  consent_version text not null,
  consent_text text not null,
  granted boolean not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists notification_consents_recipient_id_idx on public.notification_consents(recipient_id);
create index if not exists notification_consents_contact_id_idx on public.notification_consents(contact_id);
create index if not exists notification_consents_consent_type_idx on public.notification_consents(consent_type);

create table if not exists public.articles_publication_index (
  article_slug text primary key,
  category_slug text not null check (category_slug in ('kulinaria', 'dom-i-uborka', 'dacha-i-ogorod', 'layfkhaki', 'ekonomiya', 'rybalka')),
  title text not null,
  canonical_path text not null,
  description text not null default '',
  published_at timestamptz,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_publication_index_category_slug_idx on public.articles_publication_index(category_slug);
create index if not exists articles_publication_index_first_seen_at_idx on public.articles_publication_index(first_seen_at desc);
create index if not exists articles_publication_index_published_at_idx on public.articles_publication_index(published_at desc);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.notification_recipients(id) on delete cascade,
  contact_id uuid not null references public.notification_contacts(id) on delete cascade,
  channel text not null check (channel in ('email', 'telegram', 'max', 'whatsapp', 'sms')),
  frequency text not null check (frequency in ('daily_one', 'daily_digest_3', 'weekly_digest_3', 'weekly_digest_7')),
  delivery_period text not null,
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error_code text,
  error_message text,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (recipient_id, contact_id, delivery_period)
);

create index if not exists notification_deliveries_recipient_id_idx on public.notification_deliveries(recipient_id);
create index if not exists notification_deliveries_contact_id_idx on public.notification_deliveries(contact_id);
create index if not exists notification_deliveries_channel_idx on public.notification_deliveries(channel);
create index if not exists notification_deliveries_status_idx on public.notification_deliveries(status);
create index if not exists notification_deliveries_delivery_period_idx on public.notification_deliveries(delivery_period);

create table if not exists public.notification_delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.notification_deliveries(id) on delete cascade,
  article_slug text not null references public.articles_publication_index(article_slug) on delete restrict,
  position integer not null,
  unique (delivery_id, article_slug),
  unique (delivery_id, position)
);

create index if not exists notification_delivery_items_delivery_id_idx on public.notification_delivery_items(delivery_id);
create index if not exists notification_delivery_items_article_slug_idx on public.notification_delivery_items(article_slug);

create table if not exists public.notification_suppression_list (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'telegram', 'max', 'whatsapp', 'sms')),
  normalized_contact_value text not null,
  reason text not null,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (channel, normalized_contact_value)
);

create index if not exists notification_suppression_list_channel_idx on public.notification_suppression_list(channel);
create index if not exists notification_suppression_list_normalized_contact_value_idx on public.notification_suppression_list(normalized_contact_value);

create table if not exists public.social_follow_targets (
  platform text primary key check (platform in ('vk', 'ok', 'facebook')),
  display_name text not null,
  url text not null,
  status text not null default 'needs_account' check (status in ('active', 'needs_account', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipient_social_actions (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.notification_recipients(id) on delete set null,
  platform text not null references public.social_follow_targets(platform),
  action text not null check (action in ('cta_view', 'cta_click')),
  source_path text not null default '/',
  created_at timestamptz not null default now()
);

create index if not exists recipient_social_actions_recipient_id_idx on public.recipient_social_actions(recipient_id);
create index if not exists recipient_social_actions_platform_idx on public.recipient_social_actions(platform);
create index if not exists recipient_social_actions_action_idx on public.recipient_social_actions(action);

create table if not exists public.notification_rate_limits (
  bucket text primary key,
  hit_count integer not null default 0,
  window_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists notification_rate_limits_window_expires_at_idx on public.notification_rate_limits(window_expires_at);

create or replace function public.notification_check_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.notification_rate_limits%rowtype;
  retry_after integer;
begin
  insert into public.notification_rate_limits (bucket, hit_count, window_expires_at)
  values (p_bucket, 0, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket) do nothing;

  select *
  into current_row
  from public.notification_rate_limits
  where bucket = p_bucket
  for update;

  if current_row.window_expires_at <= now() then
    update public.notification_rate_limits
    set hit_count = 1,
        window_expires_at = now() + make_interval(secs => p_window_seconds),
        updated_at = now()
    where bucket = p_bucket;
    return jsonb_build_object('allowed', true, 'bucket', p_bucket);
  end if;

  if current_row.hit_count >= p_limit then
    retry_after = greatest(1, ceil(extract(epoch from current_row.window_expires_at - now()))::integer);
    return jsonb_build_object('allowed', false, 'bucket', p_bucket, 'retryAfterSeconds', retry_after);
  end if;

  update public.notification_rate_limits
  set hit_count = hit_count + 1,
      updated_at = now()
  where bucket = p_bucket;

  return jsonb_build_object('allowed', true, 'bucket', p_bucket);
end;
$$;

alter table public.notification_recipients enable row level security;
alter table public.notification_contacts enable row level security;
alter table public.notification_topic_subscriptions enable row level security;
alter table public.notification_channel_preferences enable row level security;
alter table public.notification_confirmations enable row level security;
alter table public.notification_consents enable row level security;
alter table public.articles_publication_index enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_delivery_items enable row level security;
alter table public.notification_suppression_list enable row level security;
alter table public.social_follow_targets enable row level security;
alter table public.recipient_social_actions enable row level security;
alter table public.notification_rate_limits enable row level security;

create policy "users can read own recipients" on public.notification_recipients
  for select using (auth.uid() = user_id);

create policy "users can update own recipients" on public.notification_recipients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can read own contacts" on public.notification_contacts
  for select using (exists (
    select 1 from public.notification_recipients r
    where r.id = notification_contacts.recipient_id and r.user_id = auth.uid()
  ));

create policy "users can read own topic subscriptions" on public.notification_topic_subscriptions
  for select using (exists (
    select 1 from public.notification_recipients r
    where r.id = notification_topic_subscriptions.recipient_id and r.user_id = auth.uid()
  ));

create policy "users can read own channel preferences" on public.notification_channel_preferences
  for select using (exists (
    select 1 from public.notification_recipients r
    where r.id = notification_channel_preferences.recipient_id and r.user_id = auth.uid()
  ));

create policy "users can read own consents" on public.notification_consents
  for select using (exists (
    select 1 from public.notification_recipients r
    where r.id = notification_consents.recipient_id and r.user_id = auth.uid()
  ));

create policy "users can read own deliveries" on public.notification_deliveries
  for select using (exists (
    select 1 from public.notification_recipients r
    where r.id = notification_deliveries.recipient_id and r.user_id = auth.uid()
  ));

create policy "users can read own delivery items" on public.notification_delivery_items
  for select using (exists (
    select 1
    from public.notification_deliveries d
    join public.notification_recipients r on r.id = d.recipient_id
    where d.id = notification_delivery_items.delivery_id and r.user_id = auth.uid()
  ));

create policy "public can read active social targets" on public.social_follow_targets
  for select using (status = 'active');

create policy "public can read article publication index" on public.articles_publication_index
  for select using (true);

insert into public.social_follow_targets (platform, display_name, url, status) values
  ('vk', 'VK', 'https://vk.com/1001sovet', 'needs_account'),
  ('ok', 'Одноклассники', 'https://ok.ru/group/1001sovet', 'needs_account'),
  ('facebook', 'Facebook', 'https://www.facebook.com/1001sovet', 'needs_account')
on conflict (platform) do nothing;
