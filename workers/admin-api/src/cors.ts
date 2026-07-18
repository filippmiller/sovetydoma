/**
 * Shared CORS builder (copied from workers/photo-upload — same H3 security fix).
 *
 * `origin` is echoed back ONLY when it is explicitly listed in `allowedList`.
 * A misconfigured allowlist never produces `Access-Control-Allow-Origin: <attacker-origin>`.
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
