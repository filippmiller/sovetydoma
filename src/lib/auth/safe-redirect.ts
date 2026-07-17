/**
 * Open-redirect guard for Supabase auth action links.
 *
 * The VK-ID and Yandex exchange endpoints return an `actionLink` that is a
 * Supabase-generated magic-link URL (e.g. https://<supabase>/auth/v1/verify?...).
 * Before navigating to any server-supplied URL we verify it starts with the
 * expected Supabase auth prefix so a compromised or malicious server response
 * can never bounce a freshly-authenticated user to an external page.
 */

function supabaseAuthPrefix(): string | null {
  // Evaluated lazily per call (NEXT_PUBLIC_* values are inlined at build time,
  // so this is effectively constant in the shipped bundle; laziness keeps the
  // function pure/testable and fail-closed when the env is absent).
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '')
  return base ? `${base}/auth/v1/` : null
}

/**
 * Returns true only if `url` starts with the configured Supabase auth v1 prefix.
 * If NEXT_PUBLIC_SUPABASE_URL is not set, always returns false (fail-closed).
 */
export function assertSupabaseAuthLink(url: string): boolean {
  const prefix = supabaseAuthPrefix()
  if (!prefix) return false
  return url.startsWith(prefix)
}

/**
 * Navigate to `url` if it passes the Supabase auth link check.
 * Returns true if navigation was initiated, false otherwise.
 */
export function safeAssign(url: string): boolean {
  if (!assertSupabaseAuthLink(url)) return false
  window.location.href = url
  return true
}
