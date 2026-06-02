# Subscription Provider Setup

This checklist is required before category subscription sends can be enabled for real users. The UI may show every channel from the first release, but a direct channel is active only when its provider row is ready in Worker diagnostics and the related consent flow is confirmed.

## Shared Runtime

- Deploy `workers/subscriptions` separately from `workers/photo-upload`.
- Set `ALLOWED_ORIGINS` to the production site origins, comma-separated.
- Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` through Worker secrets.
- Set `ADMIN_API_KEY`; `/admin/subscriptions/diagnostics`, `/admin/subscriptions/dry-run`, and `/admin/subscriptions/test-send` require `x-admin-key` or `Authorization: Bearer`.
- Set `SUBSCRIPTIONS_API_URL` to the public Worker API origin, for example `https://api.1001sovet.ru`.
- Set `PUBLIC_SITE_URL` to `https://1001sovet.ru` for confirmation, manage, and unsubscribe links.
- Set `UNSUBSCRIBE_TOKEN_SECRET`; existing unsubscribe links depend on this stable secret, so do not reuse admin or Supabase service-role keys.
- Set `PII_HASH_SECRET` so consent IP hashes are keyed HMACs rather than reversible IPv4 hashes.
- Set `TURNSTILE_SECRET_KEY`; public anonymous subscription intake fails closed when it is absent. `SUBSCRIPTIONS_ALLOW_UNVERIFIED_TURNSTILE=true` is for local development only.
- Configure the hourly scheduled trigger in `workers/subscriptions/wrangler.toml`; the scheduled handler selects confirmed contacts whose local `timezone` and `delivery_window` match the current hour.
- Optional: set `DIGEST_BATCH_SIZE` to cap one scheduled run. Default is `100`, maximum is `500`.
- Run `npm run sync:subscriptions:index` after article generation/deploy so `articles_publication_index.first_seen_at` is durable.

## Email Through Resend

Required Worker secrets and vars:

- `RESEND_API_KEY`
- `EMAIL_FROM`, for example `SovetyDoma <digest@updates.1001sovet.ru>`
- `EMAIL_REPLY_TO`, for example `support@1001sovet.ru`
- `PUBLIC_SITE_URL`, for unsubscribe and manage links

DNS and deliverability:

- Create a dedicated sending subdomain such as `updates.1001sovet.ru`.
- Configure SPF, DKIM, and DMARC for that sending domain.
- Verify the domain in Resend before enabling real sends.
- Configure Resend bounce and complaint webhooks to `/webhooks/resend`.
- Set `RESEND_WEBHOOK_SECRET` and verify `svix-*` webhook headers against the raw body before accepting suppression events.
- Confirm `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` are present in every email.

Activation gate:

- `/admin/subscriptions/diagnostics` shows email `ready: true`.
- A dry-run returns article candidates without writing a sent delivery.
- A test send to an internal address lands in inbox and the unsubscribe link works.

## Telegram Bot

Required Worker secrets and vars:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_WEBHOOK_SECRET`

Setup:

- Create the bot through Telegram BotFather.
- Set the webhook to `/webhooks/telegram`.
- Configure Telegram with `X-Telegram-Bot-Api-Secret-Token`; the Worker rejects Telegram webhook requests when the secret is absent or mismatched.
- Use deep links in the format `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`.
- Store the `chat_id` only after the user starts the bot.
- Do not send messages to Telegram users before the bot start event confirms the contact.

Activation gate:

- Diagnostics shows Telegram `ready: true`.
- Starting the bot consumes a pending confirmation token.
- Internal test send reaches the confirmed chat.

## MAX Bot

Required Worker secrets and vars:

- `MAX_BOT_TOKEN`
- `MAX_BOT_USERNAME`
- `MAX_WEBHOOK_SECRET`
- `MAX_API_BASE_URL`

Setup:

- Create the MAX bot/account under the required legal or platform owner.
- Complete provider moderation before production sends.
- Set the webhook to `/webhooks/max`.
- Set the webhook secret in MAX subscriptions and pass it to the Worker; the Worker rejects MAX webhook requests when the secret is absent or mismatched.
- Use the same pending-token confirmation pattern as Telegram.
- Keep MAX in `provider_unconfigured` until credentials, moderation, and webhook health are confirmed.

Activation gate:

- Diagnostics shows MAX `ready: true`.
- The bot start flow links a MAX chat to a pending contact.
- Internal test send reaches the confirmed MAX chat.

## WhatsApp

Required Worker secrets and vars:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_WEBHOOK_SECRET`
- `WHATSAPP_APP_SECRET`, for `x-hub-signature-256` verification
- `WHATSAPP_VERIFY_TOKEN`, for Meta webhook verification challenge
- `WHATSAPP_TEMPLATE_CONFIRMATION`
- `WHATSAPP_TEMPLATE_DIGEST_DAILY`
- `WHATSAPP_TEMPLATE_DIGEST_WEEKLY`
- `WHATSAPP_TEMPLATE_LANGUAGE`, default `ru`

Setup:

- Use WhatsApp Business Platform or a vetted BSP provider only.
- Create and approve daily and weekly digest templates before real sends.
- Confirm phone ownership through the provider-approved opt-in or OTP path.
- Set webhook handling for delivery status and opt-out events.
- Configure Meta webhook verification on `GET /webhooks/whatsapp`; POST payloads are parsed only after signature verification.
- Store provider message IDs in `notification_deliveries.provider_message_id`.

Activation gate:

- Diagnostics shows WhatsApp `ready: true`.
- A confirmed phone receives an approved template test.
- Opt-out events insert or update `notification_suppression_list`.

## SMS

Required Worker secrets and vars:

- `SMS_API_KEY`
- `SMS_FROM`
- `SMS_PROVIDER_BASE_URL`
- `SMS_WEBHOOK_SECRET`

Setup:

- Choose one SMS provider and document pricing, sender-name rules, and regional limits.
- Confirm phone ownership through OTP before SMS article notifications.
- Keep SMS copy short: one article or one digest link plus manage/unsubscribe link.
- Default SMS to weekly or explicitly user-selected daily frequency only.
- Store provider message IDs in `notification_deliveries.provider_message_id`.

Activation gate:

- Diagnostics shows SMS `ready: true`.
- OTP confirmation works on an internal phone.
- Test SMS includes a manage/unsubscribe link.

## Social Growth Pages

Required pages:

- VK page or community for `1001sovet.ru`.
- Odnoklassniki group or page for `1001sovet.ru`.
- Facebook page for `1001sovet.ru`.

Each page must have:

- Approved display name.
- Profile image.
- Cover image.
- Short description.
- Website link to `https://1001sovet.ru/`.
- First pinned or visible post explaining the site's article categories.

Activation gate:

- Update `social_follow_targets.url` for `vk`, `ok`, and `facebook` with real final URLs.
- Change target status from `needs_account` to `active`.
- Set `NEXT_PUBLIC_SOCIAL_VK_URL`, `NEXT_PUBLIC_SOCIAL_OK_URL`, and `NEXT_PUBLIC_SOCIAL_FACEBOOK_URL`; the frontend does not link to placeholder accounts.
- Confirm subscription UI opens each social page in a new tab.
- Confirm `/social/track` records `cta_click` for each platform.

## Pre-Launch Checklist

- `npm run lint`
- `npm test`
- `npm run build`
- `npx wrangler deploy --dry-run --config workers/subscriptions/wrangler.toml`
- Worker diagnostics show expected provider readiness.
- Admin requests include `x-admin-key`.
- Dry-run digest does not write `sent` deliveries.
- Internal test sends pass for every provider marked `ready`.
- Suppression and unsubscribe flows work before any public broadcast.
