import type { DirectChannel, Env } from './types'
import type { ArticleRow } from './social/types'
import { getDeliveryPeriod, planDigestArticles } from './delivery-planner.mjs'
import { renderDigestMessage } from './render-message.mjs'
import { sendDigestToChannel } from './providers/registry'
import { createSignedContactToken } from './confirmations'
import { getSupabaseBaseUrl, hasSupabaseServiceRole, insertRows, selectRows, updateRows } from './supabase'
import { fetchWithTimeout } from './http'

type RecipientRef = {
  id: string
  frequency: string
  status: string
  timezone: string
  delivery_window: string
  last_delivery_at: string | null
}

type ContactForDelivery = {
  id: string
  recipient_id: string
  channel: DirectChannel
  contact_value: string
  normalized_contact_value: string
  confirmed_at: string | null
  unsubscribe_token_hash: string
  recipient: RecipientRef
}

type DeliveryRow = {
  id: string
  status?: string
  claimed_at?: string
}

type SendOneDigestInput = {
  recipientId: string
  contactId: string
  now?: Date
  force?: boolean
}

export async function processDueDigests(env: Env, now = new Date()): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  if (!hasSupabaseServiceRole(env)) return { processed: 0, sent: 0, failed: 0, skipped: 0 }

  const batchSize = Math.max(1, Math.min(Number(env.DIGEST_BATCH_SIZE || 100), 500))
  const contacts = await selectRows<ContactForDelivery>(
    env,
    'notification_contacts',
    [
      'status=eq.confirmed',
      'select=id,recipient_id,channel,contact_value,normalized_contact_value,confirmed_at,unsubscribe_token_hash,recipient:notification_recipients!inner(id,frequency,status,timezone,delivery_window,last_delivery_at)',
      'recipient.status=eq.active',
      'order=recipient.last_delivery_at.asc.nullsfirst,confirmed_at.asc',
      `limit=${batchSize}`,
    ].join('&'),
  )

  let sent = 0
  let failed = 0
  let skipped = 0
  for (const contact of contacts) {
    if (!isRecipientDueNow(contact.recipient, now)) {
      skipped += 1
      continue
    }
    try {
      const result = await sendOneDigest(env, {
        recipientId: contact.recipient_id,
        contactId: contact.id,
        now,
      })
      if (result.status === 'sent') sent += 1
      else if (result.status === 'failed') failed += 1
      else skipped += 1
    } catch {
      failed += 1
    }
  }

  return { processed: contacts.length, sent, failed, skipped }
}

export async function sendOneDigest(env: Env, input: SendOneDigestInput): Promise<{ status: 'sent' | 'failed' | 'skipped'; reason?: string; providerMessageId?: string }> {
  if (!hasSupabaseServiceRole(env)) return { status: 'failed', reason: 'supabase_service_role_not_configured' }

  const now = input.now || new Date()
  const [contacts, topics, articles] = await Promise.all([
    selectRows<ContactForDelivery>(
      env,
      'notification_contacts',
      [
        `id=eq.${encodeURIComponent(input.contactId)}`,
        `recipient_id=eq.${encodeURIComponent(input.recipientId)}`,
        'status=eq.confirmed',
        'select=id,recipient_id,channel,contact_value,normalized_contact_value,confirmed_at,unsubscribe_token_hash,recipient:notification_recipients!inner(id,frequency,status,timezone,delivery_window,last_delivery_at)',
        'recipient.status=eq.active',
        'limit=1',
      ].join('&'),
    ),
    selectRows<{ category_slug: string }>(
      env,
      'notification_topic_subscriptions',
      `recipient_id=eq.${encodeURIComponent(input.recipientId)}&status=eq.active&select=category_slug`,
    ),
    selectRows<ArticleRow>(
      env,
      'articles_publication_index',
      'select=article_slug,category_slug,title,canonical_path,description,published_at,first_seen_at&order=first_seen_at.asc',
    ),
  ])

  const contact = contacts[0]
  if (!contact) return { status: 'skipped', reason: 'contact_not_confirmed_or_inactive' }
  const [preferences, suppression] = await Promise.all([
    selectRows<{ id: string }>(
      env,
      'notification_channel_preferences',
      `contact_id=eq.${encodeURIComponent(input.contactId)}&enabled=eq.true&select=id&limit=1`,
    ),
    selectRows<{ id: string }>(
      env,
      'notification_suppression_list',
      `channel=eq.${encodeURIComponent(contact.channel)}&normalized_contact_value=eq.${encodeURIComponent(contact.normalized_contact_value)}&select=id&limit=1`,
    ),
  ])
  if (preferences.length === 0) return { status: 'skipped', reason: 'channel_preference_disabled' }
  if (suppression.length > 0) return { status: 'skipped', reason: 'contact_suppressed' }

  const frequency = contact.recipient.frequency
  const deliveryPeriod = getDeliveryPeriod(frequency, now)

  let deliveryId: string | undefined
  if (!input.force) {
    const existing = await selectRows<DeliveryRow>(
      env,
      'notification_deliveries',
      [
        `recipient_id=eq.${encodeURIComponent(input.recipientId)}`,
        `contact_id=eq.${encodeURIComponent(input.contactId)}`,
        `delivery_period=eq.${encodeURIComponent(deliveryPeriod)}`,
        'select=id,status,claimed_at',
        'limit=1',
      ].join('&'),
    )
    const existingDelivery = existing[0]
    if (existingDelivery?.status === 'sent') return { status: 'skipped', reason: 'delivery_period_already_sent' }
    if (existingDelivery?.status === 'claimed' && !isStaleClaim(existingDelivery.claimed_at)) {
      return { status: 'skipped', reason: 'delivery_period_already_claimed' }
    }
    if (existingDelivery) {
      deliveryId = existingDelivery.id
      await updateRows(env, 'notification_deliveries', `id=eq.${encodeURIComponent(deliveryId)}`, {
        status: 'claimed',
        claimed_at: now.toISOString(),
        error_code: null,
        error_message: null,
      }, 'id')
      await fetchWithTimeout(`${getSupabaseBaseUrl(env)}/rest/v1/notification_delivery_items?delivery_id=eq.${encodeURIComponent(deliveryId)}`, {
        method: 'DELETE',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY || '',
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
        },
      }).catch(() => undefined)
    }
  }

  const deliveredSlugs = await getDeliveredArticleSlugs(env, input.contactId)
  const plannedArticles = planDigestArticles({
    frequency,
    subscribedCategories: topics.map((topic) => topic.category_slug),
    articles,
    deliveredSlugs,
    confirmedAt: contact.confirmed_at || undefined,
    now,
  }) as ArticleRow[]

  if (plannedArticles.length === 0) return { status: 'skipped', reason: 'no_new_articles' }

  if (!deliveryId) {
    try {
      const deliveries = await insertRows<DeliveryRow>(env, 'notification_deliveries', {
        recipient_id: input.recipientId,
        contact_id: input.contactId,
        channel: contact.channel,
        frequency,
        delivery_period: input.force ? `${deliveryPeriod}:test:${crypto.randomUUID()}` : deliveryPeriod,
        status: 'claimed',
        claimed_at: now.toISOString(),
      }, 'id')
      deliveryId = deliveries[0]?.id
    } catch (error) {
      if (String(error).includes('23505') || String(error).includes('duplicate')) {
        return { status: 'skipped', reason: 'delivery_period_claim_race' }
      }
      throw error
    }
  }
  if (!deliveryId) return { status: 'failed', reason: 'delivery_not_created' }

  const unsubscribeToken = await createSignedContactToken(env, contact.id)
  const publicSiteUrl = String(env.PUBLIC_SITE_URL || 'https://1001sovet.ru').replace(/\/+$/, '')
  const publicApiUrl = String(env.SUBSCRIPTIONS_API_URL || publicSiteUrl).replace(/\/+$/, '')
  const manageUrl = `${publicSiteUrl}/podpiski/?unsubscribe_token=${encodeURIComponent(unsubscribeToken)}`
  const oneClickUnsubscribeUrl = `${publicApiUrl}/subscriptions/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
  const rendered = renderDigestMessage({
    channel: contact.channel,
    articles: plannedArticles,
    siteUrl: env.PUBLIC_SITE_URL || 'https://1001sovet.ru',
    manageUrl,
  })

  const providerResult = await sendByContact(env, contact, rendered, frequency, manageUrl, oneClickUnsubscribeUrl)
  if (!providerResult.ok) {
    await updateRows(env, 'notification_deliveries', `id=eq.${encodeURIComponent(deliveryId)}`, {
      status: 'failed',
      error_code: providerResult.error,
      error_message: providerResult.details || providerResult.error,
    }, 'id')
    return { status: 'failed', reason: providerResult.details || providerResult.error }
  }

  await insertRows(env, 'notification_delivery_items', plannedArticles.map((article, index) => ({
    delivery_id: deliveryId,
    article_slug: article.article_slug,
    position: index + 1,
  })), 'id')

  await updateRows(env, 'notification_deliveries', `id=eq.${encodeURIComponent(deliveryId)}`, {
    status: 'sent',
    provider_message_id: providerResult.id || null,
    sent_at: now.toISOString(),
  }, 'id')
  await updateRows(env, 'notification_recipients', `id=eq.${encodeURIComponent(input.recipientId)}`, {
    last_delivery_at: now.toISOString(),
  }, 'id')

  return { status: 'sent', providerMessageId: providerResult.id }
}

async function getDeliveredArticleSlugs(env: Env, contactId: string): Promise<string[]> {
  const deliveries = await selectRows<{ id: string }>(
    env,
    'notification_deliveries',
    `contact_id=eq.${encodeURIComponent(contactId)}&status=eq.sent&delivery_period=not.like.*%3Atest%3A*&select=id&limit=1000`,
  )
  if (deliveries.length === 0) return []
  const ids = deliveries.map((delivery) => delivery.id)
  const items = await selectRows<{ article_slug: string }>(
    env,
    'notification_delivery_items',
    `delivery_id=in.(${ids.map(encodeURIComponent).join(',')})&select=article_slug&limit=5000`,
  )
  return items.map((item) => item.article_slug)
}

function isStaleClaim(value: string | undefined): boolean {
  if (!value) return true
  return Date.now() - new Date(value).getTime() > 1000 * 60 * 30
}

function isRecipientDueNow(recipient: RecipientRef, now: Date): boolean {
  const localHour = getLocalHour(now, recipient.timezone || 'Europe/Moscow')
  const targetHour = recipient.delivery_window === 'morning' ? 8 : recipient.delivery_window === 'day' ? 13 : 19
  return localHour === targetHour
}

function getLocalHour(date: Date, timezone: string): number {
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date).find((part) => part.type === 'hour')?.value
    return Number(hour)
  } catch {
    return date.getUTCHours()
  }
}

async function sendByContact(
  env: Env,
  contact: ContactForDelivery,
  rendered: { subject: string; text: string; html?: string },
  frequency: string,
  manageUrl: string,
  oneClickUnsubscribeUrl: string,
) {
  if (contact.channel === 'email') {
    return sendDigestToChannel(env, {
      channel: 'email',
      to: contact.contact_value,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      replyTo: env.EMAIL_REPLY_TO,
      listUnsubscribe: env.EMAIL_REPLY_TO ? [oneClickUnsubscribeUrl, `mailto:${env.EMAIL_REPLY_TO}`] : oneClickUnsubscribeUrl,
    })
  }
  if (contact.channel === 'telegram') {
    return sendDigestToChannel(env, { channel: 'telegram', chatId: contact.contact_value, text: rendered.text })
  }
  if (contact.channel === 'max') {
    return sendDigestToChannel(env, { channel: 'max', chatId: contact.contact_value, text: rendered.text })
  }
  if (contact.channel === 'whatsapp') {
    const templateName = frequency.startsWith('weekly') ? env.WHATSAPP_TEMPLATE_DIGEST_WEEKLY : env.WHATSAPP_TEMPLATE_DIGEST_DAILY
    if (!templateName) return { ok: false as const, error: 'provider_unconfigured' as const, details: 'Missing WhatsApp digest template' }
    return sendDigestToChannel(env, {
      channel: 'whatsapp',
      to: contact.contact_value,
      templateName,
      languageCode: env.WHATSAPP_TEMPLATE_LANGUAGE || 'ru',
      components: [{
        type: 'body',
        parameters: buildWhatsAppDigestParameters(rendered.text, manageUrl),
      }],
    })
  }
  return sendDigestToChannel(env, { channel: 'sms', to: contact.contact_value, text: rendered.text })
}

function buildWhatsAppDigestParameters(renderedText: string, manageUrl: string) {
  return renderedText
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 8)
    .concat([manageUrl])
    .map((text) => ({ type: 'text' as const, text: text.slice(0, 512) }))
}
