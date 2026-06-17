import type { Env } from './types'
import { getDeliveryPeriod, planDigestArticles } from './delivery-planner.mjs'
import { sendOneDigest } from './delivery'
import { getProviderReadiness } from './providers/registry'
import { timingSafeEqual } from './security'
import { hasSupabaseServiceRole, selectRows } from './supabase'
import { SUBSCRIPTION_CATEGORY_SLUGS } from '../../../src/lib/subscriptions/constants.mjs'
import { vkConfiguredCategories } from './social/vk-autopost'
import { fbConfiguredCategories } from './social/fb-autopost'

export function buildSubscriptionsDiagnostics(env: Env) {
  return {
    providers: getProviderReadiness(env),
    security: {
      allowedOriginsConfigured: String(env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean).length > 0,
      turnstileConfigured: Boolean(env.TURNSTILE_SECRET_KEY),
      unsubscribeTokenSecretConfigured: Boolean(env.UNSUBSCRIBE_TOKEN_SECRET),
      piiHashSecretConfigured: Boolean(env.PII_HASH_SECRET),
      resendWebhookSecretConfigured: Boolean(env.RESEND_WEBHOOK_SECRET),
      whatsappSignatureSecretConfigured: Boolean(env.WHATSAPP_APP_SECRET || env.WHATSAPP_WEBHOOK_SECRET),
    },
  }
}

export function requireAdmin(request: Request, env: Env): Response | null {
  const configuredKey = String(env.ADMIN_API_KEY || '').trim()
  if (!configuredKey) {
    return json({ ok: false, error: 'admin_api_key_not_configured' }, 503)
  }
  const providedKey = request.headers.get('x-admin-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!timingSafeEqual(providedKey, configuredKey)) {
    return json({ ok: false, error: 'admin_unauthorized' }, 401)
  }
  return null
}

export function handleSubscriptionsDiagnostics(request: Request, env: Env): Response {
  const adminError = requireAdmin(request, env)
  if (adminError) return adminError

  return new Response(JSON.stringify(buildSubscriptionsDiagnostics(env)), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export async function handleDryRun(request: Request, env: Env): Promise<Response> {
  const adminError = requireAdmin(request, env)
  if (adminError) return adminError

  if (!hasSupabaseServiceRole(env)) {
    return json({ ok: false, error: 'supabase_service_role_not_configured' }, 503)
  }

  const payload = await request.json().catch(() => ({})) as { recipientId?: string; contactId?: string; now?: string }
  if (!payload.recipientId || !payload.contactId) {
    return json({ ok: false, error: 'recipientId_and_contactId_required' }, 400)
  }

  const [recipients, contacts, topics, articles, deliveryItems] = await Promise.all([
    selectRows<{ id: string; frequency: string }>(env, 'notification_recipients', `id=eq.${encodeURIComponent(payload.recipientId)}&select=id,frequency&limit=1`),
    selectRows<{ id: string; confirmed_at: string | null; channel: string }>(env, 'notification_contacts', `id=eq.${encodeURIComponent(payload.contactId)}&recipient_id=eq.${encodeURIComponent(payload.recipientId)}&select=id,confirmed_at,channel&limit=1`),
    selectRows<{ category_slug: string }>(env, 'notification_topic_subscriptions', `recipient_id=eq.${encodeURIComponent(payload.recipientId)}&status=eq.active&select=category_slug`),
    selectRows<Record<string, unknown>>(env, 'articles_publication_index', 'select=article_slug,category_slug,title,canonical_path,description,published_at,first_seen_at&order=first_seen_at.asc'),
    selectRows<{ article_slug: string }>(
      env,
      'notification_delivery_items',
      `select=article_slug,notification_deliveries!inner(contact_id,status,delivery_period)&notification_deliveries.contact_id=eq.${encodeURIComponent(payload.contactId)}&notification_deliveries.status=eq.sent&notification_deliveries.delivery_period=not.like.*%3Atest%3A*`,
    ),
  ])

  const recipient = recipients[0]
  const contact = contacts[0]
  if (!recipient || !contact) {
    return json({ ok: false, error: 'recipient_or_contact_not_found' }, 404)
  }

  const planned = planDigestArticles({
    frequency: recipient.frequency,
    subscribedCategories: topics.map((topic) => topic.category_slug),
    articles,
    deliveredSlugs: deliveryItems.map((item) => item.article_slug),
    confirmedAt: contact.confirmed_at || new Date().toISOString(),
    now: payload.now ? new Date(payload.now) : new Date(),
  })

  return json({
    ok: true,
    dryRun: true,
    recipientId: recipient.id,
    contactId: contact.id,
    channel: contact.channel,
    frequency: recipient.frequency,
    deliveryPeriod: getDeliveryPeriod(recipient.frequency, payload.now ? new Date(payload.now) : new Date()),
    articles: planned,
  })
}

export async function handleTestSend(request: Request, env: Env): Promise<Response> {
  const adminError = requireAdmin(request, env)
  if (adminError) return adminError

  const payload = await request.json().catch(() => ({})) as { recipientId?: string; contactId?: string; now?: string }
  if (!payload.recipientId || !payload.contactId) {
    return json({ ok: false, error: 'recipientId_and_contactId_required' }, 400)
  }

  const result = await sendOneDigest(env, {
    recipientId: payload.recipientId,
    contactId: payload.contactId,
    now: payload.now ? new Date(payload.now) : new Date(),
    force: true,
  })
  return json({ ok: result.status === 'sent', testSend: true, result }, result.status === 'failed' ? 502 : 200)
}

/**
 * GET /admin/social/autopost-inventory — redacted coverage of the per-category
 * autopost maps vs the 12 top-level categories. Returns ONLY category slugs and
 * counts; never group IDs, page IDs, tokens, or raw secret JSON. `present` uses
 * the same validation as real routing (VK needs groupId; FB needs id+token), so
 * it reflects what autopost would actually post to. Absent/empty/malformed map →
 * present:[], missing: all 12.
 */
export function handleAutopostInventory(request: Request, env: Env): Response {
  const adminError = requireAdmin(request, env)
  if (adminError) return adminError

  const all = SUBSCRIPTION_CATEGORY_SLUGS
  const coverage = (configured: string[]) => {
    const present = all.filter((slug) => configured.includes(slug))
    const missing = all.filter((slug) => !present.includes(slug))
    return { present, missing, count: present.length }
  }

  return json({
    ok: true,
    total: all.length,
    vk: coverage(vkConfiguredCategories(env)),
    fb: coverage(fbConfiguredCategories(env)),
  })
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
