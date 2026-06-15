/**
 * Shared CORS builder for the photo-upload worker.
 *
 * H3 security fix: `allowed.includes('*')` never reflects an arbitrary origin.
 * `origin` is echoed back ONLY when it is explicitly listed in `allowedList`.
 * A misconfigured `ALLOWED_ORIGIN = '*'` therefore falls through to `allowed[0]`
 * (i.e., the literal string `'*'`), which is the safe Cloudflare-allowed wildcard
 * form — it does NOT allow the requester to read credentialled responses because
 * browsers block credentialled requests to `*`. Crucially it never produces
 * `Access-Control-Allow-Origin: <attacker-origin>`.
 */
export function buildCors(
  origin: string,
  allowedList: string[],
  methods: string,
  extraHeaders?: Record<string, string>,
): Record<string, string> {
  // Reflect caller's origin only when it is explicitly in the allowlist.
  const allowOrigin = allowedList.includes(origin) ? origin : allowedList[0] ?? '*'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': extraHeaders?.['Access-Control-Allow-Headers'] ?? 'content-type',
    'Vary': 'Origin',
    ...extraHeaders,
  }
}

/** Parse an env-var origin list (comma-separated) into a trimmed, non-empty array. */
export function parseOriginList(value: string): string[] {
  return value.split(',').map((v) => v.trim()).filter(Boolean)
}
