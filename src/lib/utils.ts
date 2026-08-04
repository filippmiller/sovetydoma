// Reading time estimator (Russian: ~180 words/min)
export function readingTime(content: string): string {
  const words = content.trim().split(/\s+/).length
  const minutes = Math.max(1, Math.round(words / 180))
  if (minutes === 1) return '1 минута'
  if (minutes < 5) return `${minutes} минуты`
  return `${minutes} минут`
}

// Relative date in Russian
export function relativeDate(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()

  // Future dates or same-day: show "сегодня"
  if (diffMs < 0) return 'сегодня'

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'сегодня'
  if (diffDays === 1) return 'вчера'
  if (diffDays < 7) return `${diffDays} дн. назад`
  if (diffDays < 28) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} нед. назад`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} мес. назад`
  }
  const years = Math.floor(diffDays / 365)
  return `${years} г. назад`
}

// Was this article actually published recently? Used to gate the "Новое"
// badge — it used to be tied to array position (first card in any grid),
// so a month-old article could get tagged "Новое" just for being first in
// a round-robin'd list. Real recency, not position.
export function isRecentArticle(dateStr: string, thresholdDays = 14): boolean {
  const now = new Date()
  const date = new Date(dateStr)
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays >= 0 && diffDays < thresholdDays
}

// Full date in Russian
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Count words in MDX content (strips frontmatter + markdown syntax)
export function countWords(content: string): number {
  return content
    .replace(/^---[\s\S]+?---/, '')
    .replace(/[#*`\[\]()>]/g, '')
    .trim()
    .split(/\s+/).length
}

// Category emoji map (top-level + subcategories)
export const CATEGORY_EMOJI: Record<string, string> = {
  kulinaria: '🍲',
  'dom-i-uborka': '🧹',
  'dacha-i-ogorod': '🌱',
  layfkhaki: '💡',
  ekonomiya: '💰',
  rybalka: '🎣',
  'zdorovie-i-bezopasnost': '🛡️',
  'semya-i-deti': '👨‍👩‍👧‍👦',
  'krasota-i-uhod': '🌸',
  'otdyh-i-puteshestviya': '🧳',
  'pokupki-i-tehnika': '📦',
  avto: '🚗',
  // Subcategories — Кулинария
  supy: '🍜',
  'goryachie-blyuda': '🍖',
  'salaty-i-zakuski': '🥗',
  'vypechka-deserty': '🍰',
  napitki: '🥤',
  zagotovki: '🥫',
  'zdorovaya-eda': '🥦',
  'kulinarnye-sovety': '👨‍🍳',
  // Subcategories — Дом и уборка
  'ezhednevnaya-uborka': '🧽',
  'generalnaya-uborka': '🧹',
  'kuhnya-i-vannaya': '🚿',
  'hranenie-i-poryadok': '📦',
  'stirka-i-uhod': '👕',
  'pyatna-i-chistka': '🧴',
  // Subcategories — Дача и огород
  ogorod: '🥕',
  'sad-i-derevya': '🌳',
  'rassada-teplitsy': '🌱',
  'poliv-udobreniya': '💧',
  'vrediteli-bolezni': '🐛',
  'instrumenty-dacha': '🔧',
  // Subcategories — Лайфхаки
  'layf-dlya-kuxni': '🍳',
  'layf-dlya-doma': '🏠',
  'byudzhetnye-resheniya': '💵',
  'svoimi-rukami': '🔨',
  // Subcategories — Экономия
  'ekonomiya-produkty': '🛒',
  kommunalka: '🏢',
  'semeyny-byudzhet': '💳',
  'skidki-keshbek': '🏷️',
  // Subcategories — Рыбалка
  spinning: '🎣',
  poplavochnaya: '🎏',
  'fider-karp': '🐟',
  'zimnyaya-rybalka': '❄️',
  'snasti-primanki': '🪝',
  // Subcategories — Здоровье и безопасность
  'aptechka-pomoshch': '💊',
  'bezopasnost-doma': '🔒',
  'pishchevaya-bezopasnost': '🍽️',
  'sezonnaya-bezopasnost': '🌡️',
  // Subcategories — Семья и дети
  'razvitie-detei': '🧒',
  'shkola-obrazovanie': '📚',
  'semeyny-otdyh': '🎡',
  'detskoe-zdorove': '🩺',
  // Subcategories — Красота и уход
  'uhod-kozha': '✨',
  'uhod-volosy': '💇',
  'uhod-odezhda': '👗',
  'domashniy-spa': '🧖',
  // Subcategories — Отдых и путешествия
  'po-rossii': '🗺️',
  byudzhetno: '💰',
  'na-prirode': '⛺',
  putevoditeli: '📖',
  // Subcategories — Покупки и техника
  'bytovaya-tehnika': '🔌',
  'umny-dom': '🏠',
  'vybor-sravnenie': '⚖️',
  // Subcategories — Авто
  'vneshniy-uhod-avto': '🚿',
  'salon-avto': '🪑',
  'dvigatel-tehnika': '⚙️',
  'sezon-avto': '🍂',
  'zakony-avto': '📋',
}

// Category color map (top-level + subcategories inherit parent hue)
export const CATEGORY_COLOR: Record<string, string> = {
  kulinaria: '#e67e22',
  'dom-i-uborka': '#27ae60',
  'dacha-i-ogorod': '#16a085',
  layfkhaki: '#8e44ad',
  ekonomiya: '#2980b9',
  rybalka: '#2c7da0',
  'zdorovie-i-bezopasnost': '#c0392b',
  'semya-i-deti': '#8e44ad',
  'krasota-i-uhod': '#e91e63',
  'otdyh-i-puteshestviya': '#2980b9',
  'pokupki-i-tehnika': '#f39c12',
  avto: '#34495e',
  // Subcategories — Кулинария (orange family)
  supy: '#d35400',
  'goryachie-blyuda': '#e74c3c',
  'salaty-i-zakuski': '#27ae60',
  'vypechka-deserty': '#d4649a',
  napitki: '#2980b9',
  zagotovki: '#16a085',
  'zdorovaya-eda': '#2ecc71',
  'kulinarnye-sovety': '#f39c12',
  // Subcategories — Дом и уборка (green family)
  'ezhednevnaya-uborka': '#2ecc71',
  'generalnaya-uborka': '#1abc9c',
  'kuhnya-i-vannaya': '#3498db',
  'hranenie-i-poryadok': '#9b59b6',
  'stirka-i-uhod': '#1abc9c',
  'pyatna-i-chistka': '#e67e22',
  // Subcategories — Дача и огород (teal/green family)
  ogorod: '#27ae60',
  'sad-i-derevya': '#16a085',
  'rassada-teplitsy': '#2ecc71',
  'poliv-udobreniya': '#3498db',
  'vrediteli-bolezni': '#e74c3c',
  'instrumenty-dacha': '#7f8c8d',
  // Subcategories — Лайфхаки (purple family)
  'layf-dlya-kuxni': '#e67e22',
  'layf-dlya-doma': '#8e44ad',
  'byudzhetnye-resheniya': '#27ae60',
  'svoimi-rukami': '#d35400',
  // Subcategories — Экономия (blue family)
  'ekonomiya-produkty': '#27ae60',
  kommunalka: '#2c3e50',
  'semeyny-byudzhet': '#2980b9',
  'skidki-keshbek': '#e74c3c',
  // Subcategories — Рыбалка (blue-grey family)
  spinning: '#2c7da0',
  poplavochnaya: '#3498db',
  'fider-karp': '#1abc9c',
  'zimnyaya-rybalka': '#7f8c8d',
  'snasti-primanki': '#e67e22',
  // Subcategories — Здоровье и безопасность (red family)
  'aptechka-pomoshch': '#e74c3c',
  'bezopasnost-doma': '#c0392b',
  'pishchevaya-bezopasnost': '#e67e22',
  'sezonnaya-bezopasnost': '#2980b9',
  // Subcategories — Семья и дети (purple family)
  'razvitie-detei': '#9b59b6',
  'shkola-obrazovanie': '#3498db',
  'semeyny-otdyh': '#e67e22',
  'detskoe-zdorove': '#e91e63',
  // Subcategories — Красота и уход (pink family)
  'uhod-kozha': '#e91e63',
  'uhod-volosy': '#9b59b6',
  'uhod-odezhda': '#3498db',
  'domashniy-spa': '#1abc9c',
  // Subcategories — Отдых и путешествия (blue family)
  'po-rossii': '#c0392b',
  byudzhetno: '#27ae60',
  'na-prirode': '#16a085',
  putevoditeli: '#2980b9',
  // Subcategories — Покупки и техника (amber family)
  'bytovaya-tehnika': '#f39c12',
  'umny-dom': '#2980b9',
  'vybor-sravnenie': '#8e44ad',
  // Subcategories — Авто (dark family)
  'vneshniy-uhod-avto': '#3498db',
  'salon-avto': '#7f8c8d',
  'dvigatel-tehnika': '#2c3e50',
  'sezon-avto': '#e67e22',
  'zakony-avto': '#c0392b',
}
