// POST /__purge — targeted Cache API invalidation after a dynamic publish/update.
//
// Auth: header `x-purge-secret` must equal env.RENDERER_PURGE_SECRET, compared
// in constant time. Workers has no crypto.subtle.timingSafeEqual, so we use the
// same constant-time string compare as workers/subscriptions/src/security.ts.
// When the secret is unset the endpoint fails closed (503).

import { HUB_PAGE_SIZE } from './links'
import {
  articleCacheUrl,
  categoryRowsCacheUrl,
  dzenFeedCacheUrl,
  hubCacheUrl,
  siteBaseUrl,
  sitemapCacheUrl,
} from './cacheKeys'

export function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index]
  }
  return diff === 0
}

const CATEGORY_RE = /^[a-z0-9][a-z0-9-]{0,79}$/
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/

// Upper bound for hub page deletion when the category row count cannot be
// determined (DB unreachable and cat-rows cache cold): covers
// FALLBACK_HUB_PAGES * HUB_PAGE_SIZE = 1000 dynamic articles.
const FALLBACK_HUB_PAGES = 25

export interface PurgeEnv {
  SITE_URL?: string
  RENDERER_PURGE_SECRET?: string
}

export interface PurgeCategoryRow {
  published_via: string | null
}

export type FetchCategoryRows = (category: string) => Promise<PurgeCategoryRow[]>

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function handlePurge(
  req: Request,
  env: PurgeEnv,
  fetchCategoryRows: FetchCategoryRows,
): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const secret = env.RENDERER_PURGE_SECRET
  if (!secret) {
    // Fail closed: without a configured secret the endpoint is disabled.
    return json({ error: 'purge_not_configured' }, 503)
  }

  const provided = req.headers.get('x-purge-secret') ?? ''
  if (!timingSafeEqual(provided, secret)) {
    return json({ error: 'unauthorized' }, 401)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const { category, slug } = (body ?? {}) as { category?: unknown; slug?: unknown }
  if (typeof category !== 'string' || !CATEGORY_RE.test(category)) {
    return json({ error: 'invalid_params' }, 400)
  }
  if (slug !== undefined && (typeof slug !== 'string' || !SLUG_RE.test(slug))) {
    return json({ error: 'invalid_params' }, 400)
  }

  const base = siteBaseUrl(env)
  const keys: string[] = []

  if (typeof slug === 'string') {
    keys.push(articleCacheUrl(base, category, slug))
  }
  keys.push(categoryRowsCacheUrl(base, category))

  // Hub page count mirrors handleHub: ceil(dynamic rows / HUB_PAGE_SIZE),
  // plus one extra page in case a publish just pushed the count over a
  // boundary. Rows are fetched BEFORE the cat-rows key is deleted so a warm
  // cat-rows cache entry is reused instead of hitting the DB.
  let hubPages: number
  let hubPagesSource: 'rows' | 'fallback'
  try {
    const rows = await fetchCategoryRows(category)
    const dynamicCount = rows.filter((r) => r.published_via === 'dynamic').length
    hubPages = Math.ceil(dynamicCount / HUB_PAGE_SIZE) + 1
    hubPagesSource = 'rows'
  } catch {
    hubPages = FALLBACK_HUB_PAGES
    hubPagesSource = 'fallback'
  }
  keys.push(hubCacheUrl(base, null, 1)) // /stati/ index
  for (let page = 1; page <= hubPages; page += 1) {
    keys.push(hubCacheUrl(base, category, page))
  }

  keys.push(sitemapCacheUrl(base))
  keys.push(dzenFeedCacheUrl(base))

  const cache = caches.default
  await Promise.all(keys.map((key) => cache.delete(new Request(key)).catch(() => false)))

  return json({
    purged: keys,
    purge_all_colos: false,
    hub_pages_source: hubPagesSource,
    note: 'Cache API delete is per-datacenter: entries in other colos keep serving until their TTL expires (article 300s, hub/cat-rows 600s, Dzen feed 900s, sitemap 3600s).',
  }, 200)
}
