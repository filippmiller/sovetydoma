import type { ArticleFrontmatter } from '@/lib/articles'

export type ArticleWithWordCount = ArticleFrontmatter & { wordCount?: number }

export type ArticleRecommendation = ArticleWithWordCount & {
  recommendationScore: number
  recommendationReasons: string[]
}

const STOP_WORDS = new Set([
  'как', 'что', 'это', 'для', 'или', 'при', 'без', 'под', 'над', 'про',
  'если', 'чтобы', 'после', 'перед', 'через', 'когда', 'можно', 'нужно',
  'советы', 'способы', 'секреты', 'быстро', 'просто', 'домашних', 'домашние',
  'своими', 'руками', 'минут', 'дома', 'даче', 'участке',
])

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)),
  )
}

function countOverlap(a: Set<string>, b: Set<string>): number {
  let count = 0
  a.forEach((token) => {
    if (b.has(token)) count += 1
  })
  return count
}

function dateScore(date: string): number {
  const timestamp = new Date(date).getTime()
  if (!Number.isFinite(timestamp)) return 0
  const ageDays = Math.max(0, (Date.now() - timestamp) / 86_400_000)
  return Math.max(0, 6 - Math.floor(ageDays / 14))
}

function scoreCandidate(current: ArticleWithWordCount, candidate: ArticleWithWordCount): ArticleRecommendation {
  const currentTags = new Set((current.tags || []).map((tag) => normalizeText(tag)))
  const candidateTags = (candidate.tags || []).map((tag) => normalizeText(tag))
  const sharedTags = candidateTags.filter((tag) => currentTags.has(tag))

  const currentTokens = tokenize(`${current.title} ${current.description} ${(current.tags || []).join(' ')}`)
  const candidateTokens = tokenize(`${candidate.title} ${candidate.description} ${(candidate.tags || []).join(' ')}`)
  const tokenOverlap = countOverlap(currentTokens, candidateTokens)

  let recommendationScore = 0
  const recommendationReasons: string[] = []

  if (candidate.category === current.category) {
    recommendationScore += 22
    recommendationReasons.push(current.categoryName)
  }

  if (sharedTags.length > 0) {
    recommendationScore += sharedTags.length * 16
    recommendationReasons.push(sharedTags.slice(0, 2).join(', '))
  }

  if (tokenOverlap > 0) {
    recommendationScore += Math.min(20, tokenOverlap * 4)
  }

  recommendationScore += dateScore(candidate.date)

  return {
    ...candidate,
    recommendationScore,
    recommendationReasons: [...new Set(recommendationReasons)].filter(Boolean),
  }
}

function byRecommendation(a: ArticleRecommendation, b: ArticleRecommendation): number {
  if (b.recommendationScore !== a.recommendationScore) {
    return b.recommendationScore - a.recommendationScore
  }
  return a.date < b.date ? 1 : -1
}

export function getSimilarArticles(
  articles: ArticleWithWordCount[],
  current: ArticleWithWordCount,
  limit = 4,
): ArticleRecommendation[] {
  return articles
    .filter((article) => article.slug !== current.slug)
    .map((article) => scoreCandidate(current, article))
    .filter((article) => article.recommendationScore >= 18)
    .sort(byRecommendation)
    .slice(0, limit)
}

export function getMoreInterestingArticles(
  articles: ArticleWithWordCount[],
  current: ArticleWithWordCount,
  excludeSlugs: string[] = [],
  limit = 6,
): ArticleRecommendation[] {
  const excluded = new Set([current.slug, ...excludeSlugs])
  const scored = articles
    .filter((article) => !excluded.has(article.slug))
    .map((article) => {
      const scoredArticle = scoreCandidate(current, article)
      const crossCategoryBonus = article.category === current.category ? 0 : 10
      return {
        ...scoredArticle,
        recommendationScore: scoredArticle.recommendationScore + crossCategoryBonus,
      }
    })
    .sort(byRecommendation)

  const crossCategory = scored.filter((article) => article.category !== current.category)
  const sameCategory = scored.filter((article) => article.category === current.category)

  return [...crossCategory, ...sameCategory].slice(0, limit)
}
