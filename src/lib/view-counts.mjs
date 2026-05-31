export function getArticleViewStorageKey(slug, date = new Date()) {
  return `article_viewed_${slug}_${date.toISOString().slice(0, 10)}`
}

export function getViewCount(rows, slug) {
  const row = (rows || []).find((item) => item.article_slug === slug && item.kind === 'view')
  return Number(row?.count || 0)
}

export function sortArticlesByViews(articles, rows) {
  return [...articles]
    .map((article) => ({ ...article, viewCount: getViewCount(rows, article.slug) }))
    .sort((a, b) => {
      if (b.viewCount !== a.viewCount) return b.viewCount - a.viewCount
      return a.date < b.date ? 1 : -1
    })
}
