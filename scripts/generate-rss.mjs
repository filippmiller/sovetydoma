import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const articlesDir = path.join(__dirname, '../src/content/articles')
const SITE_URL = 'https://1001sovet.ru'

const CATEGORIES = {
  kulinaria: { name: 'Кулинария', description: 'Рецепты, советы и секреты вкусной домашней кухни' },
  'dom-i-uborka': { name: 'Дом и уборка', description: 'Лайфхаки для чистоты и порядка в доме' },
  'dacha-i-ogorod': { name: 'Дача и огород', description: 'Советы для сада, огорода и загородной жизни' },
  layfkhaki: { name: 'Лайфхаки', description: 'Полезные идеи и хитрости на каждый день' },
  ekonomiya: { name: 'Экономия', description: 'Как жить хорошо и тратить меньше' },
}

const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.mdx'))
const allArticles = files
  .map(f => {
    const raw = fs.readFileSync(path.join(articlesDir, f), 'utf8')
    const { data, content } = matter(raw)
    // Get first paragraph as excerpt
    const excerpt = content.trim().split('\n\n')[0].replace(/[#*`]/g, '').trim()
    return { ...data, excerpt }
  })
  .sort((a, b) => (a.date < b.date ? 1 : -1))

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toRfc822(dateStr) {
  return new Date(dateStr).toUTCString()
}

function buildItems(articles) {
  return articles.map(a => `
  <item>
    <title>${escapeXml(a.title)}</title>
    <link>${SITE_URL}/${a.category}/${a.slug}/</link>
    <guid isPermaLink="true">${SITE_URL}/${a.category}/${a.slug}/</guid>
    <pubDate>${toRfc822(a.date)}</pubDate>
    <category>${escapeXml(a.categoryName)}</category>
    <description>${escapeXml(a.description)}</description>
  </item>`).join('')
}

function buildFeed({ title, link, description, selfHref, items }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${link}</link>
    <description>${escapeXml(description)}</description>
    <language>ru</language>
    <atom:link href="${selfHref}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image>
      <url>${SITE_URL}/og-default.png</url>
      <title>СоветыДома</title>
      <link>${SITE_URL}/</link>
    </image>
    ${items}
  </channel>
</rss>`
}

// Main feed (last 20 articles across all categories)
const mainArticles = allArticles.slice(0, 20)
const mainXml = buildFeed({
  title: 'СоветыДома — советы для дома и дачи',
  link: `${SITE_URL}/`,
  description: 'Практические советы по кулинарии, уборке, огороду, лайфхаки и экономия для вашего дома.',
  selfHref: `${SITE_URL}/feed.xml`,
  items: buildItems(mainArticles),
})
fs.writeFileSync(path.join(__dirname, '../public/feed.xml'), mainXml)
console.log(`Generated main RSS feed with ${mainArticles.length} items`)

// Per-category feeds
for (const [slug, cat] of Object.entries(CATEGORIES)) {
  const catArticles = allArticles.filter(a => a.category === slug).slice(0, 20)
  const catXml = buildFeed({
    title: `СоветыДома — ${cat.name}`,
    link: `${SITE_URL}/${slug}/`,
    description: cat.description,
    selfHref: `${SITE_URL}/feed-${slug}.xml`,
    items: buildItems(catArticles),
  })
  const outPath = path.join(__dirname, `../public/feed-${slug}.xml`)
  fs.writeFileSync(outPath, catXml)
  console.log(`Generated RSS feed for "${cat.name}" with ${catArticles.length} items`)
}
