import { EmailMessage } from 'cloudflare:email'

// ---------------------------------------------------------------------------
// Contact-form helpers extracted from index.ts.
// Owns: token create/validate, MIME construction, email dispatch.
// ---------------------------------------------------------------------------

const CONTACT_TO_EMAIL_DEFAULT = 'alexmiller.idothings@gmail.com'
const CONTACT_FROM_EMAIL_DEFAULT = 'noreply@vsedomatut.com'
export const CONTACT_MIN_SECONDS = 3
export const CONTACT_MAX_SECONDS = 30 * 60

interface ContactEnv {
  CONTACT_FORM_SECRET: string
  CONTACT_TO_EMAIL?: string
  CONTACT_FROM_EMAIL?: string
  EMAIL?: {
    send(message: EmailMessage): Promise<unknown>
  }
  RESEND_API_KEY?: string
  /** Cloudflare Workers KV namespace for persistent rate-limit counters.
   *  Optional: if absent (e.g. in unit tests), rate limiting is skipped
   *  (fail-open) so tests pass without a real KV namespace. */
  RATE_LIMIT_KV?: KVNamespace
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

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

/** Constant-time string compare to avoid leaking match progress via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const left = enc.encode(a)
  const right = enc.encode(b)
  const len = Math.max(left.length, right.length)
  let diff = left.length ^ right.length
  for (let i = 0; i < len; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0)
  }
  return diff === 0
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

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export async function createContactToken(env: ContactEnv): Promise<{ token: string; expiresAt: number }> {
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

export async function validateContactToken(env: ContactEnv, token: string): Promise<boolean> {
  if (!env.CONTACT_FORM_SECRET || !token.includes('.')) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  const expected = await sign(env.CONTACT_FORM_SECRET, payload)
  if (!timingSafeEqual(expected, signature)) return false

  try {
    const data = JSON.parse(fromBase64Url(payload)) as { iat?: number }
    const age = Math.floor(Date.now() / 1000) - Number(data.iat || 0)
    return age >= CONTACT_MIN_SECONDS && age <= CONTACT_MAX_SECONDS
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Contact-form rate limit — thresholds (preserved from previous in-memory impl)
// ---------------------------------------------------------------------------
const CONTACT_RATE_PER_MINUTE = 2  // max submissions per IP per 60-second window
const CONTACT_RATE_PER_HOUR = 6    // max submissions per IP per 60-minute window

/**
 * Persistent KV-backed rate limiter for the contact form.
 *
 * Uses two counters per IP:
 *   contact-rl:<ip>:min  — incremented every submission, TTL = 60 s
 *   contact-rl:<ip>:hr   — incremented every submission, TTL = 3600 s
 *
 * Returns true  → request is allowed (counters updated).
 * Returns false → rate limit exceeded (request should be rejected with 429).
 *
 * Fail-open: if RATE_LIMIT_KV is absent or throws, the call is ALLOWED so a
 * transient KV outage does not make the contact form unusable.  This matches
 * the previous in-memory behavior (a fresh isolate with no stored state always
 * allowed the first N requests).
 */
export async function rateLimitContact(env: ContactEnv, ip: string): Promise<boolean> {
  const kv = env.RATE_LIMIT_KV
  if (!kv) {
    // No KV binding present (e.g. unit-test environment) — skip limiting.
    return true
  }

  const safeIp = ip.replace(/[^a-zA-Z0-9.:_-]/g, '_').slice(0, 64)
  const minKey = `contact-rl:${safeIp}:min`
  const hrKey  = `contact-rl:${safeIp}:hr`

  try {
    const [minStr, hrStr] = await Promise.all([
      kv.get(minKey),
      kv.get(hrKey),
    ])

    const minCount = Number(minStr ?? '0')
    const hrCount  = Number(hrStr  ?? '0')

    if (minCount >= CONTACT_RATE_PER_MINUTE || hrCount >= CONTACT_RATE_PER_HOUR) {
      return false
    }

    // Increment both counters.  TTL ensures they auto-expire with the window.
    await Promise.all([
      kv.put(minKey, String(minCount + 1), { expirationTtl: 60 }),
      kv.put(hrKey,  String(hrCount  + 1), { expirationTtl: 60 * 60 }),
    ])

    return true
  } catch (err) {
    // Fail-open: log and allow so a KV hiccup doesn't break the contact form.
    console.error('[rateLimitContact] KV error — failing open:', err)
    return true
  }
}

export function buildMimeMessage(data: {
  from: string
  to: string
  replyTo: string
  subject: string
  text: string
  html: string
}): string {
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

export async function sendContactEmail(
  env: ContactEnv,
  data: { name: string; email: string; subject: string; body: string; ip: string },
): Promise<void> {
  const to = env.CONTACT_TO_EMAIL || CONTACT_TO_EMAIL_DEFAULT
  const from = env.CONTACT_FROM_EMAIL || CONTACT_FROM_EMAIL_DEFAULT
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
    await env.EMAIL.send(
      new EmailMessage(from, to, buildMimeMessage({ from: `SovetyDoma <${from}>`, to, replyTo: data.email, subject, text, html })),
    )
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
