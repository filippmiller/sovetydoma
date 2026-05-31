// Client-safe: no fs/path/gray-matter — can be imported from Client Components

export const CATEGORIES: Record<string, { name: string; slug: string; description: string }> = {
  kulinaria: { name: 'Кулинария', slug: 'kulinaria', description: 'Рецепты, советы и секреты вкусной домашней кухни' },
  'dom-i-uborka': { name: 'Дом и уборка', slug: 'dom-i-uborka', description: 'Лайфхаки для чистоты и порядка в доме' },
  'dacha-i-ogorod': { name: 'Дача и огород', slug: 'dacha-i-ogorod', description: 'Советы для сада, огорода и загородной жизни' },
  layfkhaki: { name: 'Лайфхаки', slug: 'layfkhaki', description: 'Полезные идеи и хитрости на каждый день' },
  ekonomiya: { name: 'Экономия', slug: 'ekonomiya', description: 'Как жить хорошо и тратить меньше' },
  rybalka: { name: 'Рыбалка', slug: 'rybalka', description: 'Снасти, наживки, места и секреты успешной рыбалки' },
}
