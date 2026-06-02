import { EmailMessage } from 'cloudflare:email'

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
    send(message: EmailMessage): Promise<unknown>
  }
  RESEND_API_KEY?: string
}

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const CONTACT_TO_EMAIL = 'alexmiller.idothings@gmail.com'
const CONTACT_FROM_EMAIL = 'noreply@vsedomatut.com'
const CONTACT_MIN_SECONDS = 3
const CONTACT_MAX_SECONDS = 30 * 60
const contactHits = new Map<string, number[]>()
const viewHits = new Map<string, number[]>()
const analyticsHits = new Map<string, number[]>()

function cors(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-article-slug, x-file-ext',
  }
}

function contactCors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed = (env.CONTACT_ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || 'https://1001sovet.ru')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const allowOrigin = allowed.includes('*') || allowed.includes(origin) ? origin || allowed[0] : allowed[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  }
}

function restrictedCors(req: Request, allowedValue: string | undefined, fallback: string): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed = (allowedValue || fallback)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const allowOrigin = allowed.includes('*') || allowed.includes(origin) ? origin || allowed[0] : allowed[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  }
}

function analyticsCors(req: Request, env: Env): Record<string, string> {
  const headers = restrictedCors(req, env.VIEW_ALLOWED_ORIGINS || env.CONTACT_ALLOWED_ORIGINS, env.ALLOWED_ORIGIN || 'https://1001sovet.ru')
  return {
    ...headers,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }
}

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
    const res = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })
    if (!res.ok) return false
    const rows = await res.json() as Array<{ role?: string }>
    return rows[0]?.role === 'admin'
  } catch {
    return false
  }
}

function json(obj: unknown, status: number, h: Record<string, string>): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...h, 'Content-Type': 'application/json' } })
}

function base64Url(bytes: Uint8Array): string {
  let raw = ''
  for (const byte of bytes) raw += String.fromCharCode(byte)
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlText(value: string): string {
  return base64Url(new TextEncoder().encode(value))
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const raw = atob(normalized)
  return new TextDecoder().decode(Uint8Array.from(raw, (char) => char.charCodeAt(0)))
}

async function sign(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))))
}

async function createContactToken(env: Env): Promise<{ token: string; expiresAt: number }> {
  const issuedAt = Math.floor(Date.now() / 1000)
  const payload = base64UrlText(JSON.stringify({
    iat: issuedAt,
    nonce: crypto.randomUUID(),
  }))
  return {
    token: `${payload}.${await sign(env.CONTACT_FORM_SECRET, payload)}`,
    expiresAt: (issuedAt + CONTACT_MAX_SECONDS) * 1000,
  }
}

async function validateContactToken(env: Env, token: string): Promise<boolean> {
  if (!env.CONTACT_FORM_SECRET || !token.includes('.')) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  const expected = await sign(env.CONTACT_FORM_SECRET, payload)
  if (expected !== signature) return false

  try {
    const data = JSON.parse(fromBase64Url(payload)) as { iat?: number }
    const age = Math.floor(Date.now() / 1000) - Number(data.iat || 0)
    return age >= CONTACT_MIN_SECONDS && age <= CONTACT_MAX_SECONDS
  } catch {
    return false
  }
}

function getClientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown'
}

function rateLimitContact(ip: string): boolean {
  const now = Date.now()
  const recent = (contactHits.get(ip) || []).filter((time) => now - time < 60 * 60 * 1000)
  const perMinute = recent.filter((time) => now - time < 60 * 1000).length
  if (perMinute >= 2 || recent.length >= 6) {
    contactHits.set(ip, recent)
    return false
  }
  recent.push(now)
  contactHits.set(ip, recent)
  return true
}

function rateLimitView(ip: string, articleSlug: string): boolean {
  const now = Date.now()
  const key = `${ip}:${articleSlug}`
  const recent = (viewHits.get(key) || []).filter((time) => now - time < 60 * 60 * 1000)
  const perMinute = recent.filter((time) => now - time < 60 * 1000).length
  if (perMinute >= 3 || recent.length >= 12) {
    viewHits.set(key, recent)
    return false
  }
  recent.push(now)
  viewHits.set(key, recent)
  return true
}

function rateLimitAnalytics(ip: string): boolean {
  const now = Date.now()
  const recent = (analyticsHits.get(ip) || []).filter((time) => now - time < 60 * 1000)
  if (recent.length >= 90) {
    analyticsHits.set(ip, recent)
    return false
  }
  recent.push(now)
  analyticsHits.set(ip, recent)
  return true
}

function cleanArticleSlug(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 120)
}

function cleanId(value: unknown, maxLength = 80): string {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLength)
}

function cleanPath(value: unknown): string {
  const path = String(value || '/').trim().slice(0, 500)
  if (!path.startsWith('/')) return '/'
  return path.replace(/[\r\n]/g, '')
}

function referrerDomain(value: unknown): string {
  try {
    const referrer = String(value || '').trim()
    if (!referrer) return ''
    return new URL(referrer).hostname.replace(/^www\./, '').slice(0, 200)
  } catch {
    return ''
  }
}

function parseUtm(pathValue: string): { utm_source: string; utm_medium: string; utm_campaign: string } {
  try {
    const url = new URL(pathValue, 'https://1001sovet.ru')
    return {
      utm_source: cleanText(url.searchParams.get('utm_source'), 120),
      utm_medium: cleanText(url.searchParams.get('utm_medium'), 120),
      utm_campaign: cleanText(url.searchParams.get('utm_campaign'), 200),
    }
  } catch {
    return { utm_source: '', utm_medium: '', utm_campaign: '' }
  }
}

function parseUserAgent(userAgent: string): { device_type: string; browser: string; os: string } {
  const ua = userAgent.toLowerCase()
  const device_type = /mobile|android|iphone|ipod/.test(ua) ? 'mobile' : /ipad|tablet/.test(ua) ? 'tablet' : 'desktop'
  const browser = /edg\//.test(ua) ? 'Edge'
    : /opr\//.test(ua) ? 'Opera'
      : /chrome\//.test(ua) ? 'Chrome'
        : /firefox\//.test(ua) ? 'Firefox'
          : /safari\//.test(ua) ? 'Safari'
            : 'Other'
  const os = /windows/.test(ua) ? 'Windows'
    : /android/.test(ua) ? 'Android'
      : /iphone|ipad|ipod/.test(ua) ? 'iOS'
        : /mac os|macintosh/.test(ua) ? 'macOS'
          : /linux/.test(ua) ? 'Linux'
            : 'Other'
  return { device_type, browser, os }
}

function classifyTraffic(req: Request, payload: Record<string, unknown>): { classification: string; bot_reason: string } {
  const ua = req.headers.get('User-Agent') || ''
  const lower = ua.toLowerCase()
  const cf = (req as unknown as { cf?: { botManagement?: { verifiedBot?: boolean; score?: number }; clientTcpRtt?: number } }).cf
  const signals = (payload.signals || {}) as Record<string, unknown>

  if (cf?.botManagement?.verifiedBot) return { classification: 'bot', bot_reason: 'cloudflare_verified_bot' }
  if (typeof cf?.botManagement?.score === 'number' && cf.botManagement.score < 20) {
    return { classification: 'bot', bot_reason: 'cloudflare_low_score' }
  }
  if (/bot|crawler|spider|slurp|yandex|googlebot|bingbot|duckduckbot|baiduspider|ahrefs|semrush|mj12bot|dotbot|bytespider|curl|wget|python|headless|phantom|puppeteer|playwright/.test(lower)) {
    return { classification: 'bot', bot_reason: 'user_agent' }
  }
  if (signals.webdriver === true) return { classification: 'bot', bot_reason: 'webdriver' }

  const hasHumanSignals = Boolean(signals.language) && Boolean(signals.timezone) && Number(signals.viewport_width || 0) > 0
  if (payload.event_name === 'page_view_end' && Number(payload.duration_seconds || 0) >= 5 && hasHumanSignals) {
    return { classification: 'human', bot_reason: '' }
  }
  if (hasHumanSignals) return { classification: 'likely_human', bot_reason: '' }
  return { classification: 'unknown', bot_reason: '' }
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function foldHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function buildMimeMessage(data: { from: string; to: string; replyTo: string; subject: string; text: string; html: string }): string {
  const boundary = `sovetydoma-${crypto.randomUUID()}`
  return [
    `From: ${foldHeader(data.from)}`,
    `To: ${foldHeader(data.to)}`,
    `Reply-To: ${foldHeader(data.replyTo)}`,
    `Subject: ${foldHeader(data.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    data.text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    data.html,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

async function sendContactEmail(env: Env, data: { name: string; email: string; subject: string; body: string; ip: string }): Promise<void> {
  const to = env.CONTACT_TO_EMAIL || CONTACT_TO_EMAIL
  const from = env.CONTACT_FROM_EMAIL || CONTACT_FROM_EMAIL
  const subject = `[1001sovet] ${data.subject}`
  const text = [
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `IP: ${data.ip}`,
    '',
    data.body,
  ].join('\n')
  const html = `
    <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
    <p><strong>IP:</strong> ${escapeHtml(data.ip)}</p>
    <hr>
    <p>${escapeHtml(data.body).replace(/\n/g, '<br>')}</p>
  `

  if (env.EMAIL?.send) {
    await env.EMAIL.send(new EmailMessage(from, to, buildMimeMessage({ from: `SovetyDoma <${from}>`, to, replyTo: data.email, subject, text, html })))
    return
  }

  if (env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `СоветыДома <${from}>`,
        to,
        subject,
        text,
        html,
        reply_to: data.email,
      }),
    })
    if (!res.ok) throw new Error(`resend_${res.status}`)
    return
  }

  throw new Error('email_not_configured')
}

const worker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const h = cors(env)
    if (req.method === 'OPTIONS' && url.pathname.startsWith('/analytics')) {
      return new Response('ok', { headers: analyticsCors(req, env) })
    }
    if (req.method === 'OPTIONS' && url.pathname === '/view') {
      return new Response('ok', { headers: restrictedCors(req, env.VIEW_ALLOWED_ORIGINS || env.CONTACT_ALLOWED_ORIGINS, env.ALLOWED_ORIGIN || 'https://1001sovet.ru') })
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
      if (!rateLimitAnalytics(ip)) return json({ error: 'rate_limited' }, 429, analyticsHeaders)

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
      if (!rateLimitView(ip, articleSlug)) return json({ error: 'rate_limited' }, 429, viewHeaders)

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
