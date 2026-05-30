// Client-safe article lookup. Backed by a generated JSON map
// (scripts/generate-article-index.mjs) so client components can resolve a
// slug to its category/title without importing the fs-based articles.ts.
import indexJson from './article-index.json'

export interface ArticleMeta {
  category: string
  title: string
}

const index = indexJson as Record<string, ArticleMeta>

export function getArticleMeta(slug: string): ArticleMeta | null {
  return index[slug] ?? null
}

/** Resolve the canonical article path for a slug, or null if unknown. */
export function getArticleHref(slug: string): string | null {
  const meta = index[slug]
  return meta?.category ? `/${meta.category}/${slug}/` : null
}
