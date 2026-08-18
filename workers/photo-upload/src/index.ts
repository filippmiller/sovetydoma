import { buildRateLimitBucket, checkIngestionRateLimit, rateLimitKv } from './rate-limit'
import { buildCors, parseOriginList } from './cors'
import {
  createContactToken,
  validateContactToken,
  rateLimitContact,
  sendContactEmail,
} from './contact'
import {
  parseUserAgent,
  classifyTraffic,
  cleanText,
  cleanArticleSlug,
  cleanId,
  cleanPath,
  referrerDomain,
  parseUtm,
} from './analytics'
import { insertConsentEvent, hashIp, type ConsentPurpose, type ConsentMethod } from './consent'
import { requestErasure, cancelErasure, getErasureStatus, finalizeErasureRequests } from './erasure'
import { TERMS_VERSION, PRIVACY_POLICY_VERSION } from '../../../src/lib/legal/document-versions'

// Cloudflare Worker: photo upload + serving backed by R2.
// The static site cannot write to R2 directly, so this Worker:
//   POST /upload     — validates the caller's Supabase JWT, stores the file in
//                      R2, returns { key }.
//   GET  /file/<key> — streams the object back from R2 (R2 is private).

interface Env {
  PHOTOS: R2Bucket
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string // secret via `wrangler secret put`
  SUPABASE_SERVICE_ROLE_KEY?: string // secret via `wrangler secret put`; used only for narrow anonymous view ingestion
  ALLOWED_ORIGIN: string
  CONTACT_ALLOWED_ORIGINS?: string
  VIEW_ALLOWED_ORIGINS?: string
  CONTACT_FORM_SECRET: string
  CONTACT_TO_EMAIL?: string
  CONTACT_FROM_EMAIL?: string
  EMAIL?: {
    send(message: import('cloudflare:email').EmailMessage): Promise<unknown>
  }
  RESEND_API_KEY?: string
  RATE_LIMIT_KV?: KVNamespace
  TURNSTILE_SECRET_KEY?: string
  // 152-FZ compliance (consent evidence + erasure/retention — canon at
  // D:/DEV/CRM-INVITE/COMPLIANCE_152FZ_CANON.md). HMAC pepper for hashing IPs
  // before they are stored in consent_events/erasure_requests; set via
  // `wrangler secret put PII_HASH_SECRET` (same convention as the
  // subscriptions worker's PII_HASH_SECRET, but configured independently —
  // Workers secrets are per-worker, not shared).
  PII_HASH_SECRET?: string
}

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// ---------------------------------------------------------------------------
// Per-route CORS factories (each preserves the exact methods/headers it had).
// All go through buildCors() which applies the H3 security fix.
// ---------------------------------------------------------------------------

function cors(env: Env): Record<string, string> {
  // Fail closed: never emit a wildcard on authenticated upload/file routes.
  // `cors` doesn't reflect origin at all — it uses the static env value.
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || 'https://1001sovet.ru',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-article-slug, x-file-ext',
    'Vary': 'Origin',
  }
}

function contactCors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed = parseOriginList(env.CONTACT_ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || 'https://1001sovet.ru')
  return buildCors(origin, allowed, 'POST, GET, OPTIONS', {
    'Access-Control-Allow-Headers': 'content-type',
  })
}

function restrictedCors(req: Request, allowedValue: string | undefined, fallback: string): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed = parseOriginList(allowedValue || fallback)
  return buildCors(origin, allowed, 'POST, OPTIONS', {
    'Access-Control-Allow-Headers': 'content-type',
  })
}

function accountCors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed = parseOriginList(env.CONTACT_ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || 'https://1001sovet.ru')
  return buildCors(origin, allowed, 'POST, GET, OPTIONS', {
    'Access-Control-Allow-Headers': 'authorization, content-type',
  })
}

function analyticsCors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed = parseOriginList(
    env.VIEW_ALLOWED_ORIGINS || env.CONTACT_ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || 'https://1001sovet.ru',
  )
  return buildCors(origin, allowed, 'POST, GET, OPTIONS', {
    'Access-Control-Allow-Headers': 'authorization, content-type',
  })
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function validateUser(env: Env, authHeader: string): Promise<string | null> {
  if (!authHeader) return null
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: env.SUPABASE_ANON_KEY },
    })
    if (!res.ok) return null
    const u = await res.json()
    return u?.id || null
  } catch {
    return null
  }
}

/**
 * Confirms a client-claimed user id is a real Supabase Auth user, via the
 * Admin API (service-role only). Used only for the /consent 'signup' path:
 * RegisterForm calls /consent immediately after supabase.auth.signUp()
 * resolves, and when email confirmation is required that call can have no
 * session yet (no bearer token to validateUser() against) — this is the
 * fallback that stops an unauthenticated caller from writing a consent_events
 * row against an arbitrary/forged user id.
 */
async function verifyUserExists(env: Env, userId: string): Promise<boolean> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return false
  try {
    const res = await fetch(
      `${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    )
    return res.ok
  } catch {
    return false
  }
}

async function validateAdmin(env: Env, authHeader: string): Promise<boolean> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return false
  const userId = await validateUser(env, authHeader)
  if (!userId) return false

  try {
    const res = await fetch(
      `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    )
    if (!res.ok) return false
    const rows = await res.json() as Array<{ role?: string }>
    return rows[0]?.role === 'admin'
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

function json(obj: unknown, status: number, h: Record<string, string>): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...h, 'Content-Type': 'application/json' } })
}

function getClientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown'
}

async function rateLimitView(env: Env, ip: string, articleSlug: string): Promise<boolean> {
  const minuteBucket = await buildRateLimitBucket('view-minute', ip, articleSlug)
  const hourBucket = await buildRateLimitBucket('view-hour', ip, articleSlug)
  const [minuteAllowed, hourAllowed] = await Promise.all([
    checkIngestionRateLimit({ env, bucketKey: minuteBucket, windowSeconds: 60, maxHits: 3 }),
    checkIngestionRateLimit({ env, bucketKey: hourBucket, windowSeconds: 60 * 60, maxHits: 12 }),
  ])
  return minuteAllowed && hourAllowed
}

async function rateLimitAnalytics(env: Env, ip: string): Promise<boolean> {
  const bucket = await buildRateLimitBucket('analytics', ip)
  return checkIngestionRateLimit({ env, bucketKey: bucket, windowSeconds: 60, maxHits: 90 })
}

async function callSupabaseRpc(env: Env, name: string, body: unknown): Promise<Response> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'supabase_service_role_not_configured' }), { status: 503 })
  }
  return fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Article questions helpers
// ---------------------------------------------------------------------------

async function verifyTurnstile(env: Env, token: string | undefined, req: Request): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return false
  if (!token) return false
  const formData = new FormData()
  formData.append('secret', env.TURNSTILE_SECRET_KEY)
  formData.append('response', token)
  const remoteIp = req.headers.get('CF-Connecting-IP')
  if (remoteIp) formData.append('remoteip', remoteIp)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) return false
  const data = await res.json() as { success?: boolean }
  return data.success === true
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function articleQuestionCors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed = parseOriginList(env.ALLOWED_ORIGIN || 'https://1001sovet.ru')
  return buildCors(origin, allowed, 'POST, GET, OPTIONS', {
    'Access-Control-Allow-Headers': 'content-type',
  })
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

const worker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const h = cors(env)
    if (req.method === 'OPTIONS' && url.pathname.startsWith('/analytics')) {
      return new Response('ok', { headers: analyticsCors(req, env) })
    }
    if (req.method === 'OPTIONS' && url.pathname === '/view') {
      return new Response('ok', {
        headers: restrictedCors(req, env.VIEW_ALLOWED_ORIGINS || env.CONTACT_ALLOWED_ORIGINS, env.ALLOWED_ORIGIN || 'https://1001sovet.ru'),
      })
    }
    if (req.method === 'OPTIONS' && url.pathname.startsWith('/contact')) {
      return new Response('ok', { headers: contactCors(req, env) })
    }
    if (req.method === 'OPTIONS' && (url.pathname === '/consent' || url.pathname.startsWith('/account/'))) {
      return new Response('ok', { headers: accountCors(req, env) })
    }
    if (req.method === 'OPTIONS' && (url.pathname === '/article-question' || url.pathname === '/article-questions' || url.pathname === '/article-comment' || url.pathname === '/article-count')) {
      return new Response('ok', { headers: articleQuestionCors(req, env) })
    }
    if (req.method === 'OPTIONS') return new Response('ok', { headers: h })

    if (url.pathname === '/contact/challenge') {
      const contactHeaders = contactCors(req, env)
      if (!env.CONTACT_FORM_SECRET) return json({ error: 'contact_not_configured' }, 503, contactHeaders)
      return json(await createContactToken(env), 200, contactHeaders)
    }

    if (url.pathname === '/contact') {
      const contactHeaders = contactCors(req, env)
      if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, contactHeaders)

      const ip = getClientIp(req)
      if (!(await rateLimitContact(env, ip))) return json({ error: 'rate_limited' }, 429, contactHeaders)

      const payload = await req.json().catch(() => null) as null | {
        token?: string
        name?: string
        email?: string
        subject?: string
        body?: string
        website?: string
        pdConsent?: boolean
      }
      if (!payload) return json({ error: 'bad_json' }, 400, contactHeaders)
      if (cleanText(payload.website, 200)) return json({ ok: true }, 200, contactHeaders)
      if (!(await validateContactToken(env, cleanText(payload.token, 4096)))) return json({ error: 'bad_challenge' }, 400, contactHeaders)

      const name = cleanText(payload.name, 80)
      const email = cleanText(payload.email, 120).toLowerCase()
      const subject = cleanText(payload.subject, 120)
      const body = String(payload.body || '').trim().slice(0, 4000)

      if (name.length < 2 || subject.length < 4 || body.length < 20) return json({ error: 'too_short' }, 400, contactHeaders)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'bad_email' }, 400, contactHeaders)
      // 152-FZ: PD-processing consent is its own checkbox on the contact form
      // (canon §1.1 — never bundled with sending the message itself). Server
      // enforces this too, not just the UI, since the endpoint is public.
      if (payload.pdConsent !== true) return json({ error: 'consent_required' }, 400, contactHeaders)

      try {
        await sendContactEmail(env, { name, email, subject, body, ip })
      } catch {
        return json({ error: 'email_delivery_failed' }, 502, contactHeaders)
      }
      // Best-effort evidence write: the email has already been sent, so a
      // consent_events insert failure here must not fail the user-visible
      // request (mirrors admin-api's insertAuditEvent "never throws" contract).
      await insertConsentEvent(env, {
        subjectAnonId: await sha256Hex(`contact:${email}:${Date.now()}`),
        purpose: 'pd_processing_general',
        documentVersion: PRIVACY_POLICY_VERSION,
        granted: true,
        method: 'lead_form',
        ip,
        userAgent: req.headers.get('user-agent') || '',
      }).catch(() => {})
      return json({ ok: true }, 200, contactHeaders)
    }

    if (url.pathname === '/consent') {
      const accountHeaders = accountCors(req, env)
      if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, accountHeaders)

      const ip = getClientIp(req)
      if (!(await rateLimitKv(env, 'consent', ip, 20, 60))) return json({ error: 'rate_limited' }, 429, accountHeaders)

      const payload = await req.json().catch(() => null) as null | {
        userId?: string
        purpose?: ConsentPurpose
        granted?: boolean
      }
      if (!payload || !payload.userId || !payload.purpose) return json({ error: 'bad_json' }, 400, accountHeaders)
      if (payload.purpose !== 'terms' && payload.purpose !== 'privacy_policy') {
        return json({ error: 'bad_purpose' }, 400, accountHeaders)
      }

      // The caller (RegisterForm, right after supabase.auth.signUp()) may not
      // have a session yet when email confirmation is required — verify the
      // claimed id is a real user via the Admin API instead of trusting a
      // bearer token that might not exist yet.
      if (!(await verifyUserExists(env, payload.userId))) return json({ error: 'unknown_user' }, 400, accountHeaders)

      const documentVersion = payload.purpose === 'terms' ? TERMS_VERSION : PRIVACY_POLICY_VERSION
      const result = await insertConsentEvent(env, {
        subjectUserId: payload.userId,
        purpose: payload.purpose,
        documentVersion,
        granted: payload.granted !== false,
        method: 'signup' as ConsentMethod,
        ip,
        userAgent: req.headers.get('user-agent') || '',
      })
      if (!result.ok) return json({ error: result.error }, 502, accountHeaders)
      return json({ ok: true }, 200, accountHeaders)
    }

    if (url.pathname === '/account/erasure/request') {
      const accountHeaders = accountCors(req, env)
      if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, accountHeaders)

      const userId = await validateUser(env, req.headers.get('Authorization') || '')
      if (!userId) return json({ error: 'unauthorized' }, 401, accountHeaders)

      const ip = getClientIp(req)
      if (!(await rateLimitKv(env, 'erasure', ip, 5, 3600))) return json({ error: 'rate_limited' }, 429, accountHeaders)

      const payload = await req.json().catch(() => null) as null | { confirm?: boolean }
      if (!payload?.confirm) return json({ error: 'confirmation_required' }, 400, accountHeaders)

      const ipHash = await hashIp(env, ip)
      if (!ipHash) return json({ error: 'not_configured' }, 503, accountHeaders)

      const result = await requestErasure(env, userId, ipHash, req.headers.get('user-agent') || '')
      if (!result.ok) return json({ error: result.error }, 502, accountHeaders)
      return json({ ok: true, request: result.request }, 200, accountHeaders)
    }

    if (url.pathname === '/account/erasure/cancel') {
      const accountHeaders = accountCors(req, env)
      if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, accountHeaders)

      const userId = await validateUser(env, req.headers.get('Authorization') || '')
      if (!userId) return json({ error: 'unauthorized' }, 401, accountHeaders)

      const result = await cancelErasure(env, userId)
      if (!result.ok) return json({ error: result.error }, result.error === 'not_found' ? 404 : 502, accountHeaders)
      return json({ ok: true }, 200, accountHeaders)
    }

    if (url.pathname === '/account/erasure/status') {
      const accountHeaders = accountCors(req, env)
      if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, accountHeaders)

      const userId = await validateUser(env, req.headers.get('Authorization') || '')
      if (!userId) return json({ error: 'unauthorized' }, 401, accountHeaders)

      const result = await getErasureStatus(env, userId)
      if (!result.ok) return json({ error: 'lookup_failed' }, 502, accountHeaders)
      return json({ ok: true, request: result.request }, 200, accountHeaders)
    }

    if (url.pathname === '/analytics/event') {
      const analyticsHeaders = analyticsCors(req, env)
      if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, analyticsHeaders)
      if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'analytics_not_configured' }, 503, analyticsHeaders)

      const ip = getClientIp(req)
      if (!(await rateLimitAnalytics(env, ip))) return json({ error: 'rate_limited' }, 429, analyticsHeaders)

      const payload = await req.json().catch(() => null) as null | Record<string, unknown>
      if (!payload) return json({ error: 'bad_json' }, 400, analyticsHeaders)

      const eventName = cleanText(payload.event_name, 60)
      if (!['page_view_start', 'page_view_end', 'custom'].includes(eventName)) {
        return json({ error: 'bad_event_name' }, 400, analyticsHeaders)
      }

      const pathValue = cleanPath(payload.path)
      const userAgent = req.headers.get('User-Agent') || ''
      const parsedUa = parseUserAgent(userAgent)
      const classification = classifyTraffic(req, { ...payload, event_name: eventName })
      const utm = parseUtm(pathValue)
      const signals = (payload.signals || {}) as Record<string, unknown>
      const cf = (req as unknown as { cf?: { country?: string } }).cf

      // Privacy boundary: the client IP is used only for the hashed durable rate-limit bucket above.
      // Do not add raw IP addresses to eventData or the analytics tables.
      const eventData = {
        event_name: eventName,
        session_id: cleanId(payload.session_id),
        pageview_id: cleanId(payload.pageview_id),
        visitor_id: cleanId(payload.visitor_id),
        path: pathValue,
        title: cleanText(payload.title, 300),
        article_slug: cleanArticleSlug(payload.article_slug),
        category: cleanText(payload.category, 120),
        referrer: cleanText(payload.referrer, 1000),
        referrer_domain: referrerDomain(payload.referrer),
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        country: cleanText(cf?.country, 16),
        device_type: parsedUa.device_type,
        browser: parsedUa.browser,
        os: parsedUa.os,
        language: cleanText(signals.language, 40),
        timezone: cleanText(signals.timezone, 80),
        viewport_width: Number(signals.viewport_width || 0) || null,
        viewport_height: Number(signals.viewport_height || 0) || null,
        duration_seconds: Number(payload.duration_seconds || 0) || 0,
        sequence_index: Number(payload.sequence_index || 0) || 0,
        classification: classification.classification,
        bot_reason: classification.bot_reason,
        payload: {
          scroll_depth: Number(payload.scroll_depth || 0) || 0,
        },
      }

      if (!eventData.session_id || !eventData.visitor_id) return json({ error: 'missing_session' }, 400, analyticsHeaders)

      const res = await callSupabaseRpc(env, 'ingest_analytics_event', { event_data: eventData })
      if (!res.ok) return json({ error: 'analytics_insert_failed' }, 502, analyticsHeaders)
      return json({ ok: true, classification: classification.classification }, 200, analyticsHeaders)
    }

    if (url.pathname === '/analytics/summary') {
      const analyticsHeaders = analyticsCors(req, env)
      if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, analyticsHeaders)
      if (!(await validateAdmin(env, req.headers.get('Authorization') || ''))) {
        return json({ error: 'unauthorized' }, 401, analyticsHeaders)
      }

      const days = Math.max(1, Math.min(Number(url.searchParams.get('days') || 7) || 7, 90))
      const [summaryRes, sessionsRes] = await Promise.all([
        callSupabaseRpc(env, 'admin_analytics_summary', { days_back: days }),
        callSupabaseRpc(env, 'admin_analytics_recent_sessions', { days_back: days, row_limit: 60 }),
      ])
      if (!summaryRes.ok || !sessionsRes.ok) return json({ error: 'analytics_query_failed' }, 502, analyticsHeaders)
      const summary = await summaryRes.json()
      const sessions = await sessionsRes.json()
      return json({ summary, sessions, days }, 200, analyticsHeaders)
    }

    if (url.pathname === '/view') {
      const viewHeaders = restrictedCors(req, env.VIEW_ALLOWED_ORIGINS || env.CONTACT_ALLOWED_ORIGINS, env.ALLOWED_ORIGIN || 'https://1001sovet.ru')
      if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, viewHeaders)
      if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'view_ingestion_not_configured' }, 503, viewHeaders)

      const payload = await req.json().catch(() => null) as null | { article_slug?: string; articleSlug?: string }
      const articleSlug = cleanArticleSlug(payload?.article_slug || payload?.articleSlug)
      if (!articleSlug || articleSlug.length < 3) return json({ error: 'bad_article_slug' }, 400, viewHeaders)

      const ip = getClientIp(req)
      if (!(await rateLimitView(env, ip, articleSlug))) return json({ error: 'rate_limited' }, 429, viewHeaders)

      const res = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/feedback_events`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          article_slug: articleSlug,
          kind: 'view',
          comment: '',
          user_id: null,
        }),
      })

      if (!res.ok) return json({ error: 'view_insert_failed' }, 502, viewHeaders)
      return json({ ok: true }, 200, viewHeaders)
    }

    if (req.method === 'GET' && url.pathname.startsWith('/file/')) {
      const key = decodeURIComponent(url.pathname.slice('/file/'.length))
      const obj = await env.PHOTOS.get(key)
      if (!obj) return new Response('Not found', { status: 404, headers: h })
      const headers = new Headers(h)
      obj.writeHttpMetadata(headers)
      headers.set('etag', obj.httpEtag)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      return new Response(obj.body, { headers })
    }

    if (req.method === 'POST' && url.pathname === '/upload') {
      const uid = await validateUser(env, req.headers.get('Authorization') || '')
      if (!uid) return json({ error: 'unauthorized' }, 401, h)

      const articleSlug = (req.headers.get('x-article-slug') || 'misc').replace(/[^a-z0-9-]/g, '')
      const ext = (req.headers.get('x-file-ext') || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const contentType = req.headers.get('content-type') || 'application/octet-stream'
      if (!ALLOWED_TYPES.includes(contentType)) return json({ error: 'bad_type' }, 415, h)

      const body = await req.arrayBuffer()
      if (body.byteLength === 0) return json({ error: 'empty' }, 400, h)
      if (body.byteLength > MAX_BYTES) return json({ error: 'too_large' }, 413, h)

      const key = `${articleSlug}/${uid}-${Date.now()}.${ext}`
      await env.PHOTOS.put(key, body, { httpMetadata: { contentType } })
      return json({ key }, 200, h)
    }

    // ---------------------------------------------------------------------------
    // Article questions (Q&A flywheel) — public, no auth required.
    // ---------------------------------------------------------------------------

    if (url.pathname === '/article-question') {
      const aqHeaders = articleQuestionCors(req, env)
      if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, aqHeaders)
      if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'article_question_not_configured' }, 503, aqHeaders)

      const payload = await req.json().catch(() => null) as null | {
        article_slug?: string
        question?: string
        turnstileToken?: string
      }
      if (!payload) return json({ error: 'bad_json' }, 400, aqHeaders)

      // Turnstile is progressive: enforced only when a secret is configured.
      // Until a Turnstile widget is provisioned, questions are still protected
      // by the per-IP rate limit below + the pending-moderation gate (nothing is
      // shown publicly until an admin approves). Set TURNSTILE_SECRET_KEY (and
      // NEXT_PUBLIC_TURNSTILE_SITE_KEY on the client) to turn on bot challenge.
      if (env.TURNSTILE_SECRET_KEY && !(await verifyTurnstile(env, payload.turnstileToken, req))) {
        return json({ error: 'turnstile_failed' }, 403, aqHeaders)
      }

      const articleSlug = cleanArticleSlug(payload.article_slug)
      if (!articleSlug || articleSlug.length < 3) return json({ error: 'bad_article_slug' }, 400, aqHeaders)

      const questionRaw = String(payload.question || '').trim()
      if (questionRaw.length < 1 || questionRaw.length > 500) {
        return json({ error: 'bad_question_length' }, 400, aqHeaders)
      }
      // Strip HTML tags (basic regex)
      const question = questionRaw.replace(/<[^>]+>/g, '').trim()
      if (question.length < 1) return json({ error: 'empty_question' }, 400, aqHeaders)

      const ip = getClientIp(req)
      const ipHash = await sha256Hex(ip)

      const [minuteAllowed, hourAllowed] = await Promise.all([
        checkIngestionRateLimit({ env, bucketKey: `article_question:${ipHash}`, windowSeconds: 60, maxHits: 4 }),
        checkIngestionRateLimit({ env, bucketKey: `article_question_hour:${ipHash}`, windowSeconds: 3600, maxHits: 30 }),
      ])
      if (!minuteAllowed || !hourAllowed) {
        return json({ error: 'rate_limited' }, 429, aqHeaders)
      }

      // Persist into the `questions` table — the SAME table the article page
      // and the dynamic renderer read from (status='approved'). The old
      // `article_questions` table was a dead parallel store nothing displayed.
      // Anonymous submission: user_id null, author_name default, pending
      // moderation. A unique question slug powers its /q/<slug>/ page.
      const questionSlug = `q-${[...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('')}`
      const res = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/questions`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          slug: questionSlug,
          article_slug: articleSlug,
          title: question,
          body: '',
          status: 'pending',
          author_name: 'Аноним',
        }),
      })

      if (!res.ok) return json({ error: 'article_question_insert_failed' }, 502, aqHeaders)
      const rows = await res.json().catch(() => null) as null | Array<{ id: string }>
      const id = rows?.[0]?.id
      return json({ success: true, id: id || null }, 200, aqHeaders)
    }

    if (url.pathname === '/article-count') {
      const acHeaders = articleQuestionCors(req, env)
      if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, acHeaders)
      if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'not_configured' }, 503, acHeaders)
      // Count published dynamic articles (content_matrix). Anon can't read the
      // table, so use the service role + a HEAD-style count via Content-Range.
      const res = await fetch(
        `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/content_matrix?select=id&text_status=eq.published`,
        {
          method: 'GET',
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Range-Unit': 'items',
            Range: '0-0',
            Prefer: 'count=exact',
          },
        },
      )
      const range = res.headers.get('content-range') || ''
      const m = range.match(/\/(\d+)$/)
      const published = m ? parseInt(m[1], 10) : 0
      // Cache at the edge for 1h; the number moves slowly.
      return new Response(JSON.stringify({ published }), {
        status: 200,
        headers: { ...acHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
      })
    }

    if (url.pathname === '/article-questions') {
      const aqHeaders = articleQuestionCors(req, env)
      if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, aqHeaders)

      const articleSlug = cleanArticleSlug(url.searchParams.get('article_slug'))
      let selectUrl = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/article_questions?status=eq.approved&select=id,article_slug,question,answer,created_at&order=created_at.desc`
      if (articleSlug && articleSlug.length >= 3) {
        selectUrl += `&article_slug=eq.${encodeURIComponent(articleSlug)}`
      }

      const res = await fetch(selectUrl, {
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) return json({ error: 'article_questions_query_failed' }, 502, aqHeaders)
      const rows = await res.json().catch(() => []) as Array<{
        id: string
        article_slug: string
        question: string
        answer: string | null
        created_at: string
      }>

      return json({ questions: rows }, 200, aqHeaders)
    }

    // ---------------------------------------------------------------------------
    // Article comments — public anonymous submit (moderated). Same CORS/Turnstile/
    // rate-limit pattern as /article-question. Inserts via service_role so no
    // anon INSERT RLS policy is required. is_approved=false until a moderator
    // approves; the renderer only reads approved rows.
    // ---------------------------------------------------------------------------

    if (url.pathname === '/article-comment') {
      const acHeaders = articleQuestionCors(req, env)
      if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, acHeaders)
      if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'article_comment_not_configured' }, 503, acHeaders)

      const payload = await req.json().catch(() => null) as null | {
        article_slug?: string
        content?: string
        turnstileToken?: string
      }
      if (!payload) return json({ error: 'bad_json' }, 400, acHeaders)

      // Turnstile is progressive: enforced only when a secret is configured.
      if (env.TURNSTILE_SECRET_KEY && !(await verifyTurnstile(env, payload.turnstileToken, req))) {
        return json({ error: 'turnstile_failed' }, 403, acHeaders)
      }

      const articleSlug = cleanArticleSlug(payload.article_slug)
      if (!articleSlug || articleSlug.length < 3) return json({ error: 'bad_article_slug' }, 400, acHeaders)

      const contentRaw = String(payload.content || '').trim()
      if (contentRaw.length < 1 || contentRaw.length > 2000) {
        return json({ error: 'bad_content_length' }, 400, acHeaders)
      }
      // Strip HTML tags (basic regex)
      const content = contentRaw.replace(/<[^>]+>/g, '').trim()
      if (content.length < 1) return json({ error: 'empty_content' }, 400, acHeaders)

      const ip = getClientIp(req)
      const ipHash = await sha256Hex(ip)

      const [minuteAllowed, hourAllowed] = await Promise.all([
        checkIngestionRateLimit({ env, bucketKey: `article_comment:${ipHash}`, windowSeconds: 60, maxHits: 4 }),
        checkIngestionRateLimit({ env, bucketKey: `article_comment_hour:${ipHash}`, windowSeconds: 3600, maxHits: 30 }),
      ])
      if (!minuteAllowed || !hourAllowed) {
        return json({ error: 'rate_limited' }, 429, acHeaders)
      }

      // Anonymous submission: user_id null, author_name default, pending
      // moderation (is_approved=false). No parent_id (top-level only).
      const res = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/comments`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          article_slug: articleSlug,
          content,
          author_name: 'Аноним',
          is_approved: false,
          user_id: null,
          parent_id: null,
        }),
      })

      if (!res.ok) return json({ error: 'article_comment_insert_failed' }, 502, acHeaders)
      const rows = await res.json().catch(() => null) as null | Array<{ id: string }>
      const id = rows?.[0]?.id
      return json({ success: true, id: id || null }, 200, acHeaders)
    }

    return new Response('Not found', { status: 404, headers: h })
  },

  // 152-FZ retention job (canon §1.3). Finalizes erasure_requests whose
  // grace period has elapsed — see erasure.ts's finalizeErasureRequests for
  // the anonymize step. Cron schedule lives in wrangler.toml's [triggers].
  //
  // Scope note: canon §1.3 also asks for purging stale non-account lead/
  // contact-form PD. This site's /contact route never persists submissions
  // to Postgres — it only relays an email via Resend/EMAIL — so there is no
  // lead-storage table to sweep here (see the contact-form audit finding).
  // TODO(152-FZ canon §1.3): if a lead-persistence table is ever added for
  // /contact, wire its purge into this same scheduled() handler rather than
  // creating a new PD store with no retention job from day one.
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const summary = await finalizeErasureRequests(env)
    if (summary.failed > 0) {
      console.error(`[retention] erasure finalize: ${summary.completed}/${summary.processed} completed, ${summary.failed} failed`)
    }
  },
}

export default worker
