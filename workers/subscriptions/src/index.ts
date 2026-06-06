import type { Env, SubscriptionStartRequest, DirectChannel } from './types'
import { buildSubscriptionsDiagnostics, handleDryRun, handleSubscriptionsDiagnostics, handleTestSend, requireAdmin } from './admin'
import { processDueDigests } from './delivery'
import { createConfirmation, createSecureToken, sha256Hex, verifySignedContactToken } from './confirmations'
import { getProviderReadiness, sendDigestToChannel } from './providers/registry'
import { checkRateLimit } from './rate-limit'
import { hmacSha256Hex, requireSecret, timingSafeEqual, verifySvixSignature, verifyWhatsAppSignature } from './security'
import { hasSupabaseServiceRole, insertRows, selectRows, updateRows } from './supabase'
import { validateSubscriptionRequest } from '../../../src/lib/subscriptions/validation.mjs'
import { buildVkArticlePost, findArticleRecord, MAX_VK_MESSAGE_CHARS, publishArticleToVk, sha256Text } from './social/vk'
import { createSupabaseVkIdLoginLink } from './auth/vk-id'

const CATEGORY_SLUGS = ['kulinaria', 'dom-i-uborka', 'dacha-i-ogorod', 'layfkhaki', 'ekonomiya', 'rybalka']
const FREQUENCIES = ['daily_one', 'daily_digest_3', 'weekly_digest_3', 'weekly_digest_7']
const CHANNEL_ACTIONS: Record<DirectChannel, string> = {
  email: 'check_email',
  telegram: 'open_bot',
  max: 'open_bot',
  whatsapp: 'confirm_opt_in',
  sms: 'enter_otp',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function normalizeList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []
}

function cleanPath(value: unknown): string {
  const path = String(value || '/').trim().replace(/[\r\n]/g, '').slice(0, 500)
  return path.startsWith('/') ? path : '/'
}

function cleanTimezone(value: unknown): string {
  return String(value || 'Europe/Moscow').trim().replace(/[^A-Za-z0-9_+\-/]/g, '').slice(0, 80) || 'Europe/Moscow'
}

function normalizePhone(value: unknown): string {
  return String(value || '').replace(/[^\d+]/g, '').slice(0, 32)
}

function normalizeContactValue(channel: DirectChannel, requestJson: SubscriptionStartRequest, fallbackToken: string): string {
  if (channel === 'email') return String(requestJson.contacts?.email || '').trim().toLowerCase()
  if (channel === 'whatsapp' || channel === 'sms') return normalizePhone(requestJson.contacts?.phone)
  return `pending:${fallbackToken}`
}

function isAllowedOrigin(env: Env, request: Request): boolean {
  const allowedOrigins = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const origin = request.headers.get('origin') || ''
  if (!origin) return true
  if (allowedOrigins.length === 0) return false
  return allowedOrigins.includes(origin)
}

function buildChannelState(channel: DirectChannel, ready: boolean, missing: string[]) {
  if (!ready) {
    return {
      status: 'provider_unconfigured',
      action: 'provider_setup_required',
      missing,
    }
  }

  return {
    status: 'pending',
    action: CHANNEL_ACTIONS[channel],
  }
}

function buildChannelAction(channel: DirectChannel, token: string, env: Env) {
  if (channel === 'telegram' && env.TELEGRAM_BOT_USERNAME) {
    return { action: 'open_bot', url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(token)}` }
  }
  if (channel === 'max' && env.MAX_BOT_USERNAME) {
    return { action: 'open_bot', url: `https://max.ru/${env.MAX_BOT_USERNAME}?start=${encodeURIComponent(token)}` }
  }
  if (channel === 'email') return { action: 'check_email' }
  if (channel === 'whatsapp') return { action: 'confirm_opt_in' }
  return { action: 'enter_otp' }
}

async function verifyTurnstile(request: Request, env: Env, token: string | undefined): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return env.SUBSCRIPTIONS_ALLOW_UNVERIFIED_TURNSTILE === 'true'
  if (!token) return false

  const formData = new FormData()
  formData.append('secret', env.TURNSTILE_SECRET_KEY)
  formData.append('response', token)
  const remoteIp = request.headers.get('CF-Connecting-IP')
  if (remoteIp) formData.append('remoteip', remoteIp)

  const res = await fetch(env.TURNSTILE_SITEVERIFY_URL || 'https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) return false
  const data = await res.json() as { success?: boolean }
  return data.success === true
}

type RecipientRow = { id: string }
type ContactRow = { id: string; channel: DirectChannel; status: string }
type ConfirmationRow = { id: string; contact_id: string; expires_at: string; consumed_at: string | null; channel: DirectChannel }
type ExistingContactRow = { id: string; recipient_id: string; channel: DirectChannel; normalized_contact_value: string; status: string }

function siteUrl(env: Env): string {
  return String(env.PUBLIC_SITE_URL || 'https://1001sovet.ru').replace(/\/+$/, '')
}

function apiUrl(request: Request, env: Env): string {
  return String(env.SUBSCRIPTIONS_API_URL || new URL(request.url).origin).replace(/\/+$/, '')
}

function withCors(response: Response, request: Request, env: Env): Response {
  const origin = request.headers.get('origin') || ''
  const headers = new Headers(response.headers)
  if (origin && isAllowedOrigin(env, request)) {
    headers.set('Access-Control-Allow-Origin', origin)
  }
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-admin-key')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

async function hashPii(env: Env, value: string): Promise<string | null> {
  const secret = String(env.PII_HASH_SECRET || '').trim()
  if (!secret) return null
  return hmacSha256Hex(secret, value)
}

function stableContactValue(channel: DirectChannel, requestJson: SubscriptionStartRequest): string | null {
  if (channel === 'email') return String(requestJson.contacts?.email || '').trim().toLowerCase() || null
  if (channel === 'whatsapp' || channel === 'sms') return normalizePhone(requestJson.contacts?.phone).toLowerCase() || null
  return null
}

async function findExistingRecipientId(env: Env, requestJson: SubscriptionStartRequest, channels: DirectChannel[]): Promise<string | null> {
  for (const channel of channels) {
    const value = stableContactValue(channel, requestJson)
    if (!value) continue
    const contacts = await selectRows<{ recipient_id: string }>(
      env,
      'notification_contacts',
      `channel=eq.${encodeURIComponent(channel)}&normalized_contact_value=eq.${encodeURIComponent(value)}&select=recipient_id&limit=1`,
    )
    if (contacts[0]?.recipient_id) return contacts[0].recipient_id
  }
  return null
}

async function ensureRecipientTopics(env: Env, recipientId: string, categories: string[]): Promise<void> {
  const currentTopics = await selectRows<{ id: string; category_slug: string }>(
    env,
    'notification_topic_subscriptions',
    `recipient_id=eq.${encodeURIComponent(recipientId)}&select=id,category_slug`,
  )
  const existingByCategory = new Map(currentTopics.map((topic) => [topic.category_slug, topic]))
  for (const category of CATEGORY_SLUGS) {
    const shouldBeActive = categories.includes(category)
    const existing = existingByCategory.get(category)
    if (existing) {
      await updateRows(env, 'notification_topic_subscriptions', `id=eq.${encodeURIComponent(existing.id)}`, {
        status: shouldBeActive ? 'active' : 'unsubscribed',
      }, 'id')
    } else if (shouldBeActive) {
      await insertRows(env, 'notification_topic_subscriptions', {
        recipient_id: recipientId,
        category_slug: category,
        status: 'active',
      }, 'id')
    }
  }
}

async function persistSubscription(
  request: Request,
  env: Env,
  requestJson: SubscriptionStartRequest,
  categories: string[],
  channels: DirectChannel[],
) {
  const frequency = FREQUENCIES.includes(String(requestJson.frequency)) ? String(requestJson.frequency) : 'weekly_digest_3'
  const anonymousKey = crypto.randomUUID()
  const manageToken = createSecureToken('manage')
  const manageTokenHash = await sha256Hex(manageToken)
  const existingRecipientId = await findExistingRecipientId(env, requestJson, channels)
  let recipientId = existingRecipientId
  if (recipientId) {
    await updateRows(env, 'notification_recipients', `id=eq.${encodeURIComponent(recipientId)}`, {
      frequency,
      timezone: cleanTimezone(requestJson.timezone),
      source_path: cleanPath(requestJson.sourcePath),
      manage_token_hash: manageTokenHash,
      status: 'active',
    }, 'id')
  } else {
    const recipientRows = await insertRows<RecipientRow>(env, 'notification_recipients', {
      anonymous_key: anonymousKey,
      frequency,
      timezone: cleanTimezone(requestJson.timezone),
      source_path: cleanPath(requestJson.sourcePath),
      manage_token_hash: manageTokenHash,
    }, 'id')
    recipientId = recipientRows[0]?.id
  }
  if (!recipientId) throw new Error('recipient_not_created')

  await ensureRecipientTopics(env, recipientId, categories)

  const readiness = getProviderReadiness(env)
  const confirmations = await Promise.all(channels.map((channel) => createConfirmation(channel)))
  const unsubscribeTokens = await Promise.all(channels.map(async () => {
    const token = createSecureToken('unsubscribe')
    return { token, tokenHash: await sha256Hex(token) }
  }))
  const currentContacts = await selectRows<ExistingContactRow>(
    env,
    'notification_contacts',
    `recipient_id=eq.${encodeURIComponent(recipientId)}&select=id,recipient_id,channel,normalized_contact_value,status`,
  )
  const contactRows: ContactRow[] = []
  for (const [index, confirmation] of confirmations.entries()) {
    const unsubscribeToken = unsubscribeTokens[index]
    const contactValue = normalizeContactValue(confirmation.channel, requestJson, confirmation.token)
    const normalizedContactValue = contactValue.toLowerCase()
    const existingContact = currentContacts.find((contact) => (
      contact.channel === confirmation.channel && contact.normalized_contact_value === normalizedContactValue
    ))
    const desiredStatus = readiness[confirmation.channel].ready ? 'pending' : 'provider_unconfigured'
    if (existingContact) {
      const shouldPreserveConfirmed = existingContact.status === 'confirmed'
      const updated = await updateRows<ContactRow>(env, 'notification_contacts', `id=eq.${encodeURIComponent(existingContact.id)}`, {
        status: shouldPreserveConfirmed ? 'confirmed' : desiredStatus,
        provider_metadata: { source: 'subscription_start', resubscribe: true },
        unsubscribe_token_hash: unsubscribeToken.tokenHash,
      }, 'id,channel,status')
      contactRows.push(updated[0] || { id: existingContact.id, channel: existingContact.channel, status: shouldPreserveConfirmed ? 'confirmed' : desiredStatus })
      continue
    }

    const inserted = await insertRows<ContactRow>(env, 'notification_contacts', {
      recipient_id: recipientId,
      channel: confirmation.channel,
      contact_value: contactValue,
      normalized_contact_value: normalizedContactValue,
      status: desiredStatus,
      provider_metadata: { source: 'subscription_start' },
      unsubscribe_token_hash: unsubscribeToken.tokenHash,
    }, 'id,channel,status')
    if (inserted[0]) contactRows.push(inserted[0])
  }
  const contactIdByChannel = new Map(contactRows.map((row) => [row.channel, row.id]))

  for (const contact of contactRows) {
    const existingPreference = await selectRows<{ id: string }>(
      env,
      'notification_channel_preferences',
      `recipient_id=eq.${encodeURIComponent(recipientId)}&contact_id=eq.${encodeURIComponent(contact.id)}&select=id&limit=1`,
    )
    if (existingPreference[0]) {
      await updateRows(env, 'notification_channel_preferences', `id=eq.${encodeURIComponent(existingPreference[0].id)}`, { enabled: true }, 'id')
    } else {
      await insertRows(env, 'notification_channel_preferences', {
        recipient_id: recipientId,
        contact_id: contact.id,
        enabled: true,
      }, 'id')
    }
  }

  const confirmationPayload = confirmations
    .filter((confirmation) => readiness[confirmation.channel].ready)
    .filter((confirmation) => contactRows.find((row) => row.channel === confirmation.channel)?.status !== 'confirmed')
    .map((confirmation) => ({
      contact_id: contactIdByChannel.get(confirmation.channel),
      token_hash: confirmation.tokenHash,
      channel: confirmation.channel,
      expires_at: confirmation.expiresAt,
    }))
    .filter((row) => row.contact_id)
  if (confirmationPayload.length > 0) {
    await insertRows(env, 'notification_confirmations', confirmationPayload, 'id')
  }

  const confirmationSendResults = await sendDirectConfirmations(request, env, requestJson, confirmations, contactRows, contactIdByChannel)

  await insertRows(env, 'notification_consents', [{
    recipient_id: recipientId,
    consent_type: 'category_notifications',
    consent_version: '2026-06-02',
    consent_text: 'User agreed to receive category article notifications in selected channels.',
    granted: true,
    ip_hash: await hashPii(env, request.headers.get('CF-Connecting-IP') || 'unknown'),
    user_agent: String(request.headers.get('user-agent') || '').slice(0, 500),
  }, {
    recipient_id: recipientId,
    consent_type: 'advertising',
    consent_version: '2026-06-02',
    consent_text: 'User advertising consent flag captured separately from category notifications.',
    granted: requestJson.advertisingConsent === true,
    ip_hash: await hashPii(env, request.headers.get('CF-Connecting-IP') || 'unknown'),
    user_agent: String(request.headers.get('user-agent') || '').slice(0, 500),
  }], 'id')

  const channelStates = Object.fromEntries(confirmations.map((confirmation) => {
    const readinessState = readiness[confirmation.channel]
    if (!readinessState.ready) {
      return [confirmation.channel, buildChannelState(confirmation.channel, false, readinessState.missing)]
    }
    if (contactRows.find((row) => row.channel === confirmation.channel)?.status === 'confirmed') {
      return [confirmation.channel, { status: 'confirmed', action: 'already_confirmed' }]
    }
    const sent = confirmationSendResults[confirmation.channel]
    if (sent && !sent.ok) {
      return [confirmation.channel, { status: 'failed', action: 'provider_error', error: sent.error, details: sent.details }]
    }
    return [confirmation.channel, {
      status: 'pending',
      ...buildChannelAction(confirmation.channel, confirmation.token, env),
    }]
  }))

  return { recipientId, manageToken, channelStates }
}

async function sendDirectConfirmations(
  request: Request,
  env: Env,
  requestJson: SubscriptionStartRequest,
  confirmations: Array<{ channel: DirectChannel; token: string; tokenHash: string; expiresAt: string }>,
  contactRows: ContactRow[],
  contactIdByChannel: Map<DirectChannel, string>,
): Promise<Partial<Record<DirectChannel, { ok: boolean; error?: string; details?: string }>>> {
  const results: Partial<Record<DirectChannel, { ok: boolean; error?: string; details?: string }>> = {}
  for (const confirmation of confirmations) {
    if (confirmation.channel === 'telegram' || confirmation.channel === 'max') continue
    const contactId = contactIdByChannel.get(confirmation.channel)
    if (!contactId) continue
    if (contactRows.find((row) => row.channel === confirmation.channel)?.status === 'confirmed') continue

    const confirmUrl = `${apiUrl(request, env)}/subscriptions/confirm?token=${encodeURIComponent(confirmation.token)}`
    const messageText = `Подтвердите подписку на статьи 1001 совет: ${confirmUrl}`
    let result: { ok: boolean; error?: string; details?: string }
    if (confirmation.channel === 'email') {
      result = await sendDigestToChannel(env, {
        channel: 'email',
        to: String(requestJson.contacts?.email || '').trim().toLowerCase(),
        subject: 'Подтверждение подписки на статьи',
        text: messageText,
        html: `<p>Подтвердите подписку на статьи 1001 совет:</p><p><a href="${confirmUrl}">Подтвердить подписку</a></p>`,
        replyTo: env.EMAIL_REPLY_TO,
      })
    } else if (confirmation.channel === 'sms') {
      result = await sendDigestToChannel(env, {
        channel: 'sms',
        to: normalizePhone(requestJson.contacts?.phone),
        text: messageText,
      })
    } else {
      result = await sendDigestToChannel(env, {
        channel: 'whatsapp',
        to: normalizePhone(requestJson.contacts?.phone),
        templateName: String(env.WHATSAPP_TEMPLATE_CONFIRMATION || ''),
        languageCode: env.WHATSAPP_TEMPLATE_LANGUAGE || 'ru',
        components: [{ type: 'body', parameters: [{ type: 'text', text: confirmUrl }] }],
      })
    }

    results[confirmation.channel] = result
    if (!result.ok) {
      await updateRows(env, 'notification_contacts', `id=eq.${encodeURIComponent(contactId)}`, {
        status: 'failed',
        provider_metadata: { source: 'subscription_start', confirmation_error: result },
      }, 'id')
    }
  }
  return results
}

async function handleStart(request: Request, env: Env): Promise<Response> {
  if (!isAllowedOrigin(env, request)) {
    return json({ ok: false, error: 'origin_not_allowed' }, 403)
  }

  let requestJson: SubscriptionStartRequest = {}
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      requestJson = (await request.json()) as SubscriptionStartRequest
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400)
    }
  }

  if (!await verifyTurnstile(request, env, requestJson.turnstileToken)) {
    return json({ ok: false, error: 'turnstile_failed' }, 403)
  }

  const validation = validateSubscriptionRequest(requestJson)
  if (!validation.valid) return json({ ok: false, errors: validation.errors }, 400)
  requestJson = validation.request as SubscriptionStartRequest
  const categories = validation.request.categories
  const channels = validation.request.channels as DirectChannel[]

  if (!hasSupabaseServiceRole(env)) {
    return json({ ok: false, error: 'supabase_service_role_not_configured', diagnostics: buildSubscriptionsDiagnostics(env) }, 503)
  }

  const suppressedChannels = await findSuppressedChannels(env, channels, requestJson)
  if (suppressedChannels.length > 0) {
    return json({ ok: false, error: 'contact_suppressed', channels: suppressedChannels }, 409)
  }

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown'
  const ipLimit = await checkRateLimit(env, `subscription:start:ip:${await sha256Hex(ip)}`, 10, 60 * 60)
  if (!ipLimit.allowed) {
    return json({ ok: false, error: 'rate_limited', retryAfterSeconds: ipLimit.retryAfterSeconds }, 429)
  }
  const contactBucketSource = String(requestJson.contacts?.email || normalizePhone(requestJson.contacts?.phone) || '').trim().toLowerCase()
  if (contactBucketSource) {
    const contactLimit = await checkRateLimit(env, `subscription:start:contact:${await sha256Hex(contactBucketSource)}`, 6, 60 * 60)
    if (!contactLimit.allowed) {
      return json({ ok: false, error: 'rate_limited', retryAfterSeconds: contactLimit.retryAfterSeconds }, 429)
    }
  }

  const { recipientId, manageToken, channelStates } = await persistSubscription(request, env, requestJson, categories, channels)

  return json({
    ok: true,
    recipientId,
    manageToken,
    manageUrl: `${siteUrl(env)}/podpiski/`,
    categories,
    channels: channelStates,
  })
}

async function findSuppressedChannels(env: Env, channels: DirectChannel[], requestJson: SubscriptionStartRequest): Promise<DirectChannel[]> {
  const checks = channels
    .map((channel) => {
      if (channel === 'email') return { channel, value: String(requestJson.contacts?.email || '').trim().toLowerCase() }
      if (channel === 'whatsapp' || channel === 'sms') return { channel, value: normalizePhone(requestJson.contacts?.phone).toLowerCase() }
      return { channel, value: '' }
    })
    .filter((check) => check.value)

  const suppressed: DirectChannel[] = []
  for (const check of checks) {
    const rows = await selectRows<{ id: string }>(
      env,
      'notification_suppression_list',
      `channel=eq.${encodeURIComponent(check.channel)}&normalized_contact_value=eq.${encodeURIComponent(check.value)}&select=id&limit=1`,
    )
    if (rows.length > 0) suppressed.push(check.channel)
  }
  return suppressed
}

function renderConfirmPage(token: string): Response {
  return new Response(`<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Подтверждение подписки</title></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:32px;background:#f7f3ef;color:#1a1a1a">
  <main style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e4df;border-radius:8px;padding:24px">
    <h1 style="font-size:24px;margin:0 0 12px">Подтвердите подписку</h1>
    <p style="line-height:1.6">Нажмите кнопку, чтобы включить уведомления по выбранным категориям.</p>
    <form method="post" action="/subscriptions/confirm">
      <input type="hidden" name="token" value="${escapeHtml(token)}">
      <button type="submit" style="background:#c0392b;color:#fff;border:0;border-radius:6px;padding:12px 16px;font-weight:700;cursor:pointer">Подтвердить</button>
    </form>
  </main>
</body>
</html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

async function handleConfirm(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  if (request.method === 'GET') {
    const token = url.searchParams.get('token') || ''
    if (!token) return json({ ok: false, error: 'invalid_confirmation' }, 400)
    return renderConfirmPage(token)
  }

  const payload = await readRequestPayload(request)
  const token = String(payload.token || url.searchParams.get('token') || '').trim()
  if (!token || !hasSupabaseServiceRole(env)) {
    return json({ ok: false, error: 'invalid_confirmation' }, 400)
  }

  const tokenHash = await sha256Hex(token)
  const rows = await selectRows<{ id: string; contact_id: string; expires_at: string; consumed_at: string | null }>(
    env,
    'notification_confirmations',
    `token_hash=eq.${encodeURIComponent(tokenHash)}&select=id,contact_id,expires_at,consumed_at&limit=1`,
  )
  const confirmation = rows[0]
  if (!confirmation || confirmation.consumed_at || new Date(confirmation.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: 'confirmation_expired_or_consumed' }, 400)
  }

  await updateRows(env, 'notification_contacts', `id=eq.${encodeURIComponent(confirmation.contact_id)}`, {
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
  }, 'id')
  await updateRows(env, 'notification_confirmations', `id=eq.${encodeURIComponent(confirmation.id)}`, { consumed_at: new Date().toISOString() }, 'id')

  return Response.redirect(`${siteUrl(env)}/podpiski/?confirmed=1`, 302)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char))
}

async function readRequestPayload(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return await request.json().catch(() => ({})) as Record<string, unknown>
  }
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => new FormData())
    return Object.fromEntries(form.entries())
  }
  return {}
}

async function handleManage(request: Request, env: Env): Promise<Response> {
  if (!isAllowedOrigin(env, request)) {
    return json({ ok: false, error: 'origin_not_allowed' }, 403)
  }
  if (!hasSupabaseServiceRole(env)) return json({ ok: false, error: 'supabase_service_role_not_configured' }, 503)
  const payload = await readRequestPayload(request)
  const token = String(payload.token || payload.manageToken || '').trim()
  if (!token) return json({ ok: false, error: 'manage_token_required' }, 400)

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown'
  const ipLimit = await checkRateLimit(env, `subscription:manage:ip:${await sha256Hex(ip)}`, 30, 60 * 60)
  if (!ipLimit.allowed) {
    return json({ ok: false, error: 'rate_limited', retryAfterSeconds: ipLimit.retryAfterSeconds }, 429)
  }
  const tokenLimit = await checkRateLimit(env, `subscription:manage:token:${await sha256Hex(token)}`, 20, 60 * 60)
  if (!tokenLimit.allowed) {
    return json({ ok: false, error: 'rate_limited', retryAfterSeconds: tokenLimit.retryAfterSeconds }, 429)
  }

  const recipients = await selectRows<{ id: string; frequency: string; status: string }>(
    env,
    'notification_recipients',
    `manage_token_hash=eq.${encodeURIComponent(await sha256Hex(token))}&select=id,frequency,status&limit=1`,
  )
  const recipient = recipients[0]
  if (!recipient) return json({ ok: false, error: 'subscription_not_found' }, 404)

  const requestedCategories = normalizeList(payload.categories).filter((category) => CATEGORY_SLUGS.includes(category))
  const requestedFrequency = String(payload.frequency || '')
  if (requestedFrequency && FREQUENCIES.includes(requestedFrequency)) {
    await updateRows(env, 'notification_recipients', `id=eq.${encodeURIComponent(recipient.id)}`, { frequency: requestedFrequency }, 'id')
    recipient.frequency = requestedFrequency
  }

  if (requestedCategories.length > 0) {
    const currentTopics = await selectRows<{ id: string; category_slug: string }>(
      env,
      'notification_topic_subscriptions',
      `recipient_id=eq.${encodeURIComponent(recipient.id)}&select=id,category_slug`,
    )
    const existingByCategory = new Map(currentTopics.map((topic) => [topic.category_slug, topic]))
    for (const category of CATEGORY_SLUGS) {
      const shouldBeActive = requestedCategories.includes(category)
      const existing = existingByCategory.get(category)
      if (existing) {
        await updateRows(env, 'notification_topic_subscriptions', `id=eq.${encodeURIComponent(existing.id)}`, {
          status: shouldBeActive ? 'active' : 'unsubscribed',
        }, 'id')
      } else if (shouldBeActive) {
        await insertRows(env, 'notification_topic_subscriptions', {
          recipient_id: recipient.id,
          category_slug: category,
          status: 'active',
        }, 'id')
      }
    }
  }

  return json({ ok: true, subscription: await loadManageState(env, recipient.id) })
}

async function loadManageState(env: Env, recipientId: string) {
  const [recipients, contacts, topics] = await Promise.all([
    selectRows<{ id: string; frequency: string; status: string }>(env, 'notification_recipients', `id=eq.${encodeURIComponent(recipientId)}&select=id,frequency,status&limit=1`),
    selectRows<{ id: string; channel: DirectChannel; status: string; contact_value: string }>(env, 'notification_contacts', `recipient_id=eq.${encodeURIComponent(recipientId)}&select=id,channel,status,contact_value`),
    selectRows<{ category_slug: string; status: string }>(env, 'notification_topic_subscriptions', `recipient_id=eq.${encodeURIComponent(recipientId)}&select=category_slug,status`),
  ])
  return {
    recipient: recipients[0],
    contacts: contacts.map((contact) => ({
      id: contact.id,
      channel: contact.channel,
      status: contact.status,
      contact: maskContact(contact.channel, contact.contact_value),
    })),
    categories: topics,
  }
}

function maskContact(channel: DirectChannel, value: string): string {
  if (channel === 'email') {
    const [name, domain] = value.split('@')
    return domain ? `${name.slice(0, 2)}***@${domain}` : '***'
  }
  if (value.length <= 4) return '***'
  return `${value.slice(0, 2)}***${value.slice(-2)}`
}

async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
  if (!hasSupabaseServiceRole(env)) return json({ ok: false, error: 'supabase_service_role_not_configured' }, 503)
  const url = new URL(request.url)
  const payload = await readRequestPayload(request)
  const token = String(payload.token || url.searchParams.get('token') || '').trim()
  if (!token) return json({ ok: false, error: 'unsubscribe_token_required' }, 400)

  let contactId = await verifySignedContactToken(env, token)
  if (!contactId) {
    const rows = await selectRows<{ id: string }>(
      env,
      'notification_contacts',
      `unsubscribe_token_hash=eq.${encodeURIComponent(await sha256Hex(token))}&select=id&limit=1`,
    )
    contactId = rows[0]?.id || null
  }
  if (!contactId) return json({ ok: false, error: 'subscription_contact_not_found' }, 404)

  const contacts = await selectRows<{ id: string; recipient_id: string; channel: DirectChannel; normalized_contact_value: string }>(
    env,
    'notification_contacts',
    `id=eq.${encodeURIComponent(contactId)}&select=id,recipient_id,channel,normalized_contact_value&limit=1`,
  )
  const contact = contacts[0]
  if (!contact) return json({ ok: false, error: 'subscription_contact_not_found' }, 404)

  await updateRows(env, 'notification_contacts', `id=eq.${encodeURIComponent(contact.id)}`, { status: 'unsubscribed' }, 'id')
  await updateRows(env, 'notification_channel_preferences', `contact_id=eq.${encodeURIComponent(contact.id)}`, { enabled: false }, 'id')
  return json({ ok: true, unsubscribed: true, channel: contact.channel })
}

async function confirmContactByToken(env: Env, channel: DirectChannel, token: string, contactValue: string, metadata: Record<string, unknown>) {
  const tokenHash = await sha256Hex(token)
  const confirmations = await selectRows<ConfirmationRow>(
    env,
    'notification_confirmations',
    [
      `token_hash=eq.${encodeURIComponent(tokenHash)}`,
      `channel=eq.${encodeURIComponent(channel)}`,
      'select=id,contact_id,expires_at,consumed_at,channel',
      'limit=1',
    ].join('&'),
  )
  const confirmation = confirmations[0]
  if (!confirmation || confirmation.consumed_at || new Date(confirmation.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'confirmation_expired_or_consumed' }
  }

  await updateRows(env, 'notification_contacts', `id=eq.${encodeURIComponent(confirmation.contact_id)}`, {
    contact_value: contactValue,
    normalized_contact_value: contactValue.toLowerCase(),
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
    provider_metadata: metadata,
  }, 'id')
  await updateRows(env, 'notification_confirmations', `id=eq.${encodeURIComponent(confirmation.id)}`, { consumed_at: new Date().toISOString() }, 'id')

  return { ok: true, contactId: confirmation.contact_id }
}

function extractStartToken(text: unknown): string {
  const raw = String(text || '').trim()
  if (!raw) return ''
  const match = /^\/start(?:\s+(.+))?$/i.exec(raw)
  return String(match?.[1] || raw).trim()
}

async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  let secret = ''
  try {
    secret = requireSecret(env.TELEGRAM_WEBHOOK_SECRET, 'telegram_webhook_secret')
  } catch {
    return json({ ok: false, error: 'telegram_webhook_secret_not_configured' }, 503)
  }
  if (!timingSafeEqual(request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '', secret)) {
    return json({ ok: false, error: 'webhook_unauthorized' }, 401)
  }
  if (!hasSupabaseServiceRole(env)) return json({ ok: false, error: 'supabase_service_role_not_configured' }, 503)
  const payload = await request.json().catch(() => ({})) as { message?: { text?: string; chat?: { id?: string | number } } }
  const token = extractStartToken(payload.message?.text)
  const chatId = payload.message?.chat?.id
  if (!token || chatId === undefined || chatId === null) return json({ ok: true, ignored: true })
  const result = await confirmContactByToken(env, 'telegram', token, String(chatId), { source: 'telegram_webhook', chat_id: chatId })
  return json(result, result.ok ? 200 : 400)
}

async function handleMaxWebhook(request: Request, env: Env): Promise<Response> {
  let secret = ''
  try {
    secret = requireSecret(env.MAX_WEBHOOK_SECRET, 'max_webhook_secret')
  } catch {
    return json({ ok: false, error: 'max_webhook_secret_not_configured' }, 503)
  }
  const provided = request.headers.get('x-max-webhook-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!timingSafeEqual(provided, secret)) {
    return json({ ok: false, error: 'webhook_unauthorized' }, 401)
  }
  if (!hasSupabaseServiceRole(env)) return json({ ok: false, error: 'supabase_service_role_not_configured' }, 503)
  const payload = await request.json().catch(() => ({})) as Record<string, unknown>
  const message = (payload.message || payload.update || payload) as Record<string, unknown>
  const token = extractStartToken(message.text || message.body)
  const chat = (message.chat || message.recipient || {}) as Record<string, unknown>
  const chatId = chat.id || message.chat_id || message.dialog_id
  if (!token || chatId === undefined || chatId === null) return json({ ok: true, ignored: true })
  const result = await confirmContactByToken(env, 'max', token, String(chatId), { source: 'max_webhook', chat_id: chatId })
  return json(result, result.ok ? 200 : 400)
}

async function handleWhatsAppWebhook(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  if (request.method === 'GET') {
    const verifyToken = String(env.WHATSAPP_VERIFY_TOKEN || '').trim()
    if (!verifyToken) return json({ ok: false, error: 'whatsapp_verify_token_not_configured' }, 503)
    if (url.searchParams.get('hub.mode') === 'subscribe' && timingSafeEqual(url.searchParams.get('hub.verify_token') || '', verifyToken)) {
      return new Response(url.searchParams.get('hub.challenge') || '', { status: 200 })
    }
    return json({ ok: false, error: 'webhook_unauthorized' }, 401)
  }

  if (!hasSupabaseServiceRole(env)) return json({ ok: false, error: 'supabase_service_role_not_configured' }, 503)
  const signatureSecret = String(env.WHATSAPP_APP_SECRET || env.WHATSAPP_WEBHOOK_SECRET || '').trim()
  if (!signatureSecret) return json({ ok: false, error: 'whatsapp_signature_secret_not_configured' }, 503)
  const rawBody = await request.text()
  if (!await verifyWhatsAppSignature(signatureSecret, rawBody, request.headers.get('x-hub-signature-256'))) {
    return json({ ok: false, error: 'webhook_unauthorized' }, 401)
  }
  const payload = JSON.parse(rawBody || '{}') as { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from?: string; text?: { body?: string } }> } }> }> }
  const messages = payload.entry?.flatMap((entry) => entry.changes || []).flatMap((change) => change.value?.messages || []) || []
  for (const message of messages) {
    const token = extractStartToken(message.text?.body)
    if (token && message.from) {
      const result = await confirmContactByToken(env, 'whatsapp', token, normalizePhone(message.from), { source: 'whatsapp_webhook', from: message.from })
      if (result.ok) return json(result)
    }
  }
  return json({ ok: true, ignored: true })
}

async function handleResendWebhook(request: Request, env: Env): Promise<Response> {
  if (!hasSupabaseServiceRole(env)) return json({ ok: false, error: 'supabase_service_role_not_configured' }, 503)
  const secret = String(env.RESEND_WEBHOOK_SECRET || '').trim()
  if (!secret) return json({ ok: false, error: 'resend_webhook_secret_not_configured' }, 503)
  const rawBody = await request.text()
  if (!await verifySvixSignature(secret, rawBody, request.headers)) {
    return json({ ok: false, error: 'webhook_unauthorized' }, 401)
  }
  const payload = JSON.parse(rawBody || '{}') as { type?: string; data?: { to?: string[] | string; email_id?: string } }
  const type = String(payload.type || '')
  if (!/(bounced|complained|spam|unsubscribed)/i.test(type)) return json({ ok: true, ignored: true })
  const recipients = Array.isArray(payload.data?.to) ? payload.data?.to : [payload.data?.to].filter(Boolean) as string[]
  for (const email of recipients) {
    const normalized = String(email).trim().toLowerCase()
    if (!normalized) continue
    const existing = await selectRows<{ id: string }>(
      env,
      'notification_suppression_list',
      `channel=eq.email&normalized_contact_value=eq.${encodeURIComponent(normalized)}&select=id&limit=1`,
    )
    if (existing.length === 0) {
      await insertRows(env, 'notification_suppression_list', {
        channel: 'email',
        normalized_contact_value: normalized,
        reason: type,
        provider_payload: payload,
      }, 'id')
    }
  }
  return json({ ok: true })
}

async function handleSocialTargets(env: Env): Promise<Response> {
  if (!hasSupabaseServiceRole(env)) return json({ ok: false, error: 'supabase_service_role_not_configured' }, 503)
  const targets = await selectRows<{ platform: string; display_name: string; url: string }>(
    env,
    'social_follow_targets',
    'status=eq.active&select=platform,display_name,url&order=platform.asc',
  )
  return json({ ok: true, targets })
}

async function handleVkIdExchange(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('origin') || ''
  if (origin && !isAllowedOrigin(env, request)) {
    return json({ ok: false, error: 'origin_not_allowed' }, 403)
  }

  const payload = await request.json().catch(() => ({})) as { code?: string; device_id?: string; deviceId?: string; code_verifier?: string; codeVerifier?: string }
  const code = String(payload.code || '').trim()
  const deviceId = String(payload.device_id || payload.deviceId || '').trim()
  const codeVerifier = String(payload.code_verifier || payload.codeVerifier || '').trim()

  if (!code || !deviceId || !codeVerifier) {
    return json({ ok: false, error: 'vk_code_device_id_and_verifier_required' }, 400)
  }
  if (code.length > 2000 || deviceId.length > 300 || codeVerifier.length > 300) {
    return json({ ok: false, error: 'invalid_vk_payload' }, 400)
  }
  if (!hasSupabaseServiceRole(env)) {
    return json({ ok: false, error: 'provider_unconfigured', missing: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !env[k as keyof Env]) }, 503)
  }

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown'
  const ipLimit = await checkRateLimit(env, `vkid:exchange:ip:${await sha256Hex(ip)}`, 30, 60 * 60)
  if (!ipLimit.allowed) {
    return json({ ok: false, error: 'rate_limited', retryAfterSeconds: ipLimit.retryAfterSeconds }, 429)
  }

  try {
    const result = await createSupabaseVkIdLoginLink(env, { code, deviceId, codeVerifier })
    return json({
      ok: true,
      actionLink: result.actionLink,
      emailHint: result.email.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
    })
  } catch (err) {
    const e = err as Error & { missing?: string[] }
    if (e.message === 'provider_unconfigured') {
      return json({ ok: false, error: 'provider_unconfigured', missing: e.missing || [] }, 503)
    }
    if (e.message === 'vk_email_missing') {
      return json({ ok: false, error: 'vk_email_missing', message: 'VK ID не вернул email. Включите scope email в настройках входа.' }, 400)
    }
    return json({ ok: false, error: 'vk_auth_failed' }, 502)
  }
}

async function handleVkDryRun(request: Request, env: Env): Promise<Response> {
  const adminError = requireAdmin(request, env)
  if (adminError) return adminError

  if (!hasSupabaseServiceRole(env)) {
    return json({ ok: false, error: 'supabase_service_role_not_configured' }, 503)
  }

  const payload = await request.json().catch(() => ({})) as { articleSlug?: string; requirePhoto?: boolean }
  const articleSlug = String(payload.articleSlug || '').trim()
  if (!articleSlug) {
    return json({ ok: false, error: 'article_slug_required' }, 400)
  }

  // Validate VK config (soft check for dry-run diagnostics)
  const vkAccessToken = Boolean(env.VK_ACCESS_TOKEN)
  const vkGroupId = Boolean(env.VK_GROUP_ID)
  if (!vkAccessToken || !vkGroupId) {
    return json({ ok: false, error: 'provider_unconfigured', missing: ['VK_ACCESS_TOKEN', 'VK_GROUP_ID'].filter((k) => !env[k as keyof Env]) }, 503)
  }

  const siteUrl = String(env.PUBLIC_SITE_URL || 'https://1001sovet.ru').replace(/\/+$/, '')
  const record = findArticleRecord(articleSlug)
  if (!record) {
    return json({ ok: false, error: 'article_not_found' }, 404)
  }

  let post: ReturnType<typeof buildVkArticlePost>
  try {
    post = buildVkArticlePost({ record, siteUrl })
  } catch (err) {
    const code = (err && typeof err === 'object' && 'code' in err) ? String((err as { code?: string }).code) : 'build_failed'
    return json({ ok: false, error: (err as Error).message, errorCode: code }, 400)
  }

  const bodyHash = await sha256Text(`${post.message}\n${post.imageUrl}`)

  return json({
    ok: true,
    dryRun: true,
    articleSlug,
    title: record.title,
    canonicalUrl: post.canonicalUrl,
    imageUrl: post.imageUrl,
    messageLength: post.messageLength,
    bodyHash,
    wouldPost: {
      owner_id: `-${String(env.VK_GROUP_ID)}`,
      from_group: 1,
      hasPhoto: true,
      attachmentPreview: 'photo',
      maxChars: MAX_VK_MESSAGE_CHARS,
    },
  })
}

async function handleVkPost(request: Request, env: Env): Promise<Response> {
  const adminError = requireAdmin(request, env)
  if (adminError) return adminError

  if (!hasSupabaseServiceRole(env)) {
    return json({ ok: false, error: 'supabase_service_role_not_configured' }, 503)
  }

  const payload = await request.json().catch(() => ({})) as { articleSlug?: string; requirePhoto?: boolean }
  const articleSlug = String(payload.articleSlug || '').trim()
  const requirePhoto = payload.requirePhoto !== false
  if (!articleSlug) {
    return json({ ok: false, error: 'article_slug_required' }, 400)
  }

  // Verify article exists in publication index
  const articles = await selectRows<{ article_slug: string }>(
    env,
    'articles_publication_index',
    `article_slug=eq.${encodeURIComponent(articleSlug)}&select=article_slug&limit=1`,
  )
  if (articles.length === 0) {
    return json({ ok: false, error: 'article_not_found' }, 404)
  }

  // Prevent duplicate
  const existing = await selectRows<{ id: string; provider_post_id: string; status: string }>(
    env,
    'social_publications',
    `platform=eq.vk&article_slug=eq.${encodeURIComponent(articleSlug)}&select=id,provider_post_id,status&limit=1`,
  )
  const posted = existing.find((row) => row.status === 'posted')
  if (posted) {
    return json({ ok: false, error: 'duplicate_already_posted', providerPostId: posted.provider_post_id }, 409)
  }

  const result = await publishArticleToVk(env, articleSlug, { dryRun: false, requirePhoto })

  if (!result.ok) {
    // Insert failed record
    try {
      await insertRows(env, 'social_publications', {
        platform: 'vk',
        article_slug: articleSlug,
        body_hash: result.bodyHash || '',
        status: 'failed',
        provider_payload: { error: result.error, errorCode: result.errorCode },
        error_code: result.errorCode || 'unknown',
        error_message: result.error || 'unknown',
      }, 'id')
    } catch {
      // Ignore DB write failure
    }
    return json({ ok: false, error: result.error, errorCode: result.errorCode }, 502)
  }

  // Upsert success record
  const upsertPayload = {
    platform: 'vk',
    article_slug: articleSlug,
    body_hash: result.bodyHash,
    status: 'posted',
    provider_post_id: result.providerPostId,
    provider_payload: { postUrl: result.postUrl, messageLength: result.messageLength },
    posted_at: new Date().toISOString(),
  }

  if (existing[0]) {
    await updateRows(env, 'social_publications', `id=eq.${encodeURIComponent(existing[0].id)}`, upsertPayload, 'id')
  } else {
    await insertRows(env, 'social_publications', upsertPayload, 'id')
  }

  return json({
    ok: true,
    articleSlug,
    providerPostId: result.providerPostId,
    postUrl: result.postUrl,
    messageLength: result.messageLength,
    bodyHash: result.bodyHash,
  })
}

async function handleSocialTrack(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('origin') || ''
  if (origin && !isAllowedOrigin(env, request)) {
    return json({ ok: false, error: 'origin_not_allowed' }, 403)
  }
  if (!hasSupabaseServiceRole(env)) return json({ ok: false, error: 'supabase_service_role_not_configured' }, 503)

  const payload = await request.json().catch(() => ({})) as { platform?: string; action?: string; sourcePath?: string }
  if (!['vk', 'ok', 'facebook'].includes(String(payload.platform)) || !['cta_view', 'cta_click'].includes(String(payload.action))) {
    return json({ ok: false, error: 'invalid_social_action' }, 400)
  }

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown'
  const ipLimit = await checkRateLimit(env, `social:track:ip:${await sha256Hex(ip)}`, 120, 60 * 60)
  if (!ipLimit.allowed) {
    return json({ ok: false, error: 'rate_limited', retryAfterSeconds: ipLimit.retryAfterSeconds }, 429)
  }

  await insertRows(env, 'recipient_social_actions', {
    recipient_id: null,
    platform: payload.platform,
    action: payload.action,
    source_path: cleanPath(payload.sourcePath),
  }, 'id')
  return json({ ok: true })
}

export async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  if (req.method === 'POST' && url.pathname === '/subscriptions/start') {
    return handleStart(req, env)
  }

  if (req.method === 'GET' && url.pathname === '/admin/subscriptions/diagnostics') {
    return handleSubscriptionsDiagnostics(req, env)
  }

  if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/subscriptions/confirm') {
    return handleConfirm(req, env)
  }

  if (req.method === 'POST' && url.pathname === '/subscriptions/manage') {
    return handleManage(req, env)
  }

  if (req.method === 'POST' && url.pathname === '/subscriptions/unsubscribe') {
    return handleUnsubscribe(req, env)
  }

  if (req.method === 'GET' && url.pathname === '/social/targets') {
    return handleSocialTargets(env)
  }

  if (req.method === 'POST' && url.pathname === '/auth/vk/exchange') {
    return handleVkIdExchange(req, env)
  }

  if (req.method === 'POST' && url.pathname === '/social/track') {
    return handleSocialTrack(req, env)
  }

  if (req.method === 'POST' && url.pathname === '/webhooks/telegram') {
    return handleTelegramWebhook(req, env)
  }

  if (req.method === 'POST' && url.pathname === '/webhooks/max') {
    return handleMaxWebhook(req, env)
  }

  if (req.method === 'POST' && url.pathname === '/webhooks/resend') {
    return handleResendWebhook(req, env)
  }

  if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/webhooks/whatsapp') {
    return handleWhatsAppWebhook(req, env)
  }

  if (req.method === 'POST' && url.pathname === '/admin/subscriptions/dry-run') {
    return handleDryRun(req, env)
  }

  if (req.method === 'POST' && url.pathname === '/admin/subscriptions/test-send') {
    return handleTestSend(req, env)
  }

  if (req.method === 'POST' && url.pathname === '/admin/social/vk/dry-run') {
    return handleVkDryRun(req, env)
  }

  if (req.method === 'POST' && url.pathname === '/admin/social/vk/post') {
    return handleVkPost(req, env)
  }

  return json({ ok: false, error: 'not_found', path: url.pathname }, 404)
}

export async function scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
  await processDueDigests(env)
}

const worker = {
  async fetch(req: Request, env: Env) {
    return withCors(await route(req, env), req, env)
  },
  scheduled,
}

export default worker
