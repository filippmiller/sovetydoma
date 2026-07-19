// Shared Cache API key construction for sovetydoma-renderer.
//
// EVERY cache read/write/purge must build keys through these helpers so the
// POST /__purge endpoint (purge.ts) can never drift from the keys the request
// handlers actually use.

// Bump to invalidate cached rendered pages after a worker change.
export const RENDER_VERSION = '13'

export function siteBaseUrl(env: { SITE_URL?: string }): string {
  return (env.SITE_URL || 'https://1001sovet.ru').replace(/\/+$/, '')
}

/** Rendered article page — used by handleArticle. */
export function articleCacheUrl(base: string, category: string, slug: string): string {
  return `${base}/${category}/${slug}/?render=${RENDER_VERSION}`
}

/** Cached content_matrix rows for a category — used by fetchCategoryRows. */
export function categoryRowsCacheUrl(base: string, category: string): string {
  return `${base}/__internal/cat-rows/${category}?render=${RENDER_VERSION}`
}

/** Hub page (category null = the /stati/ index) — used by handleHub. */
export function hubCacheUrl(base: string, category: string | null, page: number): string {
  return `${base}/stati/${category ?? ''}/${page}?render=${RENDER_VERSION}`
}

/** Dynamic sitemap — used by handleSitemap. */
export function sitemapCacheUrl(base: string): string {
  return `${base}/sitemap-dynamic.xml?generator=v3`
}

/** Dzen RSS feed: one stable article per Moscow day. */
export function dzenFeedCacheUrl(base: string): string {
  return `${base}/zen.xml?generator=v4`
}
