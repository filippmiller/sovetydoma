// NO-REDEPLOY publishing: this worker makes article publishing rebuild-free.
// See docs/NO-REDEPLOY-PUBLISHING.md

/**
 * JSON-LD schema builders — replicate the exact shape from page.tsx lines ~205-244.
 */

const SITE_URL = 'https://1001sovet.ru'
const SITE_NAME = 'СоветыДома'

export interface PersonaInfo {
  name: string
  slug: string
  role: string
  icon: string
}

// Mirrors src/lib/personas.ts PERSONAS array (category→persona mapping).
// Keep in sync if personas.ts changes.
const PERSONA_BY_CATEGORY: Record<string, PersonaInfo> = {
  'dom-i-uborka':          { slug: 'maryana-sidorova', name: 'Марьяна Сидорова', role: 'Редактор разделов «Дом и уборка» и «Кулинария»', icon: '🏡' },
  kulinaria:               { slug: 'maryana-sidorova', name: 'Марьяна Сидорова', role: 'Редактор разделов «Дом и уборка» и «Кулинария»', icon: '🏡' },
  'krasota-i-uhod':        { slug: 'maryana-sidorova', name: 'Марьяна Сидорова', role: 'Редактор разделов «Дом и уборка» и «Кулинария»', icon: '🏡' },
  layfkhaki:               { slug: 'aleksey-morozov',  name: 'Алексей Морозов',  role: 'Редактор разделов «Лайфхаки», «Здоровье и безопасность» и «Покупки и техника»', icon: '✍️' },
  'zdorovie-i-bezopasnost':{ slug: 'aleksey-morozov',  name: 'Алексей Морозов',  role: 'Редактор разделов «Лайфхаки», «Здоровье и безопасность» и «Покупки и техника»', icon: '✍️' },
  'pokupki-i-tehnika':     { slug: 'aleksey-morozov',  name: 'Алексей Морозов',  role: 'Редактор разделов «Лайфхаки», «Здоровье и безопасность» и «Покупки и техника»', icon: '✍️' },
  'dacha-i-ogorod':        { slug: 'petr-ivanov',      name: 'Пётр Иванов',      role: 'Редактор разделов «Дача и огород» и «Экономия»', icon: '🚜' },
  ekonomiya:               { slug: 'petr-ivanov',      name: 'Пётр Иванов',      role: 'Редактор разделов «Дача и огород» и «Экономия»', icon: '🚜' },
  'semya-i-deti':          { slug: 'petr-ivanov',      name: 'Пётр Иванов',      role: 'Редактор разделов «Дача и огород» и «Экономия»', icon: '🚜' },
  'otdyh-i-puteshestviya': { slug: 'petr-ivanov',      name: 'Пётр Иванов',      role: 'Редактор разделов «Дача и огород» и «Экономия»', icon: '🚜' },
  rybalka:                 { slug: 'andrey-rybak',     name: 'Андрей Рыбаков',   role: 'Редактор раздела «Рыбалка»', icon: '🎣' },
  avto:                    { slug: 'igor-kolesnikov',  name: 'Игорь Колесников', role: 'Редактор раздела «Авто»', icon: '🚗' },
}

const DEFAULT_PERSONA: PersonaInfo = {
  slug: 'maryana-sidorova',
  name: 'Марьяна Сидорова',
  role: 'Редактор разделов «Дом и уборка» и «Кулинария»',
  icon: '🏡',
}

export function resolvePersona(author: string | undefined, category: string): PersonaInfo {
  if (author && PERSONA_BY_CATEGORY[author]) return PERSONA_BY_CATEGORY[author]
  return PERSONA_BY_CATEGORY[category] ?? DEFAULT_PERSONA
}

export interface ArticleRow {
  slug: string
  category: string
  title: string
  description: string
  body_md: string | null
  tags: string[]
  image_filename: string | null
  frontmatter: Record<string, unknown>
  published_at: string
  updated_at: string | null
  word_count: number
}

// Replaced media must get a new immutable URL. Reusing the old R2 key leaves
// the previous image visible in browsers and CDNs for up to a year.
const IMAGE_REPLACEMENTS: Record<string, string> = {
  'kak-snizit-davlenie-za-10-minut-bez-tabletok':
    'kak-snizit-davlenie-za-10-minut-bez-tabletok-no-person.jpg',
}

export function articleImageFilename(row: ArticleRow): string {
  return IMAGE_REPLACEMENTS[row.slug] ?? row.image_filename ?? `${row.slug}.jpg`
}

// Category display names — mirrors src/lib/categories.mjs
export const CATEGORY_NAMES: Record<string, string> = {
  kulinaria:               'Кулинария',
  'dom-i-uborka':          'Дом и уборка',
  'dacha-i-ogorod':        'Дача и огород',
  layfkhaki:               'Лайфхаки',
  ekonomiya:               'Экономия',
  rybalka:                 'Рыбалка',
  'zdorovie-i-bezopasnost':'Здоровье и безопасность',
  'semya-i-deti':          'Семья и дети',
  'krasota-i-uhod':        'Красота и уход',
  'otdyh-i-puteshestviya': 'Отдых и путешествия',
  'pokupki-i-tehnika':     'Покупки и техника',
  avto:                    'Авто',
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*`>_~]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function extractAnswerText(content: string, startLine: number): string {
  const lines = content.split('\n')
  const bodyLines: string[] = []
  for (let j = startLine + 1; j < lines.length; j++) {
    if (/^#{1,6} /.test(lines[j])) break
    bodyLines.push(lines[j])
  }
  return bodyLines
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => stripMarkdownInline(p))
    .filter((p) => p.length > 0)
    .join(' ')
}

function buildFaqSchema(body: string): object | null {
  const entities: { '@type': string; name: string; acceptedAnswer: { '@type': string; text: string } }[] = []
  const lines = body.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^#{2,3} (.+)$/)
    if (!match) continue
    const heading = match[1].trim()
    if (!heading.endsWith('?')) continue
    const answer = extractAnswerText(body, i)
    if (answer) {
      entities.push({ '@type': 'Question', name: heading, acceptedAnswer: { '@type': 'Answer', text: answer } })
    }
  }
  return entities.length >= 2 ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: entities } : null
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return []
}

function looksLikeInstructional(content: string): boolean {
  const h2s = [...content.matchAll(/^## (.+)$/gm)]
  if (h2s.length >= 3) return true
  const numbered = [...content.matchAll(/^## \d+[\.)]?\s+/gm)]
  if (numbered.length >= 2) return true
  return false
}

function buildHowToSteps(body: string, recipeSteps?: string[]): Array<{ '@type': string; position: number; name: string }> {
  if (recipeSteps && recipeSteps.length > 0) {
    return recipeSteps.map((step, i) => ({ '@type': 'HowToStep', position: i + 1, name: step.trim() }))
  }
  const headings = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())
  if (headings.length === 0) return []
  return headings.map((name, i) => ({ '@type': 'HowToStep', position: i + 1, name }))
}

function isoDurationFromHuman(time?: string): string | undefined {
  if (!time) return undefined
  const minutes = /(\d+)\s*мин/i.exec(time)
  const hours = /(\d+)\s*ч/i.exec(time)
  if (!minutes && !hours) return undefined
  let iso = 'PT'
  if (hours) iso += `${hours[1]}H`
  if (minutes) iso += `${minutes[1]}M`
  return iso
}

export function buildJsonLd(row: ArticleRow): { article: object; breadcrumb: object; extra: object[] } {
  const url = `${SITE_URL}/${row.category}/${row.slug}/`
  const imageUrl = `${SITE_URL}/images/${articleImageFilename(row)}`
  const datePublished = row.published_at.slice(0, 10) // ISO date
  const dateModified = (row.updated_at ?? row.published_at).slice(0, 10)

  const fm = row.frontmatter as Record<string, unknown>
  const persona = resolvePersona(typeof fm.author === 'string' ? fm.author : undefined, row.category)
  const authorUrl = `${SITE_URL}/author/${persona.slug}/`
  const categoryName = CATEGORY_NAMES[row.category] ?? (typeof fm.categoryName === 'string' ? fm.categoryName : row.category)
  const wordCount = row.word_count ?? 0

  const article = {
    '@context': 'https://schema.org',
    '@type': ['Article', 'NewsArticle'],
    headline: row.title,
    description: row.description,
    url,
    datePublished,
    dateModified,
    image: [{ '@type': 'ImageObject', url: imageUrl, width: 1280, height: 960 }],
    thumbnailUrl: imageUrl,
    author: {
      '@type': 'Person',
      name: persona.name,
      url: authorUrl,
      jobTitle: persona.role,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    keywords: row.tags.join(', '),
    articleSection: categoryName,
    inLanguage: 'ru-RU',
    isAccessibleForFree: true,
    wordCount,
    timeRequired: `PT${Math.max(1, Math.round(wordCount / 180))}M`,
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: categoryName, item: `${SITE_URL}/${row.category}/` },
      { '@type': 'ListItem', position: 3, name: row.title, item: url },
    ],
  }

  const extra: object[] = []
  const body = row.body_md ?? ''
  const schemaType = typeof fm.schemaType === 'string' ? fm.schemaType : undefined
  const recipeSteps = readStringArray(fm.recipeSteps)
  const howToSteps = buildHowToSteps(body, recipeSteps)

  if (schemaType === 'Recipe') {
    const ingredients = readStringArray(fm.recipeIngredient)
    extra.push({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: row.title,
      description: row.description,
      author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      datePublished,
      image: imageUrl,
      prepTime: typeof fm.prepTime === 'string' ? fm.prepTime : undefined,
      cookTime: typeof fm.cookTime === 'string' ? fm.cookTime : undefined,
      recipeYield: typeof fm.recipeYield === 'string' ? fm.recipeYield : undefined,
      recipeIngredient: ingredients,
      recipeInstructions: howToSteps,
      keywords: row.tags.join(', '),
      inLanguage: 'ru-RU',
    })
  }

  if (schemaType === 'HowTo' || (howToSteps.length >= 3 && looksLikeInstructional(body))) {
    const time = typeof fm.time === 'string' ? fm.time : undefined
    const howTo: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: row.title,
      description: row.description,
      image: imageUrl,
      step: howToSteps,
      inLanguage: 'ru-RU',
    }
    const totalTime = isoDurationFromHuman(time)
    if (totalTime) howTo.totalTime = totalTime
    extra.push(howTo)
  }

  const faq = buildFaqSchema(body)
  if (faq) extra.push(faq)

  return { article, breadcrumb, extra }
}
