/**
 * PostgREST (Supabase REST) helpers for the admin-api worker.
 *
 * ALL database access goes through PostgREST at env.SUPABASE_URL using the
 * service-role key. The service-role key is used ONLY as an upstream header —
 * it is never returned in responses, never logged, and upstream error bodies
 * (which might echo request headers/keys) are never forwarded to the caller.
 */

export interface SupabaseEnv {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

export function sbBase(env: SupabaseEnv): string {
  return env.SUPABASE_URL.replace(/\/+$/, '')
}

/** Service-role headers, or null when the key is not configured (fail closed). */
export function serviceHeaders(env: SupabaseEnv, extra?: Record<string, string>): Record<string, string> | null {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return null
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

/** GET/POST/PATCH/DELETE against /rest/v1/<path> with service-role headers. */
export async function sbRest(
  env: SupabaseEnv,
  path: string,
  init?: { method?: string; body?: unknown },
  extraHeaders?: Record<string, string>,
): Promise<Response | null> {
  const headers = serviceHeaders(env, extraHeaders)
  if (!headers) return null
  return fetch(`${sbBase(env)}/rest/v1/${path}`, {
    method: init?.method || 'GET',
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

/**
 * Escape a free-text search value for use inside a PostgREST `or=(...)`
 * ilike filter. PostgREST's filter grammar breaks on `(),."`, so those are
 * replaced with spaces. The value is then URL-encoded by the caller.
 */
export function escapePostgrestSearch(q: string): string {
  return q.replace(/[(),."\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
}
