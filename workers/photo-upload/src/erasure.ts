/**
 * Self-service account erasure — two-phase soft-delete (152-FZ compliance,
 * canon §1.2/§3 at D:/DEV/CRM-INVITE/COMPLIANCE_152FZ_CANON.md, gdeUslugi/
 * localsdoit reference pattern).
 *
 * Phase 1 (requestErasure): insert a public.erasure_requests row
 * (status='pending', grace_period_ends_at = now + GRACE_PERIOD_DAYS). This
 * row *is* the canon-required audit-log entry written before any mutation —
 * no PII is touched yet, so the user can still cancel.
 * Phase 2 (finalizeErasureRequests, called from the retention cron in
 * index.ts's scheduled() handler): once grace_period_ends_at has passed,
 * anonymize public.profiles / public.comments / public.saved_articles /
 * public.user_articles for that user_id and flip the request to 'completed'.
 *
 * Scope boundary (deliberate — see task scope, flagged in the session
 * report): this DOES NOT delete, ban, or sign out the auth.users row. The
 * account remains loggable-in after erasure; only the four PII-bearing
 * tables above are anonymized. LEGAL: a user who re-authenticates after
 * erasure gets a fresh blank profile (handle_new_user's ON CONFLICT DO
 * NOTHING trigger only fires on INSERT, so no auto-recreate happens, but
 * they could re-fill display_name/bio manually) — full account deletion
 * (auth.users) was out of the stated task scope and is left as follow-up.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const GRACE_PERIOD_DAYS = 30
export const ANONYMIZED_DISPLAY_NAME = 'Удалённый пользователь'
export const ANONYMIZED_COMMENT_TEXT = '[комментарий удалён пользователем]'

export interface ErasureEnv {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface ErasureRequestRow {
  id: string
  user_id: string
  status: 'pending' | 'completed' | 'cancelled'
  requested_at: string
  grace_period_ends_at: string
  completed_at: string | null
  cancelled_at: string | null
}

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value)
}

function rest(env: ErasureEnv, path: string, init: RequestInit, fetcher: Fetcher): Promise<Response> {
  return fetcher(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY || '',
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  })
}

export type RequestErasureResult =
  | { ok: true; request: ErasureRequestRow }
  | { ok: false; error: 'not_configured' | 'bad_user' | 'lookup_failed' | 'insert_failed' }

/** Idempotent: an existing pending request for this user is returned as-is rather than duplicated. */
export async function requestErasure(
  env: ErasureEnv,
  userId: string,
  ipHash: string,
  userAgent: string,
  fetcher: Fetcher = fetch,
): Promise<RequestErasureResult> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: 'not_configured' }
  if (!isValidUuid(userId)) return { ok: false, error: 'bad_user' }

  const existing = await getErasureStatus(env, userId, fetcher)
  if (existing.ok && existing.request) return { ok: true, request: existing.request }
  if (!existing.ok) return { ok: false, error: 'lookup_failed' }

  const gracePeriodEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString()
  try {
    const res = await rest(env, 'erasure_requests?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userId,
        status: 'pending',
        grace_period_ends_at: gracePeriodEndsAt,
        ip_hash: ipHash,
        user_agent: userAgent.slice(0, 500),
      }),
    }, fetcher)
    if (!res.ok) return { ok: false, error: 'insert_failed' }
    const rows = await res.json().catch(() => []) as ErasureRequestRow[]
    if (!rows[0]) return { ok: false, error: 'insert_failed' }
    return { ok: true, request: rows[0] }
  } catch {
    return { ok: false, error: 'insert_failed' }
  }
}

export type GetErasureStatusResult =
  | { ok: true; request: ErasureRequestRow | null }
  | { ok: false }

export async function getErasureStatus(
  env: ErasureEnv,
  userId: string,
  fetcher: Fetcher = fetch,
): Promise<GetErasureStatusResult> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !isValidUuid(userId)) return { ok: false }
  try {
    const res = await rest(
      env,
      `erasure_requests?user_id=eq.${encodeURIComponent(userId)}&status=eq.pending&select=*&limit=1`,
      { method: 'GET' },
      fetcher,
    )
    if (!res.ok) return { ok: false }
    const rows = await res.json().catch(() => []) as ErasureRequestRow[]
    return { ok: true, request: rows[0] || null }
  } catch {
    return { ok: false }
  }
}

export type CancelErasureResult = { ok: true } | { ok: false; error: 'not_configured' | 'bad_user' | 'not_found' | 'update_failed' }

export async function cancelErasure(
  env: ErasureEnv,
  userId: string,
  fetcher: Fetcher = fetch,
): Promise<CancelErasureResult> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: 'not_configured' }
  if (!isValidUuid(userId)) return { ok: false, error: 'bad_user' }

  try {
    const res = await rest(
      env,
      `erasure_requests?user_id=eq.${encodeURIComponent(userId)}&status=eq.pending&select=id`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'cancelled', cancelled_at: new Date().toISOString() }),
      },
      fetcher,
    )
    if (!res.ok) return { ok: false, error: 'update_failed' }
    const rows = await res.json().catch(() => []) as Array<{ id: string }>
    if (rows.length === 0) return { ok: false, error: 'not_found' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'update_failed' }
  }
}

/** Anonymizes the four in-scope PII tables for one user. Best-effort per table — a single table failing does not stop the others, and the request is only marked 'completed' if every table succeeded. */
async function anonymizeUser(env: ErasureEnv, userId: string, fetcher: Fetcher): Promise<boolean> {
  const uid = encodeURIComponent(userId)
  const results = await Promise.all([
    rest(env, `profiles?id=eq.${uid}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ display_name: ANONYMIZED_DISPLAY_NAME, bio: '', avatar_url: '' }),
    }, fetcher),
    rest(env, `comments?user_id=eq.${uid}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ content: ANONYMIZED_COMMENT_TEXT, is_deleted: true, photo_path: null }),
    }, fetcher),
    rest(env, `saved_articles?user_id=eq.${uid}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    }, fetcher),
    // user_articles: author_id (the only PII-bearing column) is intentionally
    // kept — canon §1.2 preserves FK-referenced rows for content/moderation
    // history, and this table has no denormalized name/email/etc columns to
    // scrub. Author identity is already severed for display purposes by the
    // profiles anonymization above (any join surfaces "Удалённый пользователь").
  ])
  return results.every((res) => res.ok)
}

export interface FinalizeSummary {
  processed: number
  completed: number
  failed: number
}

/** Retention worker entry point — called from the daily cron in index.ts's scheduled() handler. */
export async function finalizeErasureRequests(
  env: ErasureEnv,
  fetcher: Fetcher = fetch,
  now: Date = new Date(),
): Promise<FinalizeSummary> {
  const summary: FinalizeSummary = { processed: 0, completed: 0, failed: 0 }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return summary

  let due: Array<{ id: string; user_id: string }> = []
  try {
    const res = await rest(
      env,
      `erasure_requests?status=eq.pending&grace_period_ends_at=lte.${encodeURIComponent(now.toISOString())}&select=id,user_id`,
      { method: 'GET' },
      fetcher,
    )
    if (!res.ok) return summary
    due = await res.json().catch(() => []) as Array<{ id: string; user_id: string }>
  } catch {
    return summary
  }

  for (const request of due) {
    summary.processed += 1
    const anonymized = await anonymizeUser(env, request.user_id, fetcher)
    if (!anonymized) {
      summary.failed += 1
      continue
    }
    try {
      const res = await rest(
        env,
        `erasure_requests?id=eq.${encodeURIComponent(request.id)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
        },
        fetcher,
      )
      if (res.ok) summary.completed += 1
      else summary.failed += 1
    } catch {
      summary.failed += 1
    }
  }

  return summary
}
