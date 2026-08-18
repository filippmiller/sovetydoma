/**
 * Browser-side client for the 152-FZ compliance routes added to the
 * photo-upload Worker (consent evidence + self-service erasure). See
 * D:/DEV/CRM-INVITE/COMPLIANCE_152FZ_CANON.md and
 * workers/photo-upload/src/{consent,erasure}.ts.
 */
import { getSupabase } from '@/lib/supabase'

// Same env-var fallback chain already used by src/lib/photos.ts and
// src/components/ContactDeveloperForm.tsx for this worker's base URL.
const WORKER_URL = (
  process.env.NEXT_PUBLIC_PHOTO_WORKER_URL
  || process.env.NEXT_PUBLIC_CONTACT_WORKER_URL
  || 'https://sovetydoma-photo-upload.filippmiller.workers.dev'
).replace(/\/+$/, '')

export type ConsentPurpose = 'terms' | 'privacy_policy'

/** Fire-and-forget by design: called right after supabase.auth.signUp() resolves, when there may be no session yet (email confirmation pending). Failures are logged, never surfaced as a registration error — matches the existing best-effort audit-write convention in this codebase. */
export async function submitSignupConsent(userId: string, purpose: ConsentPurpose): Promise<void> {
  try {
    const res = await fetch(`${WORKER_URL}/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, purpose, granted: true }),
    })
    if (!res.ok) console.error(`[privacy-worker-client] consent write failed for purpose=${purpose}`, res.status)
  } catch (err) {
    console.error(`[privacy-worker-client] consent write threw for purpose=${purpose}`, err)
  }
}

export interface ErasureRequestState {
  id: string
  status: 'pending' | 'completed' | 'cancelled'
  requestedAt: string
  gracePeriodEndsAt: string
}

async function authHeader(): Promise<Record<string, string> | null> {
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) return null
  return { Authorization: `Bearer ${token}` }
}

export async function getErasureStatus(): Promise<{ ok: true; request: ErasureRequestState | null } | { ok: false; error: string }> {
  const headers = await authHeader()
  if (!headers) return { ok: false, error: 'not_authenticated' }
  try {
    const res = await fetch(`${WORKER_URL}/account/erasure/status`, { headers })
    const data = await res.json().catch(() => null) as null | { ok?: boolean; request?: unknown; error?: string }
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error || 'request_failed' }
    return { ok: true, request: normalizeRequest(data.request) }
  } catch {
    return { ok: false, error: 'request_failed' }
  }
}

export async function requestErasure(): Promise<{ ok: true; request: ErasureRequestState | null } | { ok: false; error: string }> {
  const headers = await authHeader()
  if (!headers) return { ok: false, error: 'not_authenticated' }
  try {
    const res = await fetch(`${WORKER_URL}/account/erasure/request`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    })
    const data = await res.json().catch(() => null) as null | { ok?: boolean; request?: unknown; error?: string }
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error || 'request_failed' }
    return { ok: true, request: normalizeRequest(data.request) }
  } catch {
    return { ok: false, error: 'request_failed' }
  }
}

export async function cancelErasure(): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = await authHeader()
  if (!headers) return { ok: false, error: 'not_authenticated' }
  try {
    const res = await fetch(`${WORKER_URL}/account/erasure/cancel`, { method: 'POST', headers })
    const data = await res.json().catch(() => null) as null | { ok?: boolean; error?: string }
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error || 'request_failed' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'request_failed' }
  }
}

function normalizeRequest(raw: unknown): ErasureRequestState | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.status !== 'string') return null
  return {
    id: r.id,
    status: r.status as ErasureRequestState['status'],
    requestedAt: String(r.requested_at || ''),
    gracePeriodEndsAt: String(r.grace_period_ends_at || ''),
  }
}
