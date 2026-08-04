// Client-safe and Node-safe category source. Keep scripts and app routing in sync.
export const CATEGORIES = {
  kulinaria: {
    name: 'Кулинария',
    slug: 'kulinaria',
    description: 'Рецепты, советы и секреты вкусной домашней кухни',
  },
  'dom-i-uborka': {
    name: 'Дом и уборка',
    slug: 'dom-i-uborka',
    description: 'Лайфхаки для чистоты и порядка в доме',
  },
  'dacha-i-ogorod': {
    name: 'Дача и огород',
    slug: 'dacha-i-ogorod',
    description: 'Советы для сада, огорода и загородной жизни',
  },
  layfkhaki: {
    name: 'Лайфхаки',
    slug: 'layfkhaki',
    description: 'Полезные идеи и хитрости на каждый день',
  },
  ekonomiya: {
    name: 'Экономия',
    slug: 'ekonomiya',
    description: 'Как жить хорошо и тратить меньше',
  },
  rybalka: {
    name: 'Рыбалка',
    slug: 'rybalka',
    description: 'Снасти, наживки, места и секреты успешной рыбалки',
  },
  'zdorovie-i-bezopasnost': {
    name: 'Здоровье и безопасность',
    slug: 'zdorovie-i-bezopasnost',
    description: 'Практичные советы по безопасности дома, аптечке и защите от сезонных рисков',
  },
  'semya-i-deti': {
    name: 'Семья и дети',
    slug: 'semya-i-deti',
    description: 'Организация быта с детьми, школа, семейные покупки и повседневная безопасность',
  },
  'krasota-i-uhod': {
    name: 'Красота и уход',
    slug: 'krasota-i-uhod',
    description: 'Уход за одеждой, обувью, гигиена и простые домашние средства',
  },
  'otdyh-i-puteshestviya': {
    name: 'Отдых и путешествия',
    slug: 'otdyh-i-puteshestviya',
    description: 'Сборы в дорогу, экономный отпуск и подготовка к поездкам',
  },
  'pokupki-i-tehnika': {
    name: 'Покупки и техника',
    slug: 'pokupki-i-tehnika',
    description: 'Выбор техники и товаров, умные покупки, уход и защита от переплат',
  },
  avto: {
    name: 'Авто',
    slug: 'avto',
    description: 'Уход за автомобилем, экономия на топливе и ремонте, сезонная эксплуатация',
  },
}

// Subcategories — each entry has a parentSlug pointing to a CATEGORIES key.
// Navigation components use getSubcategoriesFor() to render nested menus.
// The category page uses these as filter sections (replacing categoryThemes).
export const SUBCATEGORIES = {
  // ─── Кулинария ───
  'supy':              { name: 'Супы',                  slug: 'supy',              parentSlug: 'kulinaria', description: 'Первые блюда на каждый день и для праздника' },
  'goryachie-blyuda':  { name: 'Горячие блюда',         slug: 'goryachie-blyuda',  parentSlug: 'kulinaria', description: 'Мясо, птица, рыба и гарниры' },
  'salaty-i-zakuski':  { name: 'Салаты и закуски',      slug: 'salaty-i-zakuski',  parentSlug: 'kulinaria', description: 'Лёгкие салаты, закуски и канапе' },
  'vypechka-deserty':  { name: 'Выпечка и десерты',     slug: 'vypechka-deserty',  parentSlug: 'kulinaria', description: 'Пироги, торты, печенье и сладости' },
  'napitki':           { name: 'Напитки',               slug: 'napitki',           parentSlug: 'kulinaria', description: 'Чай, кофе, компоты и домашние напитки' },
  'zagotovki':         { name: 'Заготовки',             slug: 'zagotovki',         parentSlug: 'kulinaria', description: 'Консервация, соленья и варенья' },
  'zdorovaya-eda':     { name: 'Здоровая еда',          slug: 'zdorovaya-eda',     parentSlug: 'kulinaria', description: 'ПП-рецепты, правильное питание и здоровый рацион' },
  'kulinarnye-sovety': { name: 'Кулинарные советы',     slug: 'kulinarnye-sovety', parentSlug: 'kulinaria', description: 'Лайфхаки, техники и секреты приготовления' },

  // ─── Дом и уборка ───
  'ezhednevnaya-uborka':  { name: 'Ежедневная уборка',   slug: 'ezhednevnaya-uborka',  parentSlug: 'dom-i-uborka', description: 'Быстрая уборка каждый день' },
  'generalnaya-uborka':   { name: 'Генеральная уборка',  slug: 'generalnaya-uborka',   parentSlug: 'dom-i-uborka', description: 'Глубкая уборка всего дома' },
  'kuhnya-i-vannaya':     { name: 'Кухня и ванная',      slug: 'kuhnya-i-vannaya',     parentSlug: 'dom-i-uborka', description: 'Чистота в главных комнатах' },
  'hranenie-i-poryadok':  { name: 'Хранение и порядок',  slug: 'hranenie-i-poryadok',  parentSlug: 'dom-i-uborka', description: 'Организация пространства и систем хранения' },
  'stirka-i-uhod':        { name: 'Стирка и уход',       slug: 'stirka-i-uhod',        parentSlug: 'dom-i-uborka', description: 'Стирка, глажка и уход за тканями' },
  'pyatna-i-chistka':     { name: 'Пятна и чистка',      slug: 'pyatna-i-chistka',     parentSlug: 'dom-i-uborka', description: 'Выведение пятен и чистка поверхностей' },

  // ─── Дача и огород ───
  'ogorod':             { name: 'Огород и овощи',        slug: 'ogorod',             parentSlug: 'dacha-i-ogorod', description: 'Грядки, рассада и уход за овощами' },
  'sad-i-derevya':      { name: 'Сад и деревья',         slug: 'sad-i-derevya',      parentSlug: 'dacha-i-ogorod', description: 'Плодовые деревья и кустарники' },
  'rassada-teplitsy':   { name: 'Рассада и теплицы',     slug: 'rassada-teplitsy',   parentSlug: 'dacha-i-ogorod', description: 'Выращивание рассады и уход за теплицами' },
  'poliv-udobreniya':   { name: 'Полив и удобрения',     slug: 'poliv-udobreniya',   parentSlug: 'dacha-i-ogorod', description: 'Полив, подкормки и уход за почвой' },
  'vrediteli-bolezni':  { name: 'Вредители и болезни',   slug: 'vrediteli-bolezni',  parentSlug: 'dacha-i-ogorod', description: 'Защита растений от болезней и вредителей' },
  'instrumenty-dacha':  { name: 'Инструменты и техника', slug: 'instrumenty-dacha',  parentSlug: 'dacha-i-ogorod', description: 'Садовый инвентарь и техника' },

  // ─── Лайфхаки ───
  'layf-dlya-kuxni':    { name: 'Для кухни',             slug: 'layf-dlya-kuxni',    parentSlug: 'layfkhaki', description: 'Лайфхаки на кухне' },
  'layf-dlya-doma':     { name: 'Для дома',              slug: 'layf-dlya-doma',     parentSlug: 'layfkhaki', description: 'Полезные хитрости для дома' },
  'byudzhetnye-resheniya': { name: 'Бюджетные решения',  slug: 'byudzhetnye-resheniya', parentSlug: 'layfkhaki', description: 'Экономные лайфхаки' },
  'svoimi-rukami':      { name: 'Своими руками',         slug: 'svoimi-rukami',      parentSlug: 'layfkhaki', description: 'DIY и мастерство' },

  // ─── Экономия ───
  'ekonomiya-produkty': { name: 'Экономия на продуктах', slug: 'ekonomiya-produkty', parentSlug: 'ekonomiya', description: 'Как покупать еду дешевле' },
  'kommunalka':         { name: 'Коммунальные услуги',   slug: 'kommunalka',         parentSlug: 'ekonomiya', description: 'Снижение расходов на ЖКУ' },
  'semeyny-byudzhet':   { name: 'Семейный бюджет',       slug: 'semeyny-byudzhet',   parentSlug: 'ekonomiya', description: 'Планирование семейных финансов' },
  'skidki-keshbek':     { name: 'Скидки и кэшбек',       slug: 'skidki-keshbek',     parentSlug: 'ekonomiya', description: 'Бонусы, акции и выгодные покупки' },

  // ─── Рыбалка ───
  'spinning':           { name: 'Спиннинг',              slug: 'spinning',           parentSlug: 'rybalka', description: 'Ловля на спиннинг' },
  'poplavochnaya':      { name: 'Поплавочная ловля',     slug: 'poplavochnaya',      parentSlug: 'rybalka', description: 'Ловля на поплавок' },
  'fider-karp':         { name: 'Фидер и карпфишинг',    slug: 'fider-karp',         parentSlug: 'rybalka', description: 'Фидерная и карповая ловля' },
  'zimnyaya-rybalka':   { name: 'Зимняя рыбалка',        slug: 'zimnyaya-rybalka',   parentSlug: 'rybalka', description: 'Рыбалка зимой со льда' },
  'snasti-primanki':    { name: 'Снасти и приманки',     slug: 'snasti-primanki',    parentSlug: 'rybalka', description: 'Выбор снастей и приманок' },

  // ─── Здоровье и безопасность ───
  'aptechka-pomoshch':  { name: 'Аптечка и первая помощь', slug: 'aptechka-pomoshch', parentSlug: 'zdorovie-i-bezopasnost', description: 'Домашняя аптечка и первая помощь' },
  'bezopasnost-doma':   { name: 'Безопасность дома',     slug: 'bezopasnost-doma',   parentSlug: 'zdorovie-i-bezopasnost', description: 'Безопасность жилья и быта' },
  'pishchevaya-bezopasnost': { name: 'Пищевая безопасность', slug: 'pishchevaya-bezopasnost', parentSlug: 'zdorovie-i-bezopasnost', description: 'Безопасность продуктов и готовки' },
  'sezonnaya-bezopasnost':   { name: 'Сезонная безопасность',  slug: 'sezonnaya-bezopasnost',   parentSlug: 'zdorovie-i-bezopasnost', description: 'Безопасность в разные сезоны' },

  // ─── Семья и дети ───
  'razvitie-detei':     { name: 'Развитие детей',        slug: 'razvitie-detei',     parentSlug: 'semya-i-deti', description: 'Развитие и воспитание детей' },
  'shkola-obrazovanie': { name: 'Образование и школа',   slug: 'shkola-obrazovanie', parentSlug: 'semya-i-deti', description: 'Школьные дела и обучение' },
  'semeyny-otdyh':      { name: 'Семейный отдых',        slug: 'semeyny-otdyh',      parentSlug: 'semya-i-deti', description: 'Отдых всей семьёй' },
  'detskoe-zdorove':    { name: 'Детское здоровье',      slug: 'detskoe-zdorove',    parentSlug: 'semya-i-deti', description: 'Здоровье и уход за детьми' },

  // ─── Красота и уход ───
  'uhod-kozha':         { name: 'Уход за кожей',         slug: 'uhod-kozha',         parentSlug: 'krasota-i-uhod', description: 'Уход за кожей лица и тела' },
  'uhod-volosy':        { name: 'Уход за волосами',      slug: 'uhod-volosy',        parentSlug: 'krasota-i-uhod', description: 'Уход за волосами' },
  'uhod-odezhda':       { name: 'Уход за одеждой',       slug: 'uhod-odezhda',       parentSlug: 'krasota-i-uhod', description: 'Уход за одеждой и обувью' },
  'domashniy-spa':      { name: 'Домашний SPA',          slug: 'domashniy-spa',      parentSlug: 'krasota-i-uhod', description: 'SPA-процедуры дома' },

  // ─── Отдых и путешествия ───
  'po-rossii':          { name: 'По России',             slug: 'po-rossii',          parentSlug: 'otdyh-i-puteshestviya', description: 'Путешествия по России' },
  'byudzhetno':         { name: 'Бюджетные поездки',     slug: 'byudzhetno',         parentSlug: 'otdyh-i-puteshestviya', description: 'Экономные путешествия' },
  'na-prirode':         { name: 'На природе',            slug: 'na-prirode',         parentSlug: 'otdyh-i-puteshestviya', description: 'Отдых на природе и кемпинг' },
  'putevoditeli':       { name: 'Путеводители',          slug: 'putevoditeli',       parentSlug: 'otdyh-i-puteshestviya', description: 'Гайды и путеводители' },

  // ─── Покупки и техника ───
  'bytovaya-tehnika':   { name: 'Бытовая техника',       slug: 'bytovaya-tehnika',   parentSlug: 'pokupki-i-tehnika', description: 'Выбор и уход за техникой' },
  'umny-dom':           { name: 'Умный дом',             slug: 'umny-dom',           parentSlug: 'pokupki-i-tehnika', description: 'Умный дом и автоматизация' },
  'vybor-sravnenie':    { name: 'Выбор и сравнение',     slug: 'vybor-sravnenie',    parentSlug: 'pokupki-i-tehnika', description: 'Сравнение товаров и выбор' },

  // ─── Авто ───
  'vneshniy-uhod-avto': { name: 'Внешний уход',         slug: 'vneshniy-uhod-avto', parentSlug: 'avto', description: 'Мойка, полировка и защита кузова' },
  'salon-avto':         { name: 'Салон',                 slug: 'salon-avto',         parentSlug: 'avto', description: 'Чистота и порядок в салоне' },
  'dvigatel-tehnika':   { name: 'Двигатель и техника',   slug: 'dvigatel-tehnika',   parentSlug: 'avto', description: 'Обслуживание двигателя и узлов' },
  'sezon-avto':         { name: 'Сезонная подготовка',   slug: 'sezon-avto',         parentSlug: 'avto', description: 'Подготовка к сезону' },
  'zakony-avto':        { name: 'Законы и документы',    slug: 'zakony-avto',        parentSlug: 'avto', description: 'ПДД, документы и страховки' },
}

// Helper: get subcategories for a given parent category slug
export function getSubcategoriesFor(parentSlug) {
  return Object.values(SUBCATEGORIES).filter((sub) => sub.parentSlug === parentSlug)
}

// Helper: get parent category for a subcategory slug
export function getParentCategory(subSlug) {
  const sub = SUBCATEGORIES[subSlug]
  return sub ? CATEGORIES[sub.parentSlug] : null
}
