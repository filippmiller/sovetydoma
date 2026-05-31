export interface ViewCounterRow {
  article_slug: string
  kind: string
  count: number
}

export function getArticleViewStorageKey(slug: string, date?: Date): string
export function getViewCount(rows: ViewCounterRow[] | null | undefined, slug: string): number
export function sortArticlesByViews<T extends { slug: string; date: string }>(
  articles: T[],
  rows: ViewCounterRow[] | null | undefined,
): Array<T & { viewCount: number }>
