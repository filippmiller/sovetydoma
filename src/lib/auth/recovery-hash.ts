// Single source of truth for Supabase auth tokens that arrive in the URL hash
// (password recovery / OAuth-implicit / magic-link). A synchronous inline script
// in the root layout <head> (see app/layout.tsx) captures the raw hash and
// strips it from the address bar BEFORE any third-party script (Yandex Metrika)
// can read location.href — otherwise access_token/refresh_token leak to
// mc.yandex.ru in the page-url param (bead sovetydoma-0h3.11). The captured hash
// is stashed on window + sessionStorage (same-origin, never sent to a third
// party) so the auth flow reads tokens from here instead of window.location.hash
// (which is now empty).

const STORAGE_KEY = 'sb_auth_hash'
const WINDOW_KEY = '__SB_AUTH_HASH__'

type HashWindow = Window & { [WINDOW_KEY]?: string }

/** Raw captured hash (e.g. "#access_token=...&type=recovery"), or "". */
export function readAuthHash(): string {
  if (typeof window === 'undefined') return ''
  const w = window as HashWindow
  const inMemory = w[WINDOW_KEY]
  if (typeof inMemory === 'string' && inMemory) return inMemory
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

/** Parsed params from the captured auth hash. */
export function getAuthHashParams(): URLSearchParams {
  const h = readAuthHash()
  return new URLSearchParams(h.charAt(0) === '#' ? h.slice(1) : h)
}

/** Drop the captured hash once the session has been established. */
export function clearAuthHash(): void {
  if (typeof window === 'undefined') return
  const w = window as HashWindow
  delete w[WINDOW_KEY]
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
