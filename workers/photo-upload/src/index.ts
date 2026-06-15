import { buildRateLimitBucket, checkIngestionRateLimit } from './rate-limit'
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
      if (!rateLimitContact(ip)) return json({ error: 'rate_limited' }, 429, contactHeaders)

      const payload = await req.json().catch(() => null) as null | {
        token?: string
        name?: string
        email?: string
        subject?: string
        body?: string
        website?: string
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

      try {
        await sendContactEmail(env, { name, email, subject, body, ip })
      } catch {
        return json({ error: 'email_delivery_failed' }, 502, contactHeaders)
      }
      return json({ ok: true }, 200, contactHeaders)
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

    return new Response('Not found', { status: 404, headers: h })
  },
}

export default worker
