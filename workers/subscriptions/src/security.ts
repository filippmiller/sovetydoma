import type { Env } from './types'

function base64Url(bytes: Uint8Array): string {
  let raw = ''
  for (const byte of bytes) raw += String.fromCharCode(byte)
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function hexToBytes(value: string): Uint8Array {
  const clean = value.trim().replace(/^sha256=/i, '')
  const bytes = new Uint8Array(Math.floor(clean.length / 2))
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', utf8(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, utf8(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function hmacSha256Base64(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, utf8(value))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

export function createSecureToken(prefix: string): string {
  const tokenBytes = new Uint8Array(32)
  crypto.getRandomValues(tokenBytes)
  return `${prefix}_${base64Url(tokenBytes)}`
}

export function timingSafeEqual(a: string, b: string): boolean {
  const left = utf8(a)
  const right = utf8(b)
  if (left.length !== right.length) return false

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index]
  }
  return diff === 0
}

export function timingSafeEqualBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index]
  }
  return diff === 0
}

export function requireSecret(value: string | undefined, name: string): string {
  const secret = String(value || '').trim()
  if (!secret) throw new Error(`${name}_not_configured`)
  return secret
}

export async function createSignedContactToken(env: Env, contactId: string): Promise<string> {
  const secret = requireSecret(env.UNSUBSCRIBE_TOKEN_SECRET, 'unsubscribe_token_secret')
  const signature = await hmacSha256Hex(secret, contactId)
  return `contact_${contactId}_${signature}`
}

export async function verifySignedContactToken(env: Env, token: string): Promise<string | null> {
  const match = /^contact_([0-9a-fA-F-]{36})_([0-9a-f]{64})$/.exec(token)
  if (!match) return null
  const contactId = match[1]
  const expected = await createSignedContactToken(env, contactId)
  return timingSafeEqual(expected, token) ? contactId : null
}

export async function verifyWhatsAppSignature(secret: string, rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false
  const expected = await hmacSha256Hex(secret, rawBody)
  return timingSafeEqualBytes(hexToBytes(expected), hexToBytes(signatureHeader))
}

export async function verifySvixSignature(secret: string, rawBody: string, headers: Headers): Promise<boolean> {
  const id = headers.get('svix-id') || ''
  const timestamp = headers.get('svix-timestamp') || ''
  const signatures = (headers.get('svix-signature') || '').split(',').map((part) => part.trim()).filter(Boolean)
  if (!id || !timestamp || signatures.length === 0) return false

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(ageSeconds) || ageSeconds > 5 * 60) return false

  const signingSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret
  const secretBytes = Uint8Array.from(atob(signingSecret), (char) => char.charCodeAt(0))
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, utf8(`${id}.${timestamp}.${rawBody}`))
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))

  return signatures.some((signature) => {
    const value = signature.includes(',') ? signature : signature.replace(/^v\d+,/, '')
    const candidate = value.includes('=') ? value.split('=').pop() || '' : value
    return timingSafeEqual(expected, candidate)
  })
}
