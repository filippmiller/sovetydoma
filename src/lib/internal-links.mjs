function slugWords(slug) {
  return new Set(slug.split('-').filter((w) => w.length > 2))
}

function titleWords(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\s-]/gu, '')
      .split(/\s+/)
      .filter((w) => w.length > 3),
  )
}

/**
 * Deterministically pick 3–5 related articles for an internal link mesh.
 * Scoring: shared tags (+3 each), same category (+1), title/slug word overlap (+1).
 * Self-links and duplicates are excluded.
 *
 * @param {Object} source
 * @param {string} source.slug
 * @param {string} source.category
 * @param {string} source.title
 * @param {string[]} source.tags
 * @param {Array<Object>} allArticles
 * @param {number} [limit=4]
 * @returns {Array<{slug: string, category: string, title: string, score: number}>}
 */
export function findInternalLinks(source, allArticles, limit = 4) {
  const sourceTags = new Set(source.tags || [])
  const sourceSlugWords = slugWords(source.slug)
  const sourceTitleWords = titleWords(source.title)

  const candidates = allArticles
    .filter((article) => article.slug !== source.slug || article.category !== source.category)
    .map((article) => {
      let score = 0
      const tags = article.tags || []
      let sharedTags = 0
      for (const tag of tags) {
        if (sourceTags.has(tag)) {
          score += 3
          sharedTags++
        }
      }
      if (article.category === source.category) score += 1
      const titleOverlap = [...titleWords(article.title)].filter((w) => sourceTitleWords.has(w)).length
      const slugOverlap = [...slugWords(article.slug)].filter((w) => sourceSlugWords.has(w)).length
      score += titleOverlap + slugOverlap
      const hasSemanticOverlap = sharedTags > 0 || titleOverlap > 0 || slugOverlap > 0
      return {
        slug: article.slug,
        category: article.category,
        title: article.title,
        score,
        sharedTags,
        date: article.date,
        hasSemanticOverlap,
      }
    })
    .filter((c) => c.hasSemanticOverlap)

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.sharedTags !== a.sharedTags) return b.sharedTags - a.sharedTags
    return b.date.localeCompare(a.date)
  })

  const seen = new Set()
  const result = []
  for (const c of candidates) {
    const key = `${c.category}/${c.slug}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(c)
    if (result.length >= limit) break
  }

  return result
}
