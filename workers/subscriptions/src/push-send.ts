import type { Env } from './types'

// ──────────────────────────────────────────
//  VAPID JWT signing + ECE payload encryption
//  for Cloudflare Workers (crypto.subtle only)
// ──────────────────────────────────────────

const VAPID_EXPIRY_SECONDS = 12 * 60 * 60 // 12h

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function base64Url(bytes: Uint8Array): string {
  let raw = ''
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i])
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function uint32BE(value: number): Uint8Array {
  const arr = new Uint8Array(4)
  arr[0] = (value >>> 24) & 0xff
  arr[1] = (value >>> 16) & 0xff
  arr[2] = (value >>> 8) & 0xff
  arr[3] = value & 0xff
  return arr
}

function newU8(len: number): Uint8Array {
  return new Uint8Array(len)
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0)
  const result = newU8(total)
  let offset = 0
  for (const a of arrays) {
    result.set(a, offset)
    offset += a.length
  }
  return result
}

function u8(buf: ArrayBuffer | ArrayBufferView): Uint8Array {
  return new Uint8Array(buf as ArrayBuffer)
}

function u8from(signed: ArrayBuffer): Uint8Array {
  return new Uint8Array(signed)
}

// ── VAPID JWT ──

async function importVapidPrivateKey(env: Env): Promise<CryptoKey> {
  const raw = String(env.VAPID_PRIVATE_KEY || '').trim()
  if (!raw) throw new Error('vapid_private_key_not_configured')
  const keyBytes = base64UrlToUint8Array(raw)
  return crypto.subtle.importKey('pkcs8', keyBytes as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

function base64UrlToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function signVapidJWT(env: Env, endpoint: string): Promise<string> {
  const endpointUrl = new URL(endpoint)
  const aud = `${endpointUrl.protocol}//${endpointUrl.host}`
  const exp = Math.floor(Date.now() / 1000) + VAPID_EXPIRY_SECONDS
  const sub = String(env.VAPID_SUBJECT || 'mailto:admin@1001sovet.ru').trim()

  const header = base64Url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = base64Url(utf8(JSON.stringify({ aud, exp, sub })))
  const signingInput = utf8(`${header}.${payload}`)

  const key = await importVapidPrivateKey(env)
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, signingInput as BufferSource)
  const sig = base64Url(u8from(signature))
  return `${header}.${payload}.${sig}`
}

// ── ECE aes128gcm encryption (RFC 8188 / RFC 8291) ──

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const prk = await crypto.subtle.sign('HMAC', key, salt as BufferSource)
  return u8from(prk)
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', prk as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const iterations = Math.ceil(length / 32)
  let output = newU8(0)
  let previous = newU8(0)
  for (let i = 1; i <= iterations; i++) {
    const input = concat([previous, info, newU8(1).fill(i)])
    const signed = await crypto.subtle.sign('HMAC', key, input as BufferSource)
    previous = u8from(signed)
    output = concat([output, previous])
  }
  return output.slice(0, length)
}

async function deriveKeys(
  sharedSecret: Uint8Array,
  auth: Uint8Array,
  clientPublicKey: Uint8Array,
  serverPublicKey: Uint8Array,
): Promise<{ cek: Uint8Array; nonce: Uint8Array }> {
  const prk = await hkdfExtract(auth, sharedSecret)
  const cekInfo = concat([utf8('Content-Encoding: aes128gcm\0'), clientPublicKey, serverPublicKey])
  const nonceInfo = concat([utf8('Content-Encoding: nonce\0'), clientPublicKey, serverPublicKey])
  const cek = await hkdfExpand(prk, cekInfo, 16)
  const nonce = await hkdfExpand(prk, nonceInfo, 12)
  return { cek, nonce }
}

async function encryptPushPayload(
  payload: string,
  clientPublicKey: Uint8Array,
  auth: Uint8Array,
): Promise<{ body: Uint8Array; serverPublicKey: Uint8Array }> {
  // Generate ephemeral P-256 key pair
  const serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey as CryptoKey)
  const serverPublicKey = u8from(serverPublicKeyRaw)

  // Import client public key
  const clientPublicKeyImported = await crypto.subtle.importKey(
    'raw',
    clientPublicKey as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )

  // Derive shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKeyImported },
    serverKeyPair.privateKey as CryptoKey,
    256,
  )
  const sharedSecret = u8from(sharedSecretBits)

  const { cek, nonce } = await deriveKeys(sharedSecret, auth, clientPublicKey, serverPublicKey)

  // Encrypt with AES-128-GCM
  const cekKey = await crypto.subtle.importKey('raw', cek as BufferSource, { name: 'AES-GCM' }, false, ['encrypt'])
  const plaintext = utf8(payload)
  // Add padding: minimal padding (1 byte 0x00 for no padding except the mandatory padding byte)
  const padding = new Uint8Array([0x00])
  const plaintextWithPadding = concat([padding, plaintext])
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource, additionalData: new Uint8Array(0) as BufferSource }, cekKey, plaintextWithPadding as BufferSource)

  // Build aes128gcm header: salt(16) + rs(4) + keyid_len(1) + keyid + ciphertext
  const recordSize = uint32BE(4096)
  const keyidLen = new Uint8Array([serverPublicKey.length])
  const body = concat([salt, recordSize, keyidLen, serverPublicKey, u8(ciphertext)])

  return { body, serverPublicKey }
}

// ── Public send function ──

export async function sendWebPush(
  env: Env,
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; icon: string; url: string; tag: string },
): Promise<{ ok: boolean; status: number; removed?: boolean }> {
  const jwt = await signVapidJWT(env, subscription.endpoint)
  const vapidPublicKey = String(env.VAPID_PUBLIC_KEY || '').trim()
  if (!vapidPublicKey) throw new Error('vapid_public_key_not_configured')

  const clientPublicKey = base64UrlToUint8Array(subscription.p256dh)
  const auth = base64UrlToUint8Array(subscription.auth)

  const payloadString = JSON.stringify(payload)
  const { body } = await encryptPushPayload(payloadString, clientPublicKey, auth)

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `WebPush ${jwt}`,
      'Crypto-Key': `p256ecdsa=${vapidPublicKey}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
    },
    body: body as unknown as BodyInit,
  })

  const removed = res.status === 404 || res.status === 410
  return { ok: res.ok, status: res.status, removed }
}
