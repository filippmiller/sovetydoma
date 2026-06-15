/**
 * Shared types for the social autopost modules.
 * Imported by both vk-autopost.ts and fb-autopost.ts (and delivery.ts).
 */

export type ArticleRow = {
  article_slug: string
  category_slug: string
  title: string
  canonical_path: string
  description: string
  published_at: string | null
  first_seen_at: string
}
