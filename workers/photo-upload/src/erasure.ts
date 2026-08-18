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
 * anonymize public.profiles / public.comments / public.saved_articles for
 * that user_id (plus delete any R2-stored comment photos — see
 * anonymizeUser) and flip the request to 'completed'.
 *
 * public.user_articles is intentionally NOT touched — see the comment at its
 * call site below for why (152-FZ audit 2026-08-18: an earlier version of
 * this header comment incorrectly listed user_articles here too; the code
 * never anonymized it — fixed to match what the code actually does).
 *
 * Race safety: between the due-rows SELECT and this loop reaching a given
 * row, the user may call POST /account/erasure/cancel. Each row is claimed
 * with an atomic conditional PATCH (status=eq.pending → 'processing') before
 * any PII is touched; if the claim affects zero rows (already cancelled, or
 * claimed by an overlapping cron run), the row is skipped untouched instead
 * of being anonymized and then silently flipped back to 'completed' over the
 * user's cancellation.
 *
 * Scope boundary (deliberate — see task scope, flagged in the session
 * report): this DOES NOT delete, ban, or sign out the auth.users row. The
 * account remains loggable-in after erasure; only the PII-bearing tables
 * above are anonymized. LEGAL: a user who re-authenticates after erasure
 * gets a fresh blank profile (handle_new_user's ON CONFLICT DO NOTHING
 * trigger only fires on INSERT, so no auto-recreate happens, but they could
 * re-fill display_name/bio manually) — full account deletion (auth.users)
 * was out of the stated task scope and is left as follow-up (⚠️ЮР — see
 * COMPLIANCE_152FZ_ROLLOUT_STATUS.md tech-debt section for this branch).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const GRACE_PERIOD_DAYS = 30
export const ANONYMIZED_DISPLAY_NAME = 'Удалённый пользователь'
export const ANONYMIZED_COMMENT_TEXT = '[комментарий удалён пользователем]'

export interface ErasureEnv {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  // Optional so existing unit tests (and any caller that only exercises the
  // Postgres side) keep working without a binding. index.ts's Env always
  // provides it in production — see anonymizeUser's R2 purge step.
  PHOTOS?: R2Bucket
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface ErasureRequestRow {
  id: string
  user_id: string
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
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

/**
 * Deletes any R2-stored comment photos for this user before the DB pointer
 * is nulled (152-FZ audit 2026-08-18, P1 fix). Without this, GET /file/<key>
 * is unauthenticated and served with `Cache-Control: public, max-age=31536000,
 * immutable`, so the blob stayed fetchable forever after "erasure" — the DB
 * said gone, the photo wasn't. Best-effort/fail-open on individual R2
 * deletes (a stray undeletable object must not block the rest of erasure),
 * but a failure to even list the rows fails this step (and therefore the
 * whole anonymize) so we never silently skip the purge.
 */
async function purgeCommentPhotos(env: ErasureEnv, uid: string, fetcher: Fetcher): Promise<boolean> {
  if (!env.PHOTOS) return true
  try {
    const res = await rest(env, `comments?user_id=eq.${uid}&photo_path=not.is.null&select=photo_path`, { method: 'GET' }, fetcher)
    if (!res.ok) return false
    const rows = await res.json().catch(() => []) as Array<{ photo_path: string | null }>
    await Promise.all(
      rows
        .map((r) => r.photo_path)
        .filter((key): key is string => Boolean(key))
        .map((key) => env.PHOTOS!.delete(key).catch(() => { /* best-effort per object */ })),
    )
    return true
  } catch {
    return false
  }
}

/** Anonymizes the in-scope PII tables/storage for one user. Best-effort per table — a single table failing does not stop the others, and the request is only marked 'completed' if every step succeeded. */
async function anonymizeUser(env: ErasureEnv, userId: string, fetcher: Fetcher): Promise<boolean> {
  const uid = encodeURIComponent(userId)
  const photosOk = await purgeCommentPhotos(env, uid, fetcher)
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
  return photosOk && results.every((res) => res.ok)
}

/**
 * Atomically claims one due row before touching any PII (152-FZ audit
 * 2026-08-18, P1 TOCTOU fix). Without this, a row read as "due" by the
 * SELECT in finalizeErasureRequests could be cancelled by the user via
 * POST /account/erasure/cancel a moment later, and this loop — which
 * previously anonymized unconditionally and then PATCHed straight to
 * 'completed' with no status filter — would destroy the user's data and
 * overwrite their 'cancelled' row back to 'completed' anyway. The claim is
 * a conditional PATCH (status=eq.pending → 'processing'); if it affects zero
 * rows, someone else (a concurrent cancel, or an overlapping cron run)
 * already moved the row, so this call skips it untouched.
 */
async function claimErasureRequest(env: ErasureEnv, id: string, fetcher: Fetcher): Promise<boolean> {
  try {
    const res = await rest(
      env,
      `erasure_requests?id=eq.${encodeURIComponent(id)}&status=eq.pending`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'processing' }),
      },
      fetcher,
    )
    if (!res.ok) return false
    const rows = await res.json().catch(() => []) as Array<{ id: string }>
    return rows.length > 0
  } catch {
    return false
  }
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
    try {
      const claimed = await claimErasureRequest(env, request.id, fetcher)
      if (!claimed) {
        // Cancelled (or claimed by another run) between the SELECT above and
        // now — skip without touching PII or the row (see claimErasureRequest).
        continue
      }

      const anonymized = await anonymizeUser(env, request.user_id, fetcher)
      if (!anonymized) {
        summary.failed += 1
        continue
      }

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
    } catch (err) {
      // 152-FZ audit 2026-08-18, P1 fix: this used to be unguarded, so a
      // single thrown network error (timeout/DNS/reset) aborted the entire
      // cron run and every remaining due request silently missed its
      // legally-mandated deadline until the next day's tick. Now one row's
      // failure is isolated and the loop continues.
      summary.failed += 1
      console.error(`[retention] erasure finalize threw for request ${request.id}:`, err)
    }
  }

  return summary
}
