/**
 * consent_events writer (152-FZ compliance — canon §1.1/§2 at
 * D:/DEV/CRM-INVITE/COMPLIANCE_152FZ_CANON.md).
 *
 * Append-only by construction: this module only ever POSTs new rows to
 * public.consent_events, never PATCH/PUT/DELETE. Immutability of existing
 * rows is additionally enforced at the DB level — anon/authenticated have no
 * UPDATE grant on the table (see supabase/migrations/202608181200_consent_events.sql).
 *
 * ip_hash follows the same HMAC-SHA256(secret, ip) pattern already used by
 * workers/subscriptions/src/index.ts's hashPii() — sha256(ip + server-side
 * pepper), never the raw IP (canon §1.1 IP-handling rule).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ConsentPurpose = 'terms' | 'privacy_policy' | 'pd_processing_general' | 'marketing'
export type ConsentMethod = 'signup' | 'lead_form' | 'settings' | 're_accept' | 'continued_use'

export interface ConsentEnv {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  PII_HASH_SECRET?: string
}

export interface ConsentEventInput {
  subjectUserId?: string | null
  subjectAnonId?: string | null
  purpose: ConsentPurpose
  documentVersion: string
  granted: boolean
  method: ConsentMethod
  ip: string
  userAgent: string
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Fail closed: without a pepper we refuse to hash (and the caller refuses to insert) rather than fall back to a weak/no-op hash. */
export async function hashIp(env: ConsentEnv, ip: string): Promise<string | null> {
  const secret = String(env.PII_HASH_SECRET || '').trim()
  if (!secret) return null
  return hmacSha256Hex(secret, ip || 'unknown')
}

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export type InsertConsentResult =
  | { ok: true }
  | { ok: false; error: 'not_configured' | 'bad_subject' | 'insert_failed' }

/**
 * Inserts one consent_events row. subjectUserId, when provided, must be a
 * syntactically valid UUID; the caller (index.ts routes) is responsible for
 * deciding whether an unauthenticated subjectUserId claim needs an extra
 * existence check (see verifyUserExists in erasure.ts) before calling this.
 */
export async function insertConsentEvent(
  env: ConsentEnv,
  input: ConsentEventInput,
  fetcher: Fetcher = fetch,
): Promise<InsertConsentResult> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: 'not_configured' }
  if (input.subjectUserId && !isValidUuid(input.subjectUserId)) return { ok: false, error: 'bad_subject' }
  if (!input.subjectUserId && !input.subjectAnonId) return { ok: false, error: 'bad_subject' }

  const ipHash = await hashIp(env, input.ip)
  if (!ipHash) return { ok: false, error: 'not_configured' }

  try {
    const res = await fetcher(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/consent_events`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        subject_user_id: input.subjectUserId || null,
        subject_anon_id: input.subjectAnonId || null,
        purpose: input.purpose,
        document_version: input.documentVersion,
        granted: input.granted,
        method: input.method,
        ip_hash: ipHash,
        user_agent: input.userAgent.slice(0, 500),
      }),
    })
    if (!res.ok) return { ok: false, error: 'insert_failed' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'insert_failed' }
  }
}
