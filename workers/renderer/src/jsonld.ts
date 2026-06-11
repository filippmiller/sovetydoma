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
}

// Mirrors src/lib/personas.ts PERSONAS array (category→persona mapping).
// Keep in sync if personas.ts changes.
const PERSONA_BY_CATEGORY: Record<string, PersonaInfo> = {
  'dom-i-uborka':          { slug: 'maryana-sidorova', name: 'Марьяна Сидорова', role: 'Редактор разделов «Дом и уборка» и «Кулинария»' },
  kulinaria:               { slug: 'maryana-sidorova', name: 'Марьяна Сидорова', role: 'Редактор разделов «Дом и уборка» и «Кулинария»' },
  'krasota-i-uhod':        { slug: 'maryana-sidorova', name: 'Марьяна Сидорова', role: 'Редактор разделов «Дом и уборка» и «Кулинария»' },
  layfkhaki:               { slug: 'petr-pupkin',      name: 'Пётр Пупкин',      role: 'Редактор раздела «Лайфхаки»' },
  'zdorovie-i-bezopasnost':{ slug: 'petr-pupkin',      name: 'Пётр Пупкин',      role: 'Редактор раздела «Лайфхаки»' },
  'pokupki-i-tehnika':     { slug: 'petr-pupkin',      name: 'Пётр Пупкин',      role: 'Редактор раздела «Лайфхаки»' },
  'dacha-i-ogorod':        { slug: 'petr-ivanov',      name: 'Пётр Иванов',      role: 'Редактор разделов «Дача и огород» и «Экономия»' },
  ekonomiya:               { slug: 'petr-ivanov',      name: 'Пётр Иванов',      role: 'Редактор разделов «Дача и огород» и «Экономия»' },
  'semya-i-deti':          { slug: 'petr-ivanov',      name: 'Пётр Иванов',      role: 'Редактор разделов «Дача и огород» и «Экономия»' },
  'otdyh-i-puteshestviya': { slug: 'petr-ivanov',      name: 'Пётр Иванов',      role: 'Редактор разделов «Дача и огород» и «Экономия»' },
  rybalka:                 { slug: 'andrey-rybak',     name: 'Андрей Рыбаков',   role: 'Редактор раздела «Рыбалка»' },
  avto:                    { slug: 'igor-kolesnikov',  name: 'Игорь Колесников', role: 'Редактор раздела «Авто»' },
}

const DEFAULT_PERSONA: PersonaInfo = {
  slug: 'maryana-sidorova',
  name: 'Марьяна Сидорова',
  role: 'Редактор разделов «Дом и уборка» и «Кулинария»',
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

export function buildJsonLd(row: ArticleRow): { article: object; breadcrumb: object } {
  const url = `${SITE_URL}/${row.category}/${row.slug}/`
  const imageUrl = `${SITE_URL}/images/${row.image_filename ?? row.slug + '.jpg'}`
  const datePublished = row.published_at.slice(0, 10) // ISO date
  const dateModified = (row.updated_at ?? row.published_at).slice(0, 10)

  const fm = row.frontmatter as Record<string, string | undefined>
  const persona = resolvePersona(fm.author, row.category)
  const authorUrl = `${SITE_URL}/author/${persona.slug}/`
  const categoryName = CATEGORY_NAMES[row.category] ?? fm.categoryName ?? row.category
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

  return { article, breadcrumb }
}
