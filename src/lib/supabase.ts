import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton pinned to globalThis. A module-local `let` is NOT enough: Next.js
// code-splitting can bundle this module into multiple chunks, each with its own
// module scope → multiple GoTrueClients. That broke password recovery: the
// recovery session set by one client instance (via detectSessionInUrl /
// setSession) was invisible to updateUser() called through another instance, so
// updateUser bailed with no session and no network request. Pinning the client
// on globalThis guarantees every chunk shares exactly one instance.
const GLOBAL_KEY = '__sovetydoma_supabase_client__'
function getStore(): Record<string, SupabaseClient | undefined> {
  return globalThis as unknown as Record<string, SupabaseClient | undefined>
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function getSupabase(): SupabaseClient {
  const store = getStore()
  const existing = store[GLOBAL_KEY]
  if (existing) return existing
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !key) throw new Error('Supabase env vars not set')
  // Default fetch. (An earlier credentials:'omit' wrapper was added on a wrong
  // CORS diagnosis; it sits in gotrue's fetch path and is the prime suspect for
  // recovery setSession/getUser failing with "Failed to fetch" before reaching
  // the network. Default credentials work for these cross-origin Bearer calls.)
  const client = createClient(url, key)
  store[GLOBAL_KEY] = client
  return client
}

// Convenience alias for client components that are guaranteed to run in-browser
export const supabase = {
  get auth() { return getSupabase().auth },
  get from() {
    const client = getSupabase()
    return client.from.bind(client)
  },
}

export type UserRole = 'user' | 'moderator' | 'admin'

export interface Profile {
  id: string
  display_name: string
  bio: string
  avatar_url: string
  role: UserRole
  articles_count: number
}

export interface Comment {
  id: string
  article_slug: string
  user_id: string
  content: string
  parent_id: string | null
  is_approved: boolean
  photo_path?: string | null
  created_at: string
  profiles?: Profile
}
