'use client'

import { useEffect, useState } from 'react'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

// Shared auth gate for interactive widgets (reactions, ratings, feedback).
// Anonymous visitors must not be able to record votes — clicking instead
// prompts login via a global event the header AuthButton listens for.

export const OPEN_AUTH_EVENT = 'sovetydoma:open-auth'

export function promptLogin(): void {
  try {
    window.dispatchEvent(new CustomEvent(OPEN_AUTH_EVENT))
  } catch {
    // SSR / no window — ignore
  }
}

export function useAuthUserId(): { userId: string | null } {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    let alive = true
    const sb = getSupabase()
    sb.auth
      .getUser()
      .then(({ data }) => {
        if (alive) setUserId(data.user?.id ?? null)
      })
      .catch(() => {})
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (alive) setUserId(session?.user?.id ?? null)
    })
    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [])

  return { userId }
}
