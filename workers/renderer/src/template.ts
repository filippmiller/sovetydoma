// NO-REDEPLOY publishing: this worker makes article publishing rebuild-free.
// See docs/NO-REDEPLOY-PUBLISHING.md

/**
 * Template fetching + caching.
 *
 * Strategy: fetch a known live article page as the HTML shell.
 * Cache the raw template bytes for ~10 min via caches.default.
 * The cached entry is keyed by the TEMPLATE_URL (or default).
 */

const TEMPLATE_CACHE_TTL = 600 // seconds (10 min)
const FETCH_TIMEOUT_MS = 7000

export async function fetchTemplate(templateUrl: string): Promise<string> {
  const cacheKey = new Request(templateUrl, { method: 'GET' })
  const cache = caches.default

  // Try cache first
  const cached = await cache.match(cacheKey)
  if (cached) {
    return cached.text()
  }

  // Fetch live with timeout
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let resp: Response
  try {
    resp = await fetch(templateUrl, {
      signal: controller.signal,
      headers: {
        // Identify ourselves so VPS logs can distinguish template fetches from real user traffic
        'User-Agent': 'sovetydoma-renderer/1.0 (template-fetch)',
      },
    })
  } catch (err) {
    clearTimeout(timer)
    throw new Error(`template_fetch_failed: ${String(err)}`)
  }
  clearTimeout(timer)

  if (!resp.ok) {
    throw new Error(`template_fetch_${resp.status}`)
  }

  const html = await resp.text()

  // Store in cache with a synthetic Cache-Control
  const toCache = new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': `public, max-age=${TEMPLATE_CACHE_TTL}`,
    },
  })
  // Non-blocking — we don't need to await this
  cache.put(cacheKey, toCache).catch(() => {/* ignore cache write errors */})

  return html
}
