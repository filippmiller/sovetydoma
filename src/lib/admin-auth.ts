'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

export type AdminAuthState = 'checking' | 'authed' | 'denied'

/**
 * Real admin gate: requires a valid Supabase session whose profile has
 * role = 'admin'. Replaces the old client-side hardcoded password (which
 * shipped the secret in the bundle and gated only a sessionStorage flag).
 *
 * On denial it redirects to /admin/login/. Components render nothing until
 * the check resolves.
 */
export function useAdminAuth(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>('checking')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sb = getSupabase()
        // Verify with getUser() first — it validates the token against the auth
        // server, so a stale/forged local session can't pass the admin gate.
        // Only on a non-error null (e.g. transient network blip, not a rejected
        // token) do we fall back to the cached getSession() to avoid bouncing a
        // genuinely-authenticated admin into a login reload loop.
        const { data: userData, error: userError } = await sb.auth.getUser()
        let uid = userData.user?.id
        if (!uid && !userError) {
          const { data } = await sb.auth.getSession()
          uid = data.session?.user?.id
        }
        if (!uid) {
          if (!cancelled) { setState('denied'); window.location.href = '/admin/login/' }
          return
        }
        const { data: profile } = await sb
          .from('profiles')
          .select('role')
          .eq('id', uid)
          .maybeSingle()
        if (profile?.role === 'admin') {
          if (!cancelled) setState('authed')
        } else if (!cancelled) {
          setState('denied')
          window.location.href = '/admin/login/'
        }
      } catch {
        if (!cancelled) { setState('denied'); window.location.href = '/admin/login/' }
      }
    })()
    return () => { cancelled = true }
  }, [])

  return state
}
