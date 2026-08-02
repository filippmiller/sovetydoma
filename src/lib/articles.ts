import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
export { CATEGORIES } from './categories'

const articlesDirectory = path.join(process.cwd(), 'src/content/articles')

export interface ArticleFrontmatter {
  title: string
  slug: string
  category: string
  categoryName: string
  description: string
  date: string
  updated?: string
  image: string
  tags: string[]
  // Monetisation
  sponsored?: boolean        // marks article as sponsored/partner content
  // Optional schema.org fields
  schemaType?: 'Recipe' | 'HowTo'
  prepTime?: string   // ISO 8601 e.g. PT20M
  cookTime?: string   // ISO 8601 e.g. PT90M
  recipeYield?: string
  recipeIngredient?: string[]
  recipeSteps?: string[]
  difficulty?: 'Легко' | 'Средне' | 'Сложно'
  cost?: string  // e.g. "~300 ₽" or "бесплатно"
  // Series navigation
  seriesName?: string
  seriesOrder?: number
  // Quick-answer block (all optional; block renders only when data/derivable)
  quickAnswer?: string     // 1–3 sentence "краткий ответ"
  time?: string            // human time, e.g. "2–3 часа"
  needs?: string[]         // "что понадобится"
  forWhom?: string         // "для кого подходит"
  // Seasonal relevance (1 = January … 12 = December)
  seasonalMonths?: number[]
  // Editorial attribution (persona slug from src/lib/personas.ts)
  author?: string
}

export interface Article {
  frontmatter: ArticleFrontmatter
  content: string
  wordCount: number
}

function parseFile(fileName: string): Article {
  const fullPath = path.join(articlesDirectory, fileName)
  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)
  const wordCount = content.trim().split(/\s+/).length
  return { frontmatter: data as ArticleFrontmatter, content, wordCount }
}

/**
 * Module-level cache. `getAllArticles`/`getArticle` were each doing a full
 * readdir + readFileSync + gray-matter parse over every .mdx file on EVERY
 * call (and were called from 15+ places, twice per article page). With ~486
 * articles that is hundreds of thousands of redundant disk reads per build.
 * We parse the corpus exactly once and serve all reads from memory. The Node
 * module cache persists for the lifetime of the build process.
 */
interface ArticleCache {
  sorted: (ArticleFrontmatter & { wordCount: number })[]
  byKey: Map<string, Article>
}

let _cache: ArticleCache | null = null

function articleKey(category: string, slug: string): string {
  return `${category}/${slug}`
}

function loadCache(): ArticleCache {
  if (_cache) return _cache
  const fileNames = fs.readdirSync(articlesDirectory).filter((f) => f.endsWith('.mdx'))
  const byKey = new Map<string, Article>()
  const list: (ArticleFrontmatter & { wordCount: number })[] = []
  for (const fileName of fileNames) {
    const article = parseFile(fileName)
    byKey.set(articleKey(article.frontmatter.category, article.frontmatter.slug), article)
    list.push({ ...article.frontmatter, wordCount: article.wordCount })
  }
  const sorted = list.sort((a, b) => (a.date < b.date ? 1 : -1))
  _cache = { sorted, byKey }
  return _cache
}

export function getAllArticles(): (ArticleFrontmatter & { wordCount: number })[] {
  // Return a shallow copy so callers can sort/filter/reverse in place without
  // corrupting the shared cache. The copy is cheap; the parse it avoids is not.
  return loadCache().sorted.slice()
}

export function getArticlesByCategory(category: string): (ArticleFrontmatter & { wordCount: number })[] {
  return getAllArticles().filter((a) => a.category === category)
}

/**
 * "Только что" homepage widget: the plain newest-first list is dominated by
 * whichever category happens to publish most often (e.g. a batch of Avto
 * articles), so a reader interested in other sections never sees them on the
 * homepage. Round-robin across categories within the most recent `poolSize`
 * articles instead, then re-sort the picks by actual date so the widget still
 * reads top-to-bottom as "most recent first" — just mixed across sections.
 */
export function getJustNowArticles(limit = 8, poolSize = 60): (ArticleFrontmatter & { wordCount: number })[] {
  const pool = getAllArticles().slice(0, poolSize)
  const queues = new Map<string, (ArticleFrontmatter & { wordCount: number })[]>()
  for (const article of pool) {
    const queue = queues.get(article.category)
    if (queue) queue.push(article)
    else queues.set(article.category, [article])
  }
  const queueList = Array.from(queues.values())
  const picked: (ArticleFrontmatter & { wordCount: number })[] = []
  for (let round = 0; picked.length < limit && round < poolSize; round++) {
    let addedInRound = false
    for (const queue of queueList) {
      if (picked.length >= limit) break
      const article = queue[round]
      if (article) {
        picked.push(article)
        addedInRound = true
      }
    }
    if (!addedInRound) break
  }
  return picked.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getArticle(category: string, slug: string): Article | null {
  return loadCache().byKey.get(articleKey(category, slug)) ?? null
}

export function getAllSlugs(): { category: string; slug: string }[] {
  return getAllArticles().map((a) => ({ category: a.category, slug: a.slug }))
}

export function getAllTags(): { tag: string; count: number }[] {
  const tagCount: Record<string, number> = {}
  getAllArticles().forEach((a) => {
    a.tags.forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1 })
  })
  return Object.entries(tagCount)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Articles that were reclassified into new top-level categories (for URL redirects).
 * Old /oldcat/slug/ should 301/soft-redirect to /newcat/slug/ to avoid dead links.
 */
export const LEGACY_ARTICLE_MOVES: Record<string, { oldCategory: string; newCategory: string }> = {
  // zdorovie-i-bezopasnost
  'bezopasnost-doma-dlya-rebenka': { oldCategory: 'layfkhaki', newCategory: 'zdorovie-i-bezopasnost' },
  'domashnyaya-aptechka-bez-lishnego': { oldCategory: 'layfkhaki', newCategory: 'zdorovie-i-bezopasnost' },
  'bezopasnaya-zaryadka-telefona-nochyu': { oldCategory: 'layfkhaki', newCategory: 'zdorovie-i-bezopasnost' },
  'hranenie-lekarstv-doma': { oldCategory: 'layfkhaki', newCategory: 'zdorovie-i-bezopasnost' },
  'les-bezopasnost': { oldCategory: 'layfkhaki', newCategory: 'zdorovie-i-bezopasnost' },
  'kleshchi-zashchita': { oldCategory: 'layfkhaki', newCategory: 'zdorovie-i-bezopasnost' },
  'mini-remont-bez-instrumentov': { oldCategory: 'layfkhaki', newCategory: 'zdorovie-i-bezopasnost' },
  'apteka-dlya-dachi': { oldCategory: 'dacha-i-ogorod', newCategory: 'zdorovie-i-bezopasnost' },
  'bezopasnost-na-ldu-rybalka': { oldCategory: 'rybalka', newCategory: 'zdorovie-i-bezopasnost' },
  // semya-i-deti
  'spisok-pokupok-dlya-semi': { oldCategory: 'ekonomiya', newCategory: 'semya-i-deti' },
  'ekonomiya-na-shkolnyh-tovarah': { oldCategory: 'ekonomiya', newCategory: 'semya-i-deti' },
  'kak-sobrat-rebenka-v-lager': { oldCategory: 'layfkhaki', newCategory: 'semya-i-deti' },
  'shkolnyy-ugolok-doma': { oldCategory: 'layfkhaki', newCategory: 'semya-i-deti' },
  'semeynyy-kalendar-na-holodilnike': { oldCategory: 'layfkhaki', newCategory: 'semya-i-deti' },
  'poryadok-v-igrushkah': { oldCategory: 'layfkhaki', newCategory: 'semya-i-deti' },
  'kak-hranit-shkolnye-tetradi': { oldCategory: 'dom-i-uborka', newCategory: 'semya-i-deti' },
  // otdyh-i-puteshestviya
  'dorozhnaya-sumka-za-20-minut': { oldCategory: 'layfkhaki', newCategory: 'otdyh-i-puteshestviya' },
  'ekonomnyy-otpusk': { oldCategory: 'ekonomiya', newCategory: 'otdyh-i-puteshestviya' },
  'letniy-cheklist-pered-otpuskom': { oldCategory: 'layfkhaki', newCategory: 'otdyh-i-puteshestviya' },
  // pokupki-i-tehnika
  'pokupki-bez-pereplat': { oldCategory: 'ekonomiya', newCategory: 'pokupki-i-tehnika' },
  'sravnenie-tsen-pered-pokupkoy': { oldCategory: 'ekonomiya', newCategory: 'pokupki-i-tehnika' },
  'telefon-v-zharkuyu-pogodu': { oldCategory: 'layfkhaki', newCategory: 'pokupki-i-tehnika' },
  'sel-telefon': { oldCategory: 'layfkhaki', newCategory: 'pokupki-i-tehnika' },
  'zaryadka-telefona-layfhaki': { oldCategory: 'layfkhaki', newCategory: 'pokupki-i-tehnika' },
  'markirovka-provodov-i-zaryadok': { oldCategory: 'layfkhaki', newCategory: 'pokupki-i-tehnika' },
  'keshbek-bonusy': { oldCategory: 'ekonomiya', newCategory: 'pokupki-i-tehnika' },
  'kak-vybrat-udlinitel-dlya-doma': { oldCategory: 'ekonomiya', newCategory: 'pokupki-i-tehnika' },
  'kak-vybrat-shurupovert-dlya-doma': { oldCategory: 'ekonomiya', newCategory: 'pokupki-i-tehnika' },
  'kak-hranit-bytovuyu-tehniku': { oldCategory: 'dom-i-uborka', newCategory: 'pokupki-i-tehnika' },
  'kak-vybrat-nastolnuyu-lampu': { oldCategory: 'ekonomiya', newCategory: 'pokupki-i-tehnika' },
  // krasota-i-uhod
  'staticheskoe-elektrichestvo': { oldCategory: 'layfkhaki', newCategory: 'krasota-i-uhod' },
  'zapah-iz-obuvi': { oldCategory: 'dom-i-uborka', newCategory: 'krasota-i-uhod' },
  'vysushit-obuv': { oldCategory: 'layfkhaki', newCategory: 'krasota-i-uhod' },
  'krossovki-otmyt': { oldCategory: 'dom-i-uborka', newCategory: 'krasota-i-uhod' },
  'uhod-za-kozhanym-divanom': { oldCategory: 'dom-i-uborka', newCategory: 'krasota-i-uhod' },
  'kak-sushit-odezhdu-v-kvartire': { oldCategory: 'layfkhaki', newCategory: 'krasota-i-uhod' },
  'ubrat-sherst-s-divana-i-kovra': { oldCategory: 'dom-i-uborka', newCategory: 'krasota-i-uhod' },
}
