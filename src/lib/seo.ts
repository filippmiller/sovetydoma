import type { ArticleFrontmatter } from '@/lib/articles'

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://1001sovet.ru').replace(/\/+$/, '')

export const SITE_NAME = 'СоветыДома'
export const DEFAULT_OG_IMAGE = '/og-default.png'

export function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${SITE_URL}${path}`
}

export function canonicalPath(path: string): string {
  if (path === '/') return `${SITE_URL}/`
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`.replace(/\/?$/, '/')
}

export function articlePath(article: Pick<ArticleFrontmatter, 'category' | 'slug'>): string {
  return `/${article.category}/${article.slug}/`
}

export function articleCanonicalUrl(article: Pick<ArticleFrontmatter, 'category' | 'slug'>): string {
  return canonicalPath(articlePath(article))
}

export function articleImagePath(article: Pick<ArticleFrontmatter, 'slug'>): string {
  return `/images/${article.slug}.jpg`
}

export function articleImageUrl(article: Pick<ArticleFrontmatter, 'slug'>): string {
  return absoluteUrl(articleImagePath(article))
}

export function truncateForMeta(value: string, maxLength = 160): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLength) return clean
  const cut = clean.slice(0, maxLength - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 80)).trim()}…`
}
