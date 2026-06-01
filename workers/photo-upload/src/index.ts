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
  ALLOWED_ORIGIN: string
  CONTACT_ALLOWED_ORIGINS?: string
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
