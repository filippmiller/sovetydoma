import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { fileURLToPath } from 'url'
import { CATEGORIES } from '../src/lib/categories.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const articlesDir = path.join(__dirname, '../src/content/articles')
const SITE_URL = 'https://1001sovet.ru'

const STATIC_PAGES = [
  { path: '/about/', changefreq: 'monthly', priority: '0.5' },
  { path: '/contact/', changefreq: 'monthly', priority: '0.4' },
  { path: '/recepty/', changefreq: 'weekly', priority: '0.7' },
  { path: '/advert/', changefreq: 'yearly', priority: '0.4' },
  { path: '/terms/', changefreq: 'yearly', priority: '0.3' },
  { path: '/privacy/', changefreq: 'yearly', priority: '0.3' },
  { path: '/cookies/', changefreq: 'yearly', priority: '0.3' },
  { path: '/articles/', changefreq: 'daily', priority: '0.6' },
  { path: '/archive/', changefreq: 'weekly', priority: '0.4' },
]

const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.mdx'))
const articles = files.map(f => {
  const { data } = matter(fs.readFileSync(path.join(articlesDir, f), 'utf8'))
  return data
})

const ARTICLE_PAGE_SIZE = 24
const totalArticlePages = Math.max(1, Math.ceil(articles.length / ARTICLE_PAGE_SIZE))
const paginatedArticlePages = Array.from(
  { length: Math.max(0, totalArticlePages - 1) },
  (_, i) => `/articles/page/${i + 2}/`,
)

// Real archive months only (no thin/empty pages)
const archiveMonths = [...new Set(
  articles
    .map(a => (a.date || '').slice(0, 7))
    .filter(ym => /^\d{4}-\d{2}$/.test(ym))
)].sort()

const urls = [
  `<url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
  ...Object.values(CATEGORIES).map(c => `<url><loc>${SITE_URL}/${c.slug}/</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
  ...STATIC_PAGES.map(p => `<url><loc>${SITE_URL}${p.path}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`),
  ...paginatedArticlePages.map(p => `<url><loc>${SITE_URL}${p}</loc><changefreq>daily</changefreq><priority>0.5</priority></url>`),
  ...archiveMonths.map(ym => `<url><loc>${SITE_URL}/archive/${ym}/</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`),
  ...articles.map(a => `<url><loc>${SITE_URL}/${a.category}/${a.slug}/</loc><lastmod>${a.updated || a.date}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`),
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

fs.writeFileSync(path.join(__dirname, '../public/sitemap.xml'), xml)
console.log(`Generated sitemap with ${urls.length} URLs`)
