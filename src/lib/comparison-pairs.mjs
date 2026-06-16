// Comparison page pair generator — shared between Next.js and the sitemap script.

/**
 * @typedef {Object} ArticleLike
 * @property {string} slug
 * @property {string} category
 * @property {string} title
 * @property {string[]} tags
 * @property {string} description
 */

/**
 * @typedef {Object} ComparisonPair
 * @property {string} category
 * @property {string} a
 * @property {string} b
 * @property {string[]} sharedTags
 * @property {string[]} uniqueA
 * @property {string[]} uniqueB
 */

/**
 * Generate deterministic comparison pairs from articles in the same category.
 * Prefers pairs with shared tags *and* complementary (different) tags.
 *
 * @param {ArticleLike[]} articles
 * @param {number} maxTotal
 * @param {number} maxPerCategory
 * @returns {ComparisonPair[]}
 */
export function generateComparisonPairs(articles, maxTotal = 200, maxPerCategory = 20) {
  /** @type {Map<string, ArticleLike[]>} */
  const byCategory = new Map()
  for (const article of articles) {
    const list = byCategory.get(article.category) || []
    list.push(article)
    byCategory.set(article.category, list)
  }

  /** @type {ComparisonPair[]} */
  const result = []
  const seenKeys = new Set()

  for (const [category, list] of byCategory.entries()) {
    /** @type {Array<{ pair: ComparisonPair; score: number }>} */
    const scored = []
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        const tagsA = new Set(a.tags || [])
        const tagsB = new Set(b.tags || [])
        const sharedTags = [...tagsA].filter((t) => tagsB.has(t))
        const uniqueA = [...tagsA].filter((t) => !tagsB.has(t))
        const uniqueB = [...tagsB].filter((t) => !tagsA.has(t))
        if (sharedTags.length === 0 || uniqueA.length === 0 || uniqueB.length === 0) continue

        const totalUnique = uniqueA.length + uniqueB.length
        const jaccardDistance = 1 - sharedTags.length / (new Set([...tagsA, ...tagsB]).size || 1)
        const score = sharedTags.length * 3 + totalUnique * 0.5 + jaccardDistance * 2

        const pair = {
          category,
          a: a.slug,
          b: b.slug,
          sharedTags: sharedTags.sort((x, y) => x.localeCompare(y, 'ru')),
          uniqueA: uniqueA.sort((x, y) => x.localeCompare(y, 'ru')),
          uniqueB: uniqueB.sort((x, y) => x.localeCompare(y, 'ru')),
        }
        scored.push({ pair, score })
      }
    }

    scored.sort((x, y) => {
      if (y.score !== x.score) return y.score - x.score
      const keyX = `${x.pair.a}-ili-${x.pair.b}`
      const keyY = `${y.pair.a}-ili-${y.pair.b}`
      return keyX.localeCompare(keyY, 'ru')
    })

    for (const { pair } of scored.slice(0, maxPerCategory)) {
      const orderedKey = pair.a < pair.b ? `${pair.a}-ili-${pair.b}` : `${pair.b}-ili-${pair.a}`
      if (seenKeys.has(orderedKey)) continue
      seenKeys.add(orderedKey)
      result.push(pair)
      if (result.length >= maxTotal) break
    }
    if (result.length >= maxTotal) break
  }

  return result
}
