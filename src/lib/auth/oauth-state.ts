/**
 * CSRF state verification for the custom OAuth redirect flows (Yandex, VK ID).
 *
 * The flow stores a random `state` in sessionStorage before redirecting to the
 * provider and must compare it with the `state` query param on return. The
 * check is strict and the stored value is one-time (callers delete it before
 * comparing, so a replayed callback URL fails).
 */
export function verifyOAuthState(stored: string | null | undefined, returned: string | null | undefined): boolean {
  if (!stored || !returned) return false
  return stored === returned
}
