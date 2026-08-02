// Curated topic themes per category, matched against each article's raw tags
// by keyword. Raw tags are frequency-sorted noise (specific plants, materials,
// months) that mixes topics/objects/formats; themes group them into something
// a reader can actually navigate by. A category with no entry here falls back
// to the old top-N-by-frequency tag pills (see uniqueTags in
// CategoryArticleBrowser) — this is additive, not a replacement that needs to
// cover every category on day one.
export interface CategoryTheme {
  label: string
  keywords: string[]
}

export const CATEGORY_THEMES: Record<string, CategoryTheme[]> = {
  'dacha-i-ogorod': [
    { label: 'Огород и овощи', keywords: ['огород', 'овощ', 'огурц', 'помидор', 'томат', 'картош', 'картофел', 'морков', 'лук', 'чеснок', 'капуст', 'редис', 'свекл', 'перец', 'баклажан', 'тыкв', 'кабачк', 'зелень', 'укроп', 'петрушк', 'базилик', 'грядк', 'посев', 'посадк', 'открытый грунт'] },
    { label: 'Сад и деревья', keywords: ['сад', 'дерев', 'яблон', 'груш', 'вишн', 'смородин', 'малин', 'крыжовник', 'виноград', 'плодов', 'обрезк', 'прививк', 'саженец', 'саженц', 'живая изгородь', 'куст', 'роз', 'цвет', 'газон', 'ландшафт', 'клубник', 'земляник', 'гортензи', 'туя'] },
    { label: 'Рассада', keywords: ['рассад', 'пикировк', 'кассет', 'торфян', 'подсветк', 'прораст', 'семен', 'подоконник'] },
    { label: 'Теплицы', keywords: ['теплиц', 'поликарбонат', 'парник'] },
    { label: 'Болезни и вредители', keywords: ['вредител', 'болезн', 'тля', 'клещ', 'гниль', 'фитофтор', 'мучнист', 'слизн', 'медведк', 'колорад', 'муравь', 'жук', 'ловушк', 'защита растени', 'защита урожая'] },
    { label: 'Полив и удобрения', keywords: ['полив', 'удобрен', 'подкормк', 'компост', 'перегно', 'зола', 'органик', 'капельный полив', 'дождевая вода', 'мульч'] },
    { label: 'Постройки и ремонт', keywords: ['сарай', 'веранд', 'крыш', 'фундамент', 'брус', 'вагонк', 'сайдинг', 'герметик', 'окно', 'окна', 'двер', 'утеплен', 'стройк', 'ремонт', 'дачные постройки', 'бытовк', 'туалет', 'погреб', 'крыльцо', 'террас', 'забор', 'пол ', 'фронтон', 'мансард'] },
    { label: 'Заготовки урожая', keywords: ['хранение', 'заготовк', 'консерв', 'солени', 'заморозк', 'сушк', 'долгое хранение', 'сбор урожая', 'урожайност'] },
    { label: 'Инструменты и техника', keywords: ['инструмент', 'мотоблок', 'культиватор', 'секатор', 'лопат', 'тачк', 'садовый инструмент', 'аэратор'] },
    { label: 'Сезонные работы', keywords: ['весна', 'осень', 'зима', 'лето', 'подготовка к зиме', 'весенн', 'осенн', 'зимовк', 'лунный календарь', 'сезон'] },
  ],
}

/**
 * Buckets a category's articles into curated themes by keyword-matching each
 * article's tags. An article can land in more than one theme (same as the
 * old tag-pill filter, where one article could carry several tags). Themes
 * with zero matching articles are dropped so the pill row never shows a dead
 * end.
 */
export function themesForCategory<T extends { tags?: string[] }>(
  category: string,
  articles: T[],
): { label: string; articles: T[] }[] {
  const defs = CATEGORY_THEMES[category]
  if (!defs) return []

  return defs
    .map((theme) => {
      const matched = articles.filter((article) =>
        (article.tags || []).some((tag) => {
          const t = tag.toLowerCase()
          return theme.keywords.some((kw) => t.includes(kw))
        }),
      )
      return { label: theme.label, articles: matched }
    })
    .filter((theme) => theme.articles.length > 0)
}
