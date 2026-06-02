# Omnichannel Category Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build category subscriptions where authorized and anonymous readers select one or more article categories, choose real delivery channels from day one, confirm each direct channel, and receive limited daily or weekly article digests without spam.

**Architecture:** Keep the public site as static Next.js, move subscription mutations and delivery into a separate Cloudflare Worker, and store all durable state in Supabase. Email, Telegram, MAX, WhatsApp, and SMS are first-class direct channel adapters; VK, Odnoklassniki, and Facebook are first-class social follow targets tracked separately from direct notifications.

**Tech Stack:** Next.js 16 static export, React 19, Supabase Postgres/Auth, Cloudflare Workers, Resend for email, Telegram Bot API, MAX Bot API, WhatsApp Business Platform or BSP, SMS provider adapter, Beads.

---

## Scope Guardrails

- Category selection is mandatory. A subscription cannot be created without at least one category slug from `src/lib/categories.ts`.
- Direct channels shipped in the first implementation: `email`, `telegram`, `max`, `whatsapp`, `sms`.
- Social follow targets shipped in the first implementation: `vk`, `ok`, `facebook`.
- A channel may be `provider_unconfigured` in production diagnostics when credentials are missing, but it must still have UI, persisted state, validation, status, and an operator-visible setup reason.
- No anonymous direct writes from the browser to `newsletter_subscribers`. The existing `NewsletterForm` becomes the category/channel subscription entry point and posts to the subscription Worker.
- The delivery limit is global per recipient and frequency, not per category.
- New subscribers receive only articles with `first_seen_at >= confirmed_at` for the confirmed contact/channel.
- The Worker must support dry-run delivery before real sends.

## File Structure

### Create

- `supabase/migrations/202606021300_omnichannel_subscriptions.sql` - subscription schema, RLS, constraints, social targets seed, idempotency indexes.
- `src/lib/subscriptions/constants.mjs` - shared channel, frequency, social target, category helper constants for UI and Node tests.
- `src/lib/subscriptions/validation.mjs` - pure client-safe validation and payload normalization.
- `scripts/subscription-validation.test.mjs` - pure validation tests.
- `src/components/subscriptions/CategorySubscriptionCta.tsx` - compact CTA for article/category pages.
- `src/components/subscriptions/SubscriptionPanel.tsx` - full category/channel/frequency/contact form.
- `src/components/subscriptions/SubscriptionStatus.tsx` - confirmation/status messages after submit.
- `src/components/subscriptions/SocialFollowTargets.tsx` - VK/OK/Facebook links and click tracking.
- `src/components/subscriptions/ManageSubscriptions.tsx` - cabinet subscription management UI.
- `src/app/podpiski/page.tsx` - public management/confirmation landing for tokens and unauthenticated users.
- `scripts/build-subscription-publication-index.mjs` - local index builder from MDX frontmatter.
- `scripts/sync-subscription-publication-index.mjs` - service-role upsert into Supabase `articles_publication_index`.
- `scripts/subscription-publication-index.test.mjs` - article index tests.
- `workers/subscriptions/wrangler.toml` - separate Worker config and scheduled trigger.
- `workers/subscriptions/src/index.ts` - HTTP router plus scheduled delivery entry.
- `workers/subscriptions/src/types.ts` - Worker request, database, and channel types.
- `workers/subscriptions/src/supabase.ts` - Supabase REST helpers with service role.
- `workers/subscriptions/src/rate-limit.ts` - durable throttle using Supabase rows, not in-memory Maps.
- `workers/subscriptions/src/confirmations.ts` - token creation and confirmation handling.
- `workers/subscriptions/src/delivery-planner.ts` - recipient/category/article selection and idempotent claiming.
- `workers/subscriptions/src/render-message.ts` - channel-safe digest rendering.
- `workers/subscriptions/src/providers/email.ts` - Resend sender with List-Unsubscribe headers.
- `workers/subscriptions/src/providers/telegram.ts` - Telegram sender and webhook confirmation.
- `workers/subscriptions/src/providers/max.ts` - MAX sender and webhook confirmation.
- `workers/subscriptions/src/providers/whatsapp.ts` - WhatsApp sender using approved templates.
- `workers/subscriptions/src/providers/sms.ts` - SMS sender with strict short copy.
- `workers/subscriptions/src/providers/registry.ts` - provider readiness and fanout isolation.
- `workers/subscriptions/src/admin.ts` - admin dry-run, diagnostics, test-send endpoints.
- `workers/subscriptions/src/delivery-planner.test.mjs` - pure delivery planner tests.
- `workers/subscriptions/src/render-message.test.mjs` - digest rendering tests.
- `docs/operations/subscriptions-provider-setup.md` - credentials, DNS, bot, webhook, and social page setup.

### Modify

- `package.json` - add publication index test/sync scripts.
- `src/components/NewsletterForm.tsx` - replace direct Supabase newsletter insert with subscription panel wrapper.
- `src/app/[category]/[slug]/page.tsx` - add category subscribe CTA near category badge and after article body.
- `src/app/[category]/page.tsx` - add category subscribe CTA in category header.
- `src/app/moy-kabinet/page.tsx` - add `subscriptions` tab and management component.
- `workers/photo-upload/src/index.ts` - do not add subscription delivery here; only leave existing contact/photo/view responsibilities.
- `.beads/issues.jsonl` - keep epic `sovetydoma-7md` and children updated as tasks close.

## Data Contract

Direct channels:

```js
export const DIRECT_NOTIFICATION_CHANNELS = ['email', 'telegram', 'max', 'whatsapp', 'sms']
```

Social targets:

```js
export const SOCIAL_FOLLOW_TARGETS = ['vk', 'ok', 'facebook']
```

Frequency presets:

```js
export const FREQUENCY_PRESETS = {
  daily_one: { maxMessagesPerPeriod: 1, maxArticlesPerMessage: 1, period: 'day' },
  daily_digest_3: { maxMessagesPerPeriod: 1, maxArticlesPerMessage: 3, period: 'day' },
  weekly_digest_3: { maxMessagesPerPeriod: 1, maxArticlesPerMessage: 3, period: 'week' },
  weekly_digest_7: { maxMessagesPerPeriod: 1, maxArticlesPerMessage: 7, period: 'week' },
}
```

## Task 1: Shared Subscription Constants And Validation

**Beads:** `sovetydoma-7md.1`, `sovetydoma-7md.2`, `sovetydoma-7md.6`

**Files:**
- Create: `src/lib/subscriptions/constants.mjs`
- Create: `src/lib/subscriptions/validation.mjs`
- Create: `scripts/subscription-validation.test.mjs`

- [ ] **Step 1: Write validation tests**

Create `scripts/subscription-validation.test.mjs`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeSubscriptionRequest,
  validateSubscriptionRequest,
} from '../src/lib/subscriptions/validation.mjs'

test('requires at least one valid category', () => {
  const result = validateSubscriptionRequest({ categories: [], channels: ['email'], frequency: 'daily_one', contacts: { email: 'a@b.com' }, consent: true })
  assert.equal(result.valid, false)
  assert.equal(result.errors.categories, 'Выберите хотя бы одну категорию')
})

test('keeps only known category slugs and channels', () => {
  const normalized = normalizeSubscriptionRequest({
    categories: ['kulinaria', 'bad'],
    channels: ['email', 'unknown'],
    frequency: 'daily_digest_3',
    contacts: { email: ' USER@Example.COM ' },
    consent: true,
  })
  assert.deepEqual(normalized.categories, ['kulinaria'])
  assert.deepEqual(normalized.channels, ['email'])
  assert.equal(normalized.contacts.email, 'user@example.com')
})

test('requires matching contacts for selected direct channels', () => {
  const result = validateSubscriptionRequest({
    categories: ['rybalka'],
    channels: ['email', 'telegram', 'sms'],
    frequency: 'weekly_digest_3',
    contacts: { email: 'reader@example.com' },
    consent: true,
  })
  assert.equal(result.valid, false)
  assert.equal(result.errors.telegram, 'Откройте бота для подтверждения Telegram')
  assert.equal(result.errors.sms, 'Укажите телефон для SMS')
})
```

- [ ] **Step 2: Run the focused test and confirm it fails before implementation**

Run:

```powershell
node --test scripts/subscription-validation.test.mjs
```

Expected: failure because `validation.mjs` does not exist.

- [ ] **Step 3: Add constants and validation**

Create `src/lib/subscriptions/constants.mjs` with the channel and frequency constants from the Data Contract section, plus `SUBSCRIPTION_CATEGORY_SLUGS`.

Create `src/lib/subscriptions/validation.mjs` with:

```js
import { DIRECT_NOTIFICATION_CHANNELS, FREQUENCY_PRESETS } from './constants.mjs'

const categorySet = new Set(['kulinaria', 'dom-i-uborka', 'dacha-i-ogorod', 'layfkhaki', 'ekonomiya', 'rybalka'])
const channelSet = new Set(DIRECT_NOTIFICATION_CHANNELS)
const frequencySet = new Set(Object.keys(FREQUENCY_PRESETS))

export function normalizeSubscriptionRequest(input) {
  const categories = Array.isArray(input?.categories)
    ? [...new Set(input.categories.map(String).filter((slug) => categorySet.has(slug)))]
    : []
  const channels = Array.isArray(input?.channels)
    ? [...new Set(input.channels.map(String).filter((channel) => channelSet.has(channel)))]
    : []
  const rawPhone = String(input?.contacts?.phone || '').replace(/[^\d+]/g, '')
  return {
    categories,
    channels,
    frequency: frequencySet.has(String(input?.frequency)) ? String(input.frequency) : 'weekly_digest_3',
    contacts: {
      email: String(input?.contacts?.email || '').trim().toLowerCase(),
      phone: rawPhone,
      telegramStartToken: String(input?.contacts?.telegramStartToken || '').trim(),
      maxStartToken: String(input?.contacts?.maxStartToken || '').trim(),
      whatsappOptInToken: String(input?.contacts?.whatsappOptInToken || '').trim(),
    },
    consent: input?.consent === true,
    advertisingConsent: input?.advertisingConsent === true,
  }
}

export function validateSubscriptionRequest(input) {
  const request = normalizeSubscriptionRequest(input)
  const errors = {}
  if (request.categories.length === 0) errors.categories = 'Выберите хотя бы одну категорию'
  if (request.channels.length === 0) errors.channels = 'Выберите хотя бы один канал'
  if (!request.consent) errors.consent = 'Подтвердите согласие на уведомления'
  if (request.channels.includes('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.contacts.email)) errors.email = 'Укажите корректный email'
  if (request.channels.includes('telegram') && !request.contacts.telegramStartToken) errors.telegram = 'Откройте бота для подтверждения Telegram'
  if (request.channels.includes('max') && !request.contacts.maxStartToken) errors.max = 'Откройте бота для подтверждения MAX'
  if (request.channels.includes('whatsapp') && !request.contacts.whatsappOptInToken && request.contacts.phone.length < 10) errors.whatsapp = 'Подтвердите телефон для WhatsApp'
  if (request.channels.includes('sms') && request.contacts.phone.length < 10) errors.sms = 'Укажите телефон для SMS'
  return { valid: Object.keys(errors).length === 0, errors, request }
}
```

- [ ] **Step 5: Run verification**

Run:

```powershell
npm run lint
node --test scripts/subscription-validation.test.mjs
```

Expected: lint passes; validation tests pass.

## Task 2: Supabase Subscription Schema

**Beads:** `sovetydoma-7md.1`, `sovetydoma-7md.4`, `sovetydoma-7md.5`, `sovetydoma-7md.6`

**Files:**
- Create: `supabase/migrations/202606021300_omnichannel_subscriptions.sql`

- [ ] **Step 1: Create migration with durable tables**

Create the migration with these tables and indexes:

```sql
create table if not exists notification_recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_key text,
  status text not null default 'active' check (status in ('active','paused','suppressed')),
  frequency text not null default 'weekly_digest_3' check (frequency in ('daily_one','daily_digest_3','weekly_digest_3','weekly_digest_7')),
  timezone text not null default 'Europe/Moscow',
  delivery_window text not null default 'evening' check (delivery_window in ('morning','day','evening')),
  source_path text not null default '/',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_recipient_identity check (user_id is not null or anonymous_key is not null)
);

create table if not exists notification_contacts (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references notification_recipients(id) on delete cascade,
  channel text not null check (channel in ('email','telegram','max','whatsapp','sms')),
  contact_value text not null,
  normalized_contact_value text not null,
  status text not null default 'pending' check (status in ('pending','confirmed','paused','failed','unsubscribed','provider_unconfigured')),
  confirmed_at timestamptz,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, normalized_contact_value)
);

create table if not exists notification_topic_subscriptions (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references notification_recipients(id) on delete cascade,
  category_slug text not null check (category_slug in ('kulinaria','dom-i-uborka','dacha-i-ogorod','layfkhaki','ekonomiya','rybalka')),
  status text not null default 'active' check (status in ('active','paused','unsubscribed')),
  created_at timestamptz not null default now(),
  unique (recipient_id, category_slug)
);

create table if not exists notification_channel_preferences (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references notification_recipients(id) on delete cascade,
  contact_id uuid not null references notification_contacts(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (recipient_id, contact_id)
);

create table if not exists notification_confirmations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references notification_contacts(id) on delete cascade,
  token_hash text not null unique,
  channel text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists notification_consents (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references notification_recipients(id) on delete cascade,
  contact_id uuid references notification_contacts(id) on delete set null,
  consent_type text not null check (consent_type in ('category_notifications','advertising','privacy')),
  consent_version text not null,
  consent_text text not null,
  granted boolean not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists articles_publication_index (
  article_slug text primary key,
  category_slug text not null check (category_slug in ('kulinaria','dom-i-uborka','dacha-i-ogorod','layfkhaki','ekonomiya','rybalka')),
  title text not null,
  canonical_path text not null,
  description text not null default '',
  published_at timestamptz,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references notification_recipients(id) on delete cascade,
  contact_id uuid not null references notification_contacts(id) on delete cascade,
  channel text not null,
  frequency text not null,
  delivery_period text not null,
  status text not null default 'claimed' check (status in ('claimed','sent','failed','skipped')),
  provider_message_id text,
  error_code text,
  error_message text,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (recipient_id, contact_id, delivery_period)
);

create table if not exists notification_delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references notification_deliveries(id) on delete cascade,
  article_slug text not null references articles_publication_index(article_slug) on delete restrict,
  position integer not null,
  unique (delivery_id, article_slug)
);

create table if not exists notification_suppression_list (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  normalized_contact_value text not null,
  reason text not null,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (channel, normalized_contact_value)
);

create table if not exists social_follow_targets (
  platform text primary key check (platform in ('vk','ok','facebook')),
  display_name text not null,
  url text not null,
  status text not null default 'needs_account' check (status in ('active','needs_account','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recipient_social_actions (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references notification_recipients(id) on delete set null,
  platform text not null references social_follow_targets(platform),
  action text not null check (action in ('cta_view','cta_click')),
  source_path text not null default '/',
  created_at timestamptz not null default now()
);

insert into social_follow_targets(platform, display_name, url, status) values
  ('vk', 'VK', 'https://vk.com/1001sovet', 'needs_account'),
  ('ok', 'Одноклассники', 'https://ok.ru/group/1001sovet', 'needs_account'),
  ('facebook', 'Facebook', 'https://www.facebook.com/1001sovet', 'needs_account')
on conflict (platform) do nothing;
```

- [ ] **Step 2: Add RLS**

Add RLS so anonymous clients cannot read other subscribers and service-role Worker owns writes:

```sql
alter table notification_recipients enable row level security;
alter table notification_contacts enable row level security;
alter table notification_topic_subscriptions enable row level security;
alter table notification_channel_preferences enable row level security;
alter table notification_confirmations enable row level security;
alter table notification_consents enable row level security;
alter table articles_publication_index enable row level security;
alter table notification_deliveries enable row level security;
alter table notification_delivery_items enable row level security;
alter table notification_suppression_list enable row level security;
alter table social_follow_targets enable row level security;
alter table recipient_social_actions enable row level security;

create policy "users can read own recipients" on notification_recipients
  for select using (auth.uid() = user_id);

create policy "users can update own recipients" on notification_recipients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "public can read active social targets" on social_follow_targets
  for select using (status = 'active');

create policy "public can read article publication index" on articles_publication_index
  for select using (true);
```

- [ ] **Step 3: Verify migration syntax locally**

Run:

```powershell
rg -n "create table if not exists notification_|articles_publication_index|social_follow_targets" supabase/migrations/202606021300_omnichannel_subscriptions.sql
```

Expected: all table names appear.

## Task 3: Publication Index Sync

**Beads:** `sovetydoma-7md.1`, `sovetydoma-7md.3`, `sovetydoma-7md.6`

**Files:**
- Create: `scripts/build-subscription-publication-index.mjs`
- Create: `scripts/sync-subscription-publication-index.mjs`
- Create: `scripts/subscription-publication-index.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Test index builder**

Create `scripts/subscription-publication-index.test.mjs`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeArticleRecord } from './build-subscription-publication-index.mjs'

test('normalizes MDX frontmatter into a publication row', () => {
  const row = normalizeArticleRecord('src/content/articles/salat.mdx', {
    title: 'Салат',
    description: 'Быстрый салат',
    category: 'kulinaria',
    date: '2026-06-01',
  })
  assert.deepEqual(row, {
    article_slug: 'salat',
    category_slug: 'kulinaria',
    title: 'Салат',
    canonical_path: '/kulinaria/salat/',
    description: 'Быстрый салат',
    published_at: '2026-06-01T00:00:00.000Z',
  })
})
```

- [ ] **Step 2: Implement builder**

Implement `normalizeArticleRecord(filePath, frontmatter)` and a CLI that reads `src/content/articles/*.mdx`, extracts frontmatter using the same package already used by the repo scripts, and writes JSON to stdout.

- [ ] **Step 3: Implement Supabase sync**

Create `scripts/sync-subscription-publication-index.mjs`:

```js
import { createClient } from '@supabase/supabase-js'
import { buildPublicationIndex } from './build-subscription-publication-index.mjs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const rows = await buildPublicationIndex()
const { error } = await supabase.from('articles_publication_index').upsert(rows, { onConflict: 'article_slug' })
if (error) {
  console.error(error)
  process.exit(1)
}
console.log(`Synced ${rows.length} subscription publication rows`)
```

- [ ] **Step 4: Add package scripts**

Add:

```json
"test:subscriptions:index": "node --test scripts/subscription-publication-index.test.mjs",
"sync:subscriptions:index": "node scripts/sync-subscription-publication-index.mjs"
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm run test:subscriptions:index
node scripts/build-subscription-publication-index.mjs | Select-Object -First 5
```

Expected: test passes; CLI emits article records with `article_slug`, `category_slug`, and `canonical_path`.

## Task 4: Subscription Worker API

**Beads:** `sovetydoma-7md.1`, `sovetydoma-7md.3`, `sovetydoma-7md.5`, `sovetydoma-7md.6`

**Files:**
- Create all files under `workers/subscriptions/`

- [ ] **Step 1: Create Worker contract**

Routes:

```txt
POST /subscriptions/start
GET  /subscriptions/confirm?token=...
POST /subscriptions/manage
POST /subscriptions/unsubscribe
POST /social/track
POST /webhooks/telegram
POST /webhooks/max
POST /webhooks/resend
POST /webhooks/whatsapp
POST /admin/subscriptions/dry-run
POST /admin/subscriptions/test-send
GET  /admin/subscriptions/diagnostics
```

- [ ] **Step 2: Add durable throttle**

Create a throttle table in the migration if Task 2 did not include it:

```sql
create table if not exists notification_rate_limits (
  bucket text primary key,
  hit_count integer not null default 0,
  window_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
```

Use buckets:

```ts
subscription:start:ip:${ip}
subscription:start:email:${sha256(email)}
subscription:social:ip:${ip}
```

- [ ] **Step 3: Implement `/subscriptions/start`**

Behavior:

- Validate origin against `ALLOWED_ORIGINS`.
- Validate Turnstile token when `TURNSTILE_SECRET_KEY` is configured.
- Normalize request with the same constants as Task 1.
- Upsert `notification_recipients`.
- Upsert selected categories into `notification_topic_subscriptions`.
- Create one `notification_contacts` row per selected direct channel.
- Create channel confirmation rows.
- Return per-channel next actions:

```json
{
  "recipientId": "uuid",
  "channels": {
    "email": { "status": "pending", "action": "check_email" },
    "telegram": { "status": "pending", "action": "open_bot", "url": "https://t.me/..." },
    "max": { "status": "provider_unconfigured", "action": "provider_setup_required" },
    "whatsapp": { "status": "pending", "action": "confirm_opt_in" },
    "sms": { "status": "pending", "action": "enter_otp" }
  }
}
```

- [ ] **Step 4: Implement provider registry**

Provider readiness:

```ts
export function getProviderReadiness(env: Env) {
  return {
    email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
    telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_USERNAME),
    max: Boolean(env.MAX_BOT_TOKEN && env.MAX_BOT_USERNAME),
    whatsapp: Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
    sms: Boolean(env.SMS_API_KEY && env.SMS_FROM),
  }
}
```

If a provider is not ready, store `provider_unconfigured` and surface the exact missing environment names in admin diagnostics.

- [ ] **Step 5: Implement admin diagnostics**

`GET /admin/subscriptions/diagnostics` returns:

```json
{
  "providers": {
    "email": { "ready": true, "missing": [] },
    "telegram": { "ready": false, "missing": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_USERNAME"] },
    "max": { "ready": false, "missing": ["MAX_BOT_TOKEN", "MAX_BOT_USERNAME"] },
    "whatsapp": { "ready": false, "missing": ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"] },
    "sms": { "ready": false, "missing": ["SMS_API_KEY", "SMS_FROM"] }
  }
}
```

- [ ] **Step 6: Verify Worker compiles**

Run:

```powershell
npx wrangler deploy --dry-run --config workers/subscriptions/wrangler.toml
```

Expected: dry-run build succeeds without deployment.

## Task 5: Delivery Planner And Idempotent Digests

**Beads:** `sovetydoma-7md.3`, `sovetydoma-7md.6`

**Files:**
- Create: `workers/subscriptions/src/delivery-planner.ts`
- Create: `workers/subscriptions/src/delivery-planner.test.mjs`
- Create: `workers/subscriptions/src/render-message.ts`
- Create: `workers/subscriptions/src/render-message.test.mjs`

- [ ] **Step 1: Write planner tests**

Test cases:

- daily_one returns one article maximum across all subscribed categories.
- daily_digest_3 returns three articles maximum across all subscribed categories.
- articles older than `confirmed_at` are excluded.
- an article already present in `notification_delivery_items` for the same contact is excluded.
- duplicate cron attempts cannot create a second `notification_deliveries` row for the same recipient/contact/period.

- [ ] **Step 2: Implement planner query**

Planner selection rules:

```sql
select api.article_slug, api.category_slug, api.title, api.canonical_path, api.description
from articles_publication_index api
join notification_topic_subscriptions nts
  on nts.category_slug = api.category_slug
where nts.recipient_id = :recipient_id
  and nts.status = 'active'
  and api.first_seen_at >= :confirmed_at
  and not exists (
    select 1
    from notification_delivery_items ndi
    join notification_deliveries nd on nd.id = ndi.delivery_id
    where nd.contact_id = :contact_id
      and ndi.article_slug = api.article_slug
      and nd.status in ('claimed','sent')
  )
order by api.first_seen_at asc
limit :max_articles
```

- [ ] **Step 3: Implement scheduled event**

`workers/subscriptions/src/index.ts` exports:

```ts
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    return route(req, env, ctx)
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDigestDelivery(env, { dryRun: false, now: new Date(event.scheduledTime) }))
  },
}
```

- [ ] **Step 4: Implement channel fanout isolation**

Each confirmed contact is delivered independently. A Telegram failure must not block email, MAX, WhatsApp, or SMS for the same recipient.

- [ ] **Step 5: Verify**

Run:

```powershell
node --test workers/subscriptions/src/delivery-planner.test.mjs
node --test workers/subscriptions/src/render-message.test.mjs
npx wrangler deploy --dry-run --config workers/subscriptions/wrangler.toml
```

Expected: planner/render tests pass and Worker dry-run compiles.

## Task 6: Direct Channel Provider Adapters

**Beads:** `sovetydoma-7md.3`, `sovetydoma-7md.5`, `sovetydoma-7md.6`

**Files:**
- Create provider files under `workers/subscriptions/src/providers/`
- Create: `docs/operations/subscriptions-provider-setup.md`

- [ ] **Step 1: Email adapter**

Implement Resend send with:

- `From: СоветыДома <digest@updates.1001sovet.ru>`
- `List-Unsubscribe` header pointing to `/subscriptions/unsubscribe`
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- bounce/complaint webhook inserts into `notification_suppression_list`

- [ ] **Step 2: Telegram adapter**

Implement:

- deep link `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`
- webhook confirmation on `/webhooks/telegram`
- digest send through `sendMessage`

- [ ] **Step 3: MAX adapter**

Implement:

- deep link based on `MAX_BOT_USERNAME`
- webhook confirmation on `/webhooks/max`
- digest send through the configured MAX Bot API endpoint
- `provider_unconfigured` diagnostics when legal/account/API prerequisites are not complete

- [ ] **Step 4: WhatsApp adapter**

Implement:

- phone normalization to E.164 where possible
- opt-in/OTP state in `notification_confirmations`
- template-based send payload using `WHATSAPP_TEMPLATE_DIGEST_DAILY` and `WHATSAPP_TEMPLATE_DIGEST_WEEKLY`

- [ ] **Step 5: SMS adapter**

Implement:

- phone confirmation with OTP
- max one SMS notification per week unless user explicitly selected a daily SMS frequency
- short text with one link and unsubscribe/manage link

- [ ] **Step 6: Provider setup doc**

Write exact setup checklist in `docs/operations/subscriptions-provider-setup.md`:

- Resend domain, SPF, DKIM, DMARC, bounce webhook.
- Telegram bot creation, webhook URL, token secret.
- MAX bot/account prerequisites, moderation, webhook URL.
- WhatsApp Business/BSP setup, templates, webhook.
- SMS provider credentials and sender name.
- VK, OK, Facebook page creation and final URL replacement in `social_follow_targets`.

## Task 7: Site Subscription UI

**Beads:** `sovetydoma-7md.2`, `sovetydoma-7md.4`, `sovetydoma-7md.6`

**Files:**
- Create subscription components under `src/components/subscriptions/`
- Modify: `src/components/NewsletterForm.tsx`
- Modify: `src/app/[category]/[slug]/page.tsx`
- Modify: `src/app/[category]/page.tsx`
- Create: `src/app/podpiski/page.tsx`

- [ ] **Step 1: Build `SubscriptionPanel`**

UI elements:

- category chips with current category preselected.
- direct channel checkboxes for email, Telegram, MAX, WhatsApp, SMS.
- social follow buttons for VK, OK, Facebook.
- frequency segmented control: daily one, daily three, weekly three, weekly digest.
- contact fields visible only for selected channels.
- consent checkbox.
- submit to `NEXT_PUBLIC_SUBSCRIPTIONS_API_URL + '/subscriptions/start'`.

- [ ] **Step 2: Build CTA**

`CategorySubscriptionCta` props:

```ts
type Props = {
  categorySlug: string
  categoryName: string
  placement: 'article-header' | 'article-footer' | 'category-header' | 'footer'
}
```

Button text:

```txt
Подписаться на эту категорию
```

- [ ] **Step 3: Replace footer/newsletter**

`NewsletterForm` renders `SubscriptionPanel` in compact mode with no direct Supabase insert.

- [ ] **Step 4: Add page placements**

Add `CategorySubscriptionCta`:

- article header, next to category metadata.
- article footer after content and before more articles/recommendations.
- category page header.

- [ ] **Step 5: Public management page**

`/podpiski/` handles:

- `?confirmed=1` success copy after email/bot confirmation.
- `?unsubscribe_token=...` one-click unsubscribe POST.
- manual link to manage all preferences.

- [ ] **Step 6: Verify UI build**

Run:

```powershell
npm run lint
npm run build
```

Expected: both pass.

## Task 8: Cabinet Management UI

**Beads:** `sovetydoma-7md.2`, `sovetydoma-7md.5`, `sovetydoma-7md.6`

**Files:**
- Create: `src/components/subscriptions/ManageSubscriptions.tsx`
- Modify: `src/app/moy-kabinet/page.tsx`

- [ ] **Step 1: Add tab**

Change tab state:

```ts
const [tab, setTab] = useState<'saved' | 'articles' | 'subscriptions'>('saved')
```

Render third tab:

```tsx
{t === 'subscriptions' ? 'Подписки' : ...}
```

- [ ] **Step 2: Management component**

`ManageSubscriptions` displays:

- selected categories.
- direct channels and confirmation status.
- frequency.
- pause/unpause.
- unsubscribe from one category.
- unsubscribe all.

- [ ] **Step 3: Server mutation path**

All mutations POST to Worker `/subscriptions/manage`; no direct client update for anonymous contacts or delivery preferences.

- [ ] **Step 4: Verify**

Run:

```powershell
npm run lint
npm run build
```

Expected: both pass.

## Task 9: Social Growth Targets

**Beads:** `sovetydoma-7md.4`, `sovetydoma-7md.7`

**Files:**
- Create/modify: `src/components/subscriptions/SocialFollowTargets.tsx`
- Modify seed rows in `supabase/migrations/202606021300_omnichannel_subscriptions.sql`
- Modify: `docs/operations/subscriptions-provider-setup.md`

- [ ] **Step 1: Create or obtain real social pages**

Required pages:

- VK page for `1001sovet.ru`.
- Odnoklassniki group/page for `1001sovet.ru`.
- Facebook page for `1001sovet.ru`.

Each page must have:

- display name `1001 совет` or approved brand spelling.
- profile image.
- cover image.
- description.
- website link to `https://1001sovet.ru/`.

- [ ] **Step 2: Update social target URLs**

After pages exist, update `social_follow_targets.url` seed and production rows with the real URLs.

- [ ] **Step 3: Track CTA clicks**

`SocialFollowTargets` POSTs:

```json
{ "platform": "vk", "action": "cta_click", "sourcePath": "/kulinaria/example/" }
```

to `/social/track` before opening the social URL in a new tab.

- [ ] **Step 4: Verify**

Run:

```powershell
npm run build
```

Expected: build passes and social links are present in generated pages.

## Task 10: Admin Visibility And Release Gates

**Beads:** `sovetydoma-7md.5`, `sovetydoma-7md.6`

**Files:**
- Create: `workers/subscriptions/src/admin.ts`
- Modify: `src/app/admin/page.tsx` or add a focused admin component if the existing admin dashboard supports sections.

- [ ] **Step 1: Admin diagnostics endpoint**

Expose:

- provider readiness.
- pending confirmations by channel.
- failed deliveries by channel.
- suppressed contacts count.
- last cron run.
- dry-run digest count.

- [ ] **Step 2: Admin UI section**

Add section title:

```txt
Подписки и каналы
```

Display provider cards for Email, Telegram, MAX, WhatsApp, SMS and social cards for VK, OK, Facebook.

- [ ] **Step 3: Dry-run test**

Admin can run dry-run for one recipient/contact without sending provider messages. Dry-run writes no `sent` delivery and returns selected article candidates.

- [ ] **Step 4: Verify**

Run:

```powershell
npm run lint
npm run build
npx wrangler deploy --dry-run --config workers/subscriptions/wrangler.toml
```

Expected: all pass.

## Task 11: End-To-End Verification

**Beads:** `sovetydoma-7md.6`

- [ ] **Step 1: Local static build**

Run:

```powershell
npm run build
```

Expected: Next static build completes.

- [ ] **Step 2: Worker dry-run**

Run:

```powershell
npx wrangler deploy --dry-run --config workers/subscriptions/wrangler.toml
```

Expected: Worker compiles.

- [ ] **Step 3: Browser QA**

Start the local site with the repo's usual static preview command. Open:

```txt
/
/kulinaria/
/kulinaria/<existing-article-slug>/
/podpiski/
/moy-kabinet/
```

Verify:

- current category is preselected.
- multiple categories can be selected.
- all direct channels are visible.
- VK, OK, Facebook are visible.
- frequency choices are visible.
- submit without a category is rejected.
- submit without selected channel is rejected.
- selected email requires valid email.
- Telegram/MAX buttons create bot next-action state.
- WhatsApp/SMS require phone confirmation state.

- [ ] **Step 4: Production rollout gates**

Before enabling real sends:

```powershell
npm run lint
npm test
npm run build
npx wrangler deploy --dry-run --config workers/subscriptions/wrangler.toml
```

Expected: all pass.

## Beads Closure Order

1. Close `sovetydoma-7md.1` after Tasks 1-3 and schema review pass.
2. Close `sovetydoma-7md.3` after Tasks 4-6 and Worker dry-run pass.
3. Close `sovetydoma-7md.2` after Tasks 7-8 and browser QA pass.
4. Close `sovetydoma-7md.4` after Task 9 social targets are visible and tracked.
5. Close `sovetydoma-7md.7` only after real VK, OK, and Facebook pages exist with final URLs.
6. Close `sovetydoma-7md.5` after Task 10 admin diagnostics are usable.
7. Close `sovetydoma-7md.6` after Task 11 verification passes.
8. Close `sovetydoma-7md` only after all children are closed.

## Self-Review

- Category-only requirement is covered by Tasks 1, 2, 7, and 11.
- All direct channels are covered by Tasks 2, 4, 5, 6, 7, 10, and 11.
- Social growth targets are covered by Tasks 2, 7, 9, 10, and 11.
- Frequency and anti-spam limits are covered by Tasks 1, 2, 5, and 11.
- Anonymous and authorized flows are covered by Tasks 2, 4, 7, and 8.
- Static Next export limitation is handled by the separate Worker in Tasks 4-6.
- No email-only schema remains; every table and UI path models channels from the first release.
