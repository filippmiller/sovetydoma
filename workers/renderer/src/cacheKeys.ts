// Shared Cache API key construction for sovetydoma-renderer.
//
// EVERY cache read/write/purge must build keys through these helpers so the
// POST /__purge endpoint (purge.ts) can never drift from the keys the request
// handlers actually use.

// Bump to invalidate cached rendered pages after a worker change.
export const RENDER_VERSION = '17'

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

/** Latest-published-articles JSON API — used by the homepage "Только что"
 * widget so it can see today's dynamically-published articles, not just the
 * static build's month-old corpus. */
export function latestArticlesCacheUrl(base: string, limit: number): string {
  return `${base}/api/latest.json?limit=${limit}&generator=v1`
}

/** Per-category latest-published JSON API — lets the static category page's
 * client-side sort/search/filter (CategoryArticleBrowser) see dynamically
 * published articles for that one category, same gap as latestArticlesCacheUrl
 * above but scoped to a single rubric. */
export function categoryLatestCacheUrl(base: string, category: string, limit: number): string {
  return `${base}/api/category-latest.json?category=${category}&limit=${limit}&generator=v1`
}
