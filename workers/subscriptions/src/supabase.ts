import type { Env } from './types'

export function getSupabaseBaseUrl(env: Env): string {
  return String(env.SUPABASE_URL || '').replace(/\/+$/, '')
}

export function hasSupabaseServiceRole(env: Env): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
}

function serviceHeaders(env: Env, extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY || '')
  headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || ''}`)
  headers.set('Content-Type', 'application/json')
  return headers
}

async function supabaseRest<T>(env: Env, path: string, init: RequestInit): Promise<T> {
  if (!hasSupabaseServiceRole(env)) {
    throw new Error('supabase_service_role_not_configured')
  }

  const res = await fetch(`${getSupabaseBaseUrl(env)}/rest/v1/${path}`, {
    ...init,
    headers: serviceHeaders(env, init.headers),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let code = `supabase_${res.status}`
    try {
      const parsed = JSON.parse(body) as { code?: string; message?: string }
      if (parsed.code) code = `supabase_${parsed.code}`
    } catch {
      // ignore non-json bodies
    }
    throw new Error(code)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function insertRows<T>(env: Env, table: string, rows: unknown, select = '*'): Promise<T[]> {
  return supabaseRest<T[]>(env, `${table}?select=${encodeURIComponent(select)}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  })
}

export async function upsertRows<T>(env: Env, table: string, rows: unknown, onConflict: string, select = '*'): Promise<T[]> {
  return supabaseRest<T[]>(env, `${table}?select=${encodeURIComponent(select)}&on_conflict=${encodeURIComponent(onConflict)}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  })
}

export async function updateRows<T>(env: Env, table: string, query: string, patch: unknown, select = '*'): Promise<T[]> {
  return supabaseRest<T[]>(env, `${table}?${query}&select=${encodeURIComponent(select)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
}

export async function selectRows<T>(env: Env, table: string, query = 'select=*'): Promise<T[]> {
  return supabaseRest<T[]>(env, `${table}?${query}`, {
    method: 'GET',
  })
}

export async function deleteRows(env: Env, table: string, query: string): Promise<void> {
  await supabaseRest<unknown>(env, `${table}?${query}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
}

export async function callRpc<T>(env: Env, functionName: string, payload: unknown): Promise<T> {
  return supabaseRest<T>(env, `rpc/${functionName}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
