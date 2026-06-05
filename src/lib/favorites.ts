import { getSupabase } from './supabase'

const STORAGE_KEY = 'favorites'

/**
 * Read locally stored favorite slugs (used for anonymous + as cache while logged in).
 * Safe for SSR.
 */
export function getLocalFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Remove the local favorites key entirely. */
export function clearLocalFavorites(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
}

/**
 * One-time migration: push any localStorage favorites into the user's saved_articles
 * (idempotent via upsert on conflict), then clear the local key.
 * Call this on successful auth (login or post-recovery) and on auth state becoming authenticated.
 * Returns number of slugs attempted.
 */
export async function migrateLocalFavoritesToServer(userId: string): Promise<number> {
  if (!userId) return 0
  const slugs = getLocalFavorites()
  if (!slugs.length) return 0

  const sb = getSupabase()
  let count = 0

  // Best-effort, don't block UI on any single failure
  for (const slug of slugs) {
    try {
      const { error } = await sb
        .from('saved_articles')
        .upsert(
          { user_id: userId, article_slug: slug },
          { onConflict: 'user_id,article_slug' }
        )
      if (!error) count++
    } catch {
      // ignore per-slug errors (table may have RLS issues for this user etc.)
    }
  }

  clearLocalFavorites()
  return count
}
