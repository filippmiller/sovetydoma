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
  // Editorial attribution (persona slug from src/lib/personas.ts)
  author?: string
}

export interface Article {
  frontmatter: ArticleFrontmatter
  content: string
  wordCount: number
}

function parseFile(fileName: string): { frontmatter: ArticleFrontmatter; content: string; wordCount: number } {
  const fullPath = path.join(articlesDirectory, fileName)
  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)
  const wordCount = content.trim().split(/\s+/).length
  return { frontmatter: data as ArticleFrontmatter, content, wordCount }
}

export function getAllArticles(): (ArticleFrontmatter & { wordCount: number })[] {
  const fileNames = fs.readdirSync(articlesDirectory).filter((f) => f.endsWith('.mdx'))
  return fileNames
    .map((f) => {
      const { frontmatter, wordCount } = parseFile(f)
      return { ...frontmatter, wordCount }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getArticlesByCategory(category: string): (ArticleFrontmatter & { wordCount: number })[] {
  return getAllArticles().filter((a) => a.category === category)
}

export function getArticle(category: string, slug: string): Article | null {
  const fileNames = fs.readdirSync(articlesDirectory).filter((f) => f.endsWith('.mdx'))
  for (const fileName of fileNames) {
    const { frontmatter, content, wordCount } = parseFile(fileName)
    if (frontmatter.slug === slug && frontmatter.category === category) {
      return { frontmatter, content, wordCount }
    }
  }
  return null
}

export function getAllSlugs(): { category: string; slug: string }[] {
  return fs.readdirSync(articlesDirectory)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => {
      const { frontmatter } = parseFile(f)
      return { category: frontmatter.category, slug: frontmatter.slug }
    })
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
