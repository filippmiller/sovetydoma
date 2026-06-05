// Editorial profiles shown on articles and author pages.

export interface Persona {
  slug: string
  name: string
  role: string
  bio: string
  icon: string
  categories: string[]
  contact: string
}

export const PERSONAS: Persona[] = [
  {
    slug: 'maryana-sidorova',
    name: 'Марьяна Сидорова',
    role: 'Редактор разделов «Дом и уборка» и «Кулинария»',
    bio: 'Курирует материалы по дому, уборке, рецептам и заготовкам. Любит порядок, простые рецепты и проверенные бытовые советы.',
    icon: '🏡',
    categories: ['dom-i-uborka', 'kulinaria', 'krasota-i-uhod'],
    contact: 'maryana.sidorova@1001sovet.ru',
  },
  {
    slug: 'petr-pupkin',
    name: 'Пётр Пупкин',
    role: 'Редактор раздела «Лайфхаки»',
    bio: 'Отвечает за мелкий ремонт, инструменты и бытовые лайфхаки. Считает, что почти всё можно починить своими руками.',
    icon: '🔧',
    categories: ['layfkhaki', 'zdorovie-i-bezopasnost', 'pokupki-i-tehnika'],
    contact: 'petr.pupkin@1001sovet.ru',
  },
  {
    slug: 'petr-ivanov',
    name: 'Пётр Иванов',
    role: 'Редактор разделов «Дача и огород» и «Экономия»',
    bio: 'Пишет про дачу и огород, технику и разумную экономию. Любит считать бюджет и планировать сезонные работы.',
    icon: '🚜',
    categories: ['dacha-i-ogorod', 'ekonomiya', 'semya-i-deti', 'otdyh-i-puteshestviya'],
    contact: 'peter.ivanov@1001sovet.ru',
  },
  {
    slug: 'andrey-rybak',
    name: 'Андрей Рыбаков',
    role: 'Редактор раздела «Рыбалка»',
    bio: 'Разбирается в снастях, наживках и сезонах клёва. Любит тихие зори на берегу и делится проверенными приёмами ловли.',
    icon: '🎣',
    categories: ['rybalka'],
    contact: 'andrey.rybakov@1001sovet.ru',
  },
]

const BY_SLUG = new Map(PERSONAS.map((p) => [p.slug, p]))

/**
 * Resolve the editorial profile for an article. An explicit `author` slug in
 * frontmatter wins; otherwise fall back to the profile that curates the
 * article's category; otherwise the first profile.
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
