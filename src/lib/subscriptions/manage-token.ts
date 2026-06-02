const STORAGE_KEY = 'subscription_manage_token'

export function saveManageToken(token: string) {
  if (typeof window === 'undefined' || !token) return
  try {
    sessionStorage.setItem(STORAGE_KEY, token)
  } catch {
    // ignore quota/private mode errors
  }
}

export function readManageToken(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return sessionStorage.getItem(STORAGE_KEY) || undefined
  } catch {
    return undefined
  }
}

export function clearManageTokenFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has('manage_token')) return
  url.searchParams.delete('manage_token')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}