export const FREQUENCY_LIMITS = {
  daily_one: { period: 'day', maxArticles: 1 },
  daily_digest_3: { period: 'day', maxArticles: 3 },
  weekly_digest_3: { period: 'week', maxArticles: 3 },
  weekly_digest_7: { period: 'week', maxArticles: 7 },
}

const ARTICLE_BACKLOG_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14

export function getDeliveryPeriod(frequency, date = new Date()) {
  const limits = FREQUENCY_LIMITS[frequency] || FREQUENCY_LIMITS.weekly_digest_3
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  if (limits.period === 'day') return `${year}-${month}-${day}`

  const start = new Date(Date.UTC(year, 0, 1))
  const diffDays = Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - start.getTime()) / 86400000)
  const week = String(Math.floor((diffDays + start.getUTCDay()) / 7) + 1).padStart(2, '0')
  return `${year}-W${week}`
}

export function planDigestArticles({
  frequency = 'weekly_digest_3',
  subscribedCategories = [],
  articles = [],
  deliveredSlugs = [],
  confirmedAt,
  now = new Date(),
}) {
  const limits = FREQUENCY_LIMITS[frequency] || FREQUENCY_LIMITS.weekly_digest_3
  const categorySet = new Set(subscribedCategories)
  const delivered = new Set(deliveredSlugs)
  const confirmedTime = confirmedAt ? new Date(confirmedAt).getTime() : 0
  const newestAllowedTime = now.getTime() - ARTICLE_BACKLOG_MAX_AGE_MS

  return articles
    .filter((article) => categorySet.has(article.category_slug))
    .filter((article) => !delivered.has(article.article_slug))
    .filter((article) => {
      const articleTime = new Date(article.first_seen_at || article.published_at || 0).getTime()
      return articleTime >= confirmedTime && articleTime >= newestAllowedTime
    })
    .sort((a, b) => {
      const aTime = new Date(a.first_seen_at || a.published_at || 0).getTime()
      const bTime = new Date(b.first_seen_at || b.published_at || 0).getTime()
      return bTime - aTime || String(a.article_slug).localeCompare(String(b.article_slug))
    })
    .slice(0, limits.maxArticles)
}
