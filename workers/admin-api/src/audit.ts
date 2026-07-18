/**
 * Audit + revision helpers for the admin-api worker.
 *
 * Tables (migration owned by the parent bead — code targets exactly these
 * columns):
 *   public.admin_audit_events(id, actor_id, actor_email, action, target_type,
 *     target_id, before, after, idempotency_key, request_id, result, created_at)
 *     — unique partial index on idempotency_key where not null
 *   public.article_revisions(id, matrix_id, revision, snapshot, actor_id,
 *     created_at) — unique(matrix_id, revision)
 *   public.content_matrix_events (existing factory table)
 */
import { sbRest, type SupabaseEnv } from './supabase'

export interface AuditEventRow {
  actor_id: string
  actor_email: string
  action: string
  target_type: string
  target_id: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  idempotency_key: string | null
  request_id: string | null
  result: unknown
}

/**
 * Idempotency replay lookup. Returns the stored result when an
 * admin_audit_events row already exists for this key, else null.
 * MUST be checked before any mutation.
 */
export async function findIdempotentReplay(env: SupabaseEnv, idempotencyKey: string): Promise<unknown | null> {
  const res = await sbRest(
    env,
    `admin_audit_events?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=result&limit=1`,
  )
  if (!res || !res.ok) return null
  const rows = await res.json().catch(() => []) as Array<{ result?: unknown }>
  return rows[0] && rows[0].result !== undefined && rows[0].result !== null ? rows[0].result : null
}

/** Insert an audit event. Best-effort: returns false on failure, never throws. */
export async function insertAuditEvent(env: SupabaseEnv, row: AuditEventRow): Promise<boolean> {
  try {
    const res = await sbRest(env, 'admin_audit_events', { method: 'POST', body: row }, { Prefer: 'return=minimal' })
    return !!res && res.ok
  } catch {
    return false
  }
}

/** Snapshot the CURRENT content_matrix row BEFORE an update. */
export async function insertRevision(
  env: SupabaseEnv,
  row: { matrix_id: string; revision: number; snapshot: unknown; actor_id: string },
): Promise<boolean> {
  try {
    const res = await sbRest(env, 'article_revisions', { method: 'POST', body: row }, { Prefer: 'return=minimal' })
    return !!res && res.ok
  } catch {
    return false
  }
}

/** Factory-consistent event log row on content_matrix_events. Best-effort. */
export async function insertMatrixEvent(
  env: SupabaseEnv,
  row: {
    matrix_id: string
    axis: string
    from_value: string | null
    to_value: string | null
    agent: string
    notes: string
    payload?: Record<string, unknown>
  },
): Promise<boolean> {
  try {
    const res = await sbRest(env, 'content_matrix_events', { method: 'POST', body: row }, { Prefer: 'return=minimal' })
    return !!res && res.ok
  } catch {
    return false
  }
}
