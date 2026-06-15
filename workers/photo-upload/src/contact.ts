import { EmailMessage } from 'cloudflare:email'

// ---------------------------------------------------------------------------
// Contact-form helpers extracted from index.ts.
// Owns: token create/validate, MIME construction, email dispatch.
// ---------------------------------------------------------------------------

const CONTACT_TO_EMAIL_DEFAULT = 'alexmiller.idothings@gmail.com'
const CONTACT_FROM_EMAIL_DEFAULT = 'noreply@vsedomatut.com'
export const CONTACT_MIN_SECONDS = 3
export const CONTACT_MAX_SECONDS = 30 * 60

// In-process rate-limit map (survives for the Worker instance lifetime).
export const contactHits = new Map<string, number[]>()

interface ContactEnv {
  CONTACT_FORM_SECRET: string
  CONTACT_TO_EMAIL?: string
  CONTACT_FROM_EMAIL?: string
  EMAIL?: {
    send(message: EmailMessage): Promise<unknown>
  }
  RESEND_API_KEY?: string
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

export function rateLimitContact(ip: string): boolean {
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
