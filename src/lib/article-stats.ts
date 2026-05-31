export type ArticleStatsRow = {
  article_slug: string
  kind?: string
  count?: number
  stars?: number
  emoji?: string
}

export type ArticleCardStats = {
  viewCount: number
  likeCount: number
  ratingAverage: number | null
  ratingCount: number
}

export type ArticleStatsMap = Record<string, ArticleCardStats>

export function emptyArticleStats(): ArticleCardStats {
  return {
    viewCount: 0,
    likeCount: 0,
    ratingAverage: null,
    ratingCount: 0,
  }
}

export function buildArticleStatsMap(
  slugs: string[],
  rows: {
    counters?: ArticleStatsRow[]
    ratings?: ArticleStatsRow[]
    reactions?: ArticleStatsRow[]
  },
): ArticleStatsMap {
  const stats: ArticleStatsMap = {}
  for (const slug of slugs) stats[slug] = emptyArticleStats()

  for (const row of rows.counters || []) {
    const item = stats[row.article_slug]
    if (!item) continue
    if (row.kind === 'view') item.viewCount = Number(row.count || 0)
    if (row.kind === 'like') item.likeCount = Math.max(item.likeCount, Number(row.count || 0))
  }

  const ratingSums = new Map<string, { sum: number; count: number }>()
  for (const row of rows.ratings || []) {
    if (!stats[row.article_slug]) continue
    const stars = Number(row.stars || 0)
    if (stars < 1 || stars > 5) continue
    const current = ratingSums.get(row.article_slug) || { sum: 0, count: 0 }
    current.sum += stars
    current.count += 1
    ratingSums.set(row.article_slug, current)
  }
  for (const [slug, rating] of ratingSums) {
    stats[slug].ratingAverage = Math.round((rating.sum / rating.count) * 10) / 10
    stats[slug].ratingCount = rating.count
  }

  for (const row of rows.reactions || []) {
    const item = stats[row.article_slug]
    if (!item) continue
    if (row.emoji === '❤️' || row.emoji === '❤') item.likeCount += 1
  }

  return stats
}
