// Editorial personas (AI-assisted virtual curators).
// IMPORTANT: these are NOT presented as real humans. Each carries an explicit
// disclosure string and the role wording makes the virtual/AI nature clear.

export interface Persona {
  slug: string
  name: string
  role: string            // e.g. "Виртуальный редактор раздела «Дом и хозяйство»"
  bio: string
  icon: string            // emoji avatar fallback
  categories: string[]    // category slugs this persona curates
  contact: string         // email alias
  disclosure: string      // shown verbatim near attribution
}

const DISCLOSURE = 'AI-ассистированный виртуальный редактор. Материалы проверяются на практике, но автор — не реальный человек.'

export const PERSONAS: Persona[] = [
  {
    slug: 'maryana-sidorova',
    name: 'Марьяна Сидорова',
    role: 'Виртуальный редактор раздела «Дом и хозяйство»',
    bio: 'Курирует материалы по дому, уборке, рецептам и заготовкам. Любит порядок, простые рецепты и проверенные бытовые лайфхаки.',
    icon: '🏡',
    categories: ['dom-i-uborka', 'kulinaria'],
    contact: 'maryana@sovetydoma.ru',
    disclosure: DISCLOSURE,
  },
  {
    slug: 'petr-pupkin',
    name: 'Пётр Пупкин',
    role: 'Виртуальный редактор раздела «Ремонт и лайфхаки»',
    bio: 'Отвечает за мелкий ремонт, инструменты и бытовые лайфхаки. Считает, что почти всё можно починить своими руками.',
    icon: '🔧',
    categories: ['layfkhaki'],
    contact: 'petr.pupkin@sovetydoma.ru',
    disclosure: DISCLOSURE,
  },
  {
    slug: 'petr-ivanov',
    name: 'Пётр Иванов',
    role: 'Виртуальный редактор раздела «Дача, техника и экономия»',
    bio: 'Пишет про дачу и огород, технику и разумную экономию. Любит считать бюджет и планировать сезонные работы.',
    icon: '🚜',
    categories: ['dacha-i-ogorod', 'ekonomiya'],
    contact: 'petr.ivanov@sovetydoma.ru',
    disclosure: DISCLOSURE,
  },
]

const BY_SLUG = new Map(PERSONAS.map((p) => [p.slug, p]))

/**
 * Resolve the persona for an article. An explicit `author` slug in frontmatter
 * wins; otherwise fall back to the persona that curates the article's category;
 * otherwise the first persona. Always returns a persona so attribution renders.
 */
export function resolvePersona(opts: { author?: string; category?: string }): Persona {
  if (opts.author && BY_SLUG.has(opts.author)) return BY_SLUG.get(opts.author)!
  if (opts.category) {
    const byCat = PERSONAS.find((p) => p.categories.includes(opts.category!))
    if (byCat) return byCat
  }
  return PERSONAS[0]
}

export function getPersona(slug: string): Persona | null {
  return BY_SLUG.get(slug) ?? null
}
