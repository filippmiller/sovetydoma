import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton — safe to import in both server and client components.
// The client is only instantiated on first call, so SSG pages that never
// call getSupabase() won't fail even without env vars at build time.
let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !key) throw new Error('Supabase env vars not set')
  _client = createClient(url, key)
  return _client
}

// Convenience alias for client components that are guaranteed to run in-browser
export const supabase = {
  get auth() { return getSupabase().auth },
  get from() { return getSupabase().from.bind(getSupabase()) },
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
