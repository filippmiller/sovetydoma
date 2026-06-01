export interface SearchableArticle {
  title: string
  description: string
  tags: string[]
  category: string
  categoryName: string
  slug: string
  date: string
  wordCount?: number
}

export type ScoredArticle<T extends SearchableArticle> = T & { score: number }

const STOP_WORDS = new Set([
  'а',
  'без',
  'бы',
  'в',
  'во',
  'для',
  'до',
  'за',
  'и',
  'из',
  'или',
  'как',
  'ко',
  'на',
  'над',
  'не',
  'о',
  'об',
  'от',
  'по',
  'под',
  'при',
  'про',
  'с',
  'со',
  'у',
  'что',
  'это',
])

const RUSSIAN_SUFFIXES = [
  'ться', 'тся', 'ся',
  'иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими',
  'иях', 'ах', 'ях', 'ов', 'ев', 'ей', 'ой', 'ый', 'ий', 'ая', 'яя',
  'ое', 'ее', 'ые', 'ие', 'ую', 'юю', 'ом', 'ем', 'ам', 'ям', 'ах',
  'ях', 'а', 'я', 'ы', 'и', 'у', 'ю', 'е', 'о',
]

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stemSearchToken(token: string): string {
  const clean = normalizeText(token).replace(/[-ьъ]/g, '')
  if (clean.length <= 4) return clean

  for (const suffix of RUSSIAN_SUFFIXES) {
    if (clean.endsWith(suffix) && clean.length - suffix.length >= 4) {
      return clean.slice(0, -suffix.length)
    }
  }

  return clean
}

export function tokenizeSearchQuery(query: string): string[] {
  const tokens = normalizeText(query)
    .split(/\s+/)
    .map(stemSearchToken)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))

  return Array.from(new Set(tokens))
}

function articleHaystack(article: SearchableArticle): {
  title: string
  description: string
  tags: string
  category: string
  all: string
} {
  const title = normalizeText(article.title)
  const description = normalizeText(article.description)
  const tags = normalizeText(article.tags.join(' '))
  const category = normalizeText(`${article.categoryName} ${article.category}`)
  const all = `${title} ${description} ${tags} ${category}`
  return { title, description, tags, category, all }
}

function stemmedHaystack(value: string): string[] {
  return Array.from(new Set(
    value
      .split(/\s+/)
      .map(stemSearchToken)
      .filter((token) => token.length >= 3),
  ))
}

export function scoreArticle(article: SearchableArticle, query: string): number {
  const queryTokens = tokenizeSearchQuery(query)
  if (queryTokens.length === 0) return 0

  const haystack = articleHaystack(article)
  const stems = stemmedHaystack(haystack.all)
  let score = 0

  for (const token of queryTokens) {
    if (haystack.title.includes(token)) score += 24
    if (haystack.tags.includes(token)) score += 20
    if (haystack.description.includes(token)) score += 12
    if (haystack.category.includes(token)) score += 5

    if (stems.includes(token)) score += 12
    else if (stems.some((stem) => stem.includes(token) || token.includes(stem))) score += 7
  }

  const matched = queryTokens.filter((token) => haystack.all.includes(token) || stems.some((stem) => stem.includes(token) || token.includes(stem)))
  if (matched.length === queryTokens.length) score += 15
  if (haystack.title.includes(normalizeText(query))) score += 30

  return score
}

export function searchArticles<T extends SearchableArticle>(articles: T[], query: string, limit?: number): ScoredArticle<T>[] {
  const results = articles
    .map((article) => ({ ...article, score: scoreArticle(article, query) }))
    .filter((article) => article.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.date) - Date.parse(a.date))

  return typeof limit === 'number' ? results.slice(0, limit) : results
}
