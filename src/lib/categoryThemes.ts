// Curated topic themes per category, matched against each article's raw tags
// by keyword. Themes are derived from SUBCATEGORIES (see categories.mjs) and
// enriched with keywords for tag matching. A category with no entry here falls
// back to the old top-N-by-frequency tag pills (see uniqueTags in
// CategoryArticleBrowser).
import { getSubcategoriesFor } from './categories.mjs'

export interface CategoryTheme {
  label: string
  slug: string
  keywords: string[]
}

// Keyword mappings for subcategories — used to match article tags to subcategories.
// Each subcategory slug maps to an array of keywords that appear in article tags.
const SUBCATEGORY_KEYWORDS: Record<string, string[]> = {
  // Кулинария
  supy: ['суп', 'борщ', 'бульон', 'супы', 'щи', 'солянка', 'окрошка', 'харчо', 'минестрон', 'крем-суп', 'пюре суп'],
  'goryachie-blyuda': ['мяс', 'куриц', 'говяд', 'свин', 'баран', 'рыб', 'гарнир', 'жарк', 'тушен', 'запекан', 'котлет', 'голубц', 'плов', 'рагу', 'стейк', 'горяч'],
  'salaty-i-zakuski': ['салат', 'закус', 'канап', 'бутерброд', 'рулет', 'начинк', 'оливье', 'цезарь', 'винегрет'],
  'vypechka-deserty': ['пирог', 'торт', 'печен', 'десерт', 'выпечк', 'кекс', 'маффин', 'блин', 'олад', 'сладк', 'штрудель', 'чизкейк', 'панакот', 'желе', 'мусс', 'крем'],
  napitki: ['напиток', 'чай', 'кофе', 'компот', 'морс', 'сок', 'смузи', 'коктейль', 'кисель', 'какао', 'горячий шоколад', 'лимонад', 'квас'],
  zagotovki: ['заготовк', 'консерв', 'солени', 'варень', 'маринов', 'заморозк', 'сушк', 'закатк', 'хрен', 'аджик'],
  'zdorovaya-eda': ['пп', 'правильн питан', 'здоров', 'диет', 'низкокалор', 'безглютено', 'веган', 'вегетариан', 'постн', 'разгрузоч', 'детокс', 'супфуд', 'клетчатк'],
  'kulinarnye-sovety': ['совет', 'лайфхак', 'хитрост', 'секрет', 'техник', 'способ', 'подсказк', 'как приготовить', 'как варить', 'как жарить'],

  // Дом и уборка
  'ezhednevnaya-uborka': ['ежеднев', 'быстр', 'каждый день', 'поддерживающ', 'рутин'],
  'generalnaya-uborka': ['генеральн', 'глубок', 'капитальн', 'весенн', 'осенн'],
  'kuhnya-i-vannaya': ['кухн', 'ванн', 'сануз', 'плит', 'раковин', 'унитаз', 'душ', 'кафель', 'плесен', 'известков'],
  'hranenie-i-poryadok': ['хранен', 'организ', 'порядок', 'шкаф', 'полк', 'коробк', 'контейнер', 'разлож', 'систем хран'],
  'stirka-i-uhod': ['стирк', 'глажк', 'ткан', 'одежд', 'бельё', 'постельн', 'деликатн', 'отбелив', 'кондиционер'],
  'pyatna-i-chistka': ['пятн', 'чистк', 'выведен', 'гряз', 'плесен', 'ржавчин', 'жирн', 'чернил', 'вино'],

  // Дача и огород
  ogorod: ['огород', 'овощ', 'грядк', 'посев', 'посадк', 'урожай', 'рассада'],
  'sad-i-derevya': ['сад', 'дерев', 'яблон', 'груш', 'вишн', 'обрезк', 'плодов'],
  'rassada-teplitsy': ['рассад', 'теплиц', 'парник', 'пикировк', 'кассет', 'подоконник'],
  'poliv-udobreniya': ['полив', 'удобрен', 'подкормк', 'компост', 'мульч', 'капельн'],
  'vrediteli-bolezni': ['вредител', 'болезн', 'тля', 'клещ', 'гниль', 'фитофтор', 'обработк'],
  'instrumenty-dacha': ['инструмент', 'мотоблок', 'культиватор', 'секатор', 'лопат', 'тачк'],

  // Лайфхаки
  'layf-dlya-kuxni': ['кухн', 'готовк', 'кастрюл', 'сковород', 'микроволнов', 'духовк'],
  'layf-dlya-doma': ['дом', 'квартир', 'комнат', 'мебел', 'интерьер'],
  'byudzhetnye-resheniya': ['бюджет', 'эконом', 'дешев', 'бесплатн', 'копейк', 'рубл'],
  'svoimi-rukami': ['своими руками', 'diy', 'мастер', 'самоделк', 'поделк', 'ручн'],

  // Экономия
  'ekonomiya-produkty': ['продукт', 'еда', 'магазин', 'супермаркет', 'рынок', 'список покупок'],
  kommunalka: ['коммунал', 'жкх', 'электр', 'вод', 'газ', 'отоплен', 'счётчик'],
  'semeyny-byudzhet': ['бюджет', 'финанс', 'доход', 'расход', 'накоплен', 'сбережен'],
  'skidki-keshbek': ['скидк', 'кэшбек', 'акци', 'бонус', 'распродаж', 'промокод', 'купон'],

  // Рыбалка
  spinning: ['спиннинг', 'блесн', 'воблер', 'джиг', 'твичинг'],
  poplavochnaya: ['поплавок', 'удочк', 'поплавочн'],
  'fider-karp': ['фидер', 'карп', 'макушатник', 'метод'],
  'zimnyaya-rybalka': ['зимн', 'лёд', 'мормышк', 'балансир', 'зимняя'],
  'snasti-primanki': ['снаст', 'приманк', 'крючок', 'леск', 'поводок', 'катушк'],

  // Здоровье и безопасность
  'aptechka-pomoshch': ['аптечк', 'первая помощь', 'лекарств', 'таблетк', 'бинт', 'антисептик'],
  'bezopasnost-doma': ['безопасност', 'замок', 'сигнализ', 'камер', 'пожарн', 'дым'],
  'pishchevaya-bezopasnost': ['пищев', 'продукт', 'срок годности', 'бактери', 'отравлен', 'гигиен'],
  'sezonnaya-bezopasnost': ['сезон', 'лето', 'зима', 'весна', 'осень', 'клещ', 'жар', 'гололед'],

  // Семья и дети
  'razvitie-detei': ['развитие', 'ребенок', 'дети', 'малыш', 'игр', 'творчеств'],
  'shkola-obrazovanie': ['школ', 'учёб', 'образован', 'урок', 'экзамен', 'домашн задан'],
  'semeyny-otdyh': ['семь', 'отдых', 'праздник', 'выходн', 'каникул'],
  'detskoe-zdorove': ['детск', 'ребенок', 'прививк', 'простуд', 'температур'],

  // Красота и уход
  'uhod-kozha': ['кожа', 'лицо', 'крем', 'маск', 'скраб', 'увлажн', 'очищен', 'тоник'],
  'uhod-volosy': ['волос', 'шампун', 'маск для волос', 'окрашиван', 'стрижк', 'укладк'],
  'uhod-odezhda': ['одежд', 'обув', 'кожан', 'замш', 'кроссовк', 'ботинк'],
  'domashniy-spa': ['спа', 'массаж', 'ванна', 'аромат', 'релакс', 'пилинг'],

  // Отдых и путешествия
  'po-rossii': ['росси', 'путешеств', 'город', 'музей', 'достопримечат'],
  byudzhetno: ['бюджет', 'эконом', 'дешев', 'бесплатн'],
  'na-prirode': ['природ', 'кемпинг', 'палатк', 'костер', 'поход', 'лес', 'озеро'],
  putevoditeli: ['путеводител', 'гайд', 'маршрут', 'советы путешественник'],

  // Покупки и техника
  'bytovaya-tehnika': ['техник', 'стиральн', 'холодильник', 'пылесос', 'микроволнов', 'посудомой'],
  'umny-dom': ['умн дом', 'smart', 'автоматиз', 'датчик', 'алис', 'google home'],
  'vybor-sravnenie': ['выбор', 'сравнен', 'рейтинг', 'лучш', 'топ', 'обзор'],

  // Авто
  'vneshniy-uhod-avto': ['мойк', 'полировк', 'кузов', 'воск', 'царапин', 'ржавчин'],
  'salon-avto': ['салон', 'чистк салона', 'коврик', 'сиден'],
  'dvigatel-tehnika': ['двигател', 'мотор', 'масло', 'фильтр', 'тормоз', 'подвеск'],
  'sezon-avto': ['сезон', 'зимн', 'летн', 'шипы', 'резин'],
  'zakony-avto': ['закон', 'пдд', 'штраф', 'страховк', 'осаго', 'каско', 'документ'],
}

/**
 * Build CATEGORY_THEMES dynamically from SUBCATEGORIES + keyword map.
 * This replaces the old hardcoded per-category theme definitions.
 */
import { CATEGORIES as _CATS } from './categories.mjs'

const CATEGORY_THEMES: Record<string, CategoryTheme[]> = (() => {
  const result: Record<string, CategoryTheme[]> = {}
  for (const parentSlug of Object.keys(_CATS)) {
    const subs = getSubcategoriesFor(parentSlug)
    if (subs.length === 0) continue
    result[parentSlug] = subs.map((sub) => ({
      label: sub.name,
      slug: sub.slug,
      keywords: SUBCATEGORY_KEYWORDS[sub.slug] || [sub.name.toLowerCase()],
    }))
  }
  return result
})()

/**
 * Buckets a category's articles into curated themes by keyword-matching each
 * article's tags. An article can land in more than one theme (same as the
 * old tag-pill filter, where one article could carry several tags). Themes
 * with zero matching articles are dropped so the pill row never shows a dead
 * end.
 */
export function themesForCategory<T extends { tags?: string[]; slug?: string }>(
  category: string,
  articles: T[],
): { label: string; slug: string; articles: T[] }[] {
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
      return { label: theme.label, slug: theme.slug, articles: matched }
    })
    .filter((theme) => theme.articles.length > 0)
}
