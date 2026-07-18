/**
 * AuthN/AuthZ for the admin-api worker (validateAdmin pattern copied from
 * workers/photo-upload). Fail closed on every ambiguity:
 *   401 — missing or invalid caller JWT
 *   403 — valid user but not an admin (or profile lookup failed)
 *   503 — auth backend not configured (never silently allow)
 *
 * The service-role key is used only as an upstream header and is never
 * exposed in responses or logs.
 */
import { sbBase, serviceHeaders, type SupabaseEnv } from './supabase'

export interface AdminUser {
  id: string
  email: string
}

export interface AuthEnv extends SupabaseEnv {
  SUPABASE_ANON_KEY?: string
}

export type AdminAuthResult =
  | { ok: true; user: AdminUser }
  | { ok: false; status: number; error: string; message: string }

function deny(status: number, error: string, message: string): AdminAuthResult {
  return { ok: false, status, error, message }
}

export async function validateAdmin(env: AuthEnv, authHeader: string): Promise<AdminAuthResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return deny(401, 'unauthorized', 'Missing bearer token')
  }
  if (!env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return deny(503, 'not_configured', 'Auth backend not configured')
  }

  // 1) Validate the caller's JWT against Supabase Auth.
  let user: AdminUser
  try {
    const res = await fetch(`${sbBase(env)}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: env.SUPABASE_ANON_KEY },
    })
    if (!res.ok) return deny(401, 'unauthorized', 'Invalid or expired token')
    const u = await res.json() as { id?: string; email?: string }
    if (!u?.id) return deny(401, 'unauthorized', 'Invalid or expired token')
    user = { id: u.id, email: u.email || '' }
  } catch {
    return deny(401, 'unauthorized', 'Invalid or expired token')
  }

  // 2) Require profiles.role === 'admin' (service-role lookup; fail closed).
  const headers = serviceHeaders(env)
  if (!headers) return deny(503, 'not_configured', 'Auth backend not configured')
  try {
    const res = await fetch(
      `${sbBase(env)}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`,
      { headers },
    )
    if (!res.ok) return deny(403, 'forbidden', 'Admin role required')
    const rows = await res.json() as Array<{ role?: string }>
    if (rows[0]?.role !== 'admin') return deny(403, 'forbidden', 'Admin role required')
  } catch {
    return deny(403, 'forbidden', 'Admin role required')
  }

  return { ok: true, user }
}
