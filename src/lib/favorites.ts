import { getSupabase } from './supabase'

const STORAGE_KEY = 'favorites'
const PENDING_INTENT_KEY = 'pendingAuthIntent'

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

/** Write local favorites (centralized to keep CardFavoriteButton / FavoriteButton in sync). */
export function saveLocalFavorites(slugs: string[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs))
  }
}

/** Remove the local favorites key entirely. */
export function clearLocalFavorites(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
}

/**
 * Store a pending auth-triggered action (e.g. favorite while logged out).
 * Used so that after successful login we can ensure the specific article is saved
 * and (where practical) the user stays in the intended context.
 * Uses sessionStorage (tab-scoped, survives reloads within tab but not tab close).
 */
export function setPendingAuthIntent(intent: { action: 'favorite'; slug: string; returnTo?: string }): void {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(PENDING_INTENT_KEY, JSON.stringify(intent))
    } catch {
      /* ignore storage errors */
    }
  }
}

/** Read (without clearing) a pending auth intent, if any. */
export function getPendingAuthIntent(): { action: 'favorite'; slug: string; returnTo?: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PENDING_INTENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.action === 'favorite' && typeof parsed.slug === 'string') {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

/** Clear any pending auth intent marker. */
export function clearPendingAuthIntent(): void {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(PENDING_INTENT_KEY)
    } catch {
      /* ignore */
    }
  }
}

/**
 * Process a specific pending favorite intent (if present) after auth.
 * Ensures the slug is upserted under the *current authenticated user* (never trusts caller-supplied id).
 * Clears the marker only on success. Leaves it (and local) on failure so nothing is lost.
 * Called from post-login paths (modal + global auth listener).
 */
export async function processPendingFavoriteIntent(): Promise<void> {
  const intent = getPendingAuthIntent()
  if (!intent || intent.action !== 'favorite' || !intent.slug) return

  const sb = getSupabase()
  const { data: { user } } = await sb.auth.getUser()
  const uid = user?.id
  if (!uid) return // keep marker for a future successful auth

  try {
    const { error } = await sb
      .from('saved_articles')
      .upsert(
        { user_id: uid, article_slug: intent.slug },
        { onConflict: 'user_id,article_slug' }
      )
    if (!error) {
      clearPendingAuthIntent()
    }
    // on error keep the marker + local entry (see migrate for local handling)
  } catch {
    // keep intent; caller may surface message
  }
}

/**
 * One-time migration: push any localStorage favorites into the user's saved_articles
 * (idempotent via upsert on conflict).
 *
 * SECURITY: Always derives the user_id from the current validated Supabase session
 * (sb.auth.getUser()). Never trusts a caller-supplied userId. RLS policies are still
 * the source of truth and must restrict to auth.uid() == user_id.
 *
 * Robustness:
 * - Only clears localStorage for the slugs that succeeded.
 * - If any write fails, failed slugs (and thus the local entries) are preserved.
 * - Returns { migrated, failed } so callers can show Russian error if needed.
 *
 * Call on successful auth (login, post-recovery, SIGNED_IN) and on auth state change to authenticated.
 */
export async function migrateLocalFavoritesToServer(): Promise<{ migrated: number; failed: string[] }> {
  const sb = getSupabase()
  const { data: { user } } = await sb.auth.getUser()
  const uid = user?.id
  if (!uid) return { migrated: 0, failed: [] }

  const slugs = getLocalFavorites()
  if (!slugs.length) return { migrated: 0, failed: [] }

  const failed: string[] = []
  let migrated = 0

  for (const slug of slugs) {
    try {
      const { error } = await sb
        .from('saved_articles')
        .upsert(
          { user_id: uid, article_slug: slug },
          { onConflict: 'user_id,article_slug' }
        )
      if (error) {
        failed.push(slug)
      } else {
        migrated++
      }
    } catch {
      failed.push(slug)
    }
  }

  if (failed.length === 0) {
    clearLocalFavorites()
  } else {
    // Preserve only the failed ones in local (successful ones removed from cache)
    const remaining = slugs.filter((s) => failed.includes(s))
    if (remaining.length > 0) {
      saveLocalFavorites(remaining)
    } else {
      clearLocalFavorites()
    }
  }

  return { migrated, failed }
}
