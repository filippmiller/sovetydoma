import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const articlesDir = path.join(__dirname, '../src/content/articles')
const SITE_URL = 'https://1001sovet.ru'

const CATEGORIES = ['kulinaria', 'dom-i-uborka', 'dacha-i-ogorod', 'layfkhaki', 'ekonomiya']
const STATIC_PAGES = [
  { path: '/about/', changefreq: 'monthly', priority: '0.5' },
  { path: '/contact/', changefreq: 'monthly', priority: '0.4' },
  { path: '/recepty/', changefreq: 'weekly', priority: '0.7' },
]

const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.mdx'))
const articles = files.map(f => {
  const { data } = matter(fs.readFileSync(path.join(articlesDir, f), 'utf8'))
  return data
})

const urls = [
  `<url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
  ...CATEGORIES.map(c => `<url><loc>${SITE_URL}/${c}/</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
  ...STATIC_PAGES.map(p => `<url><loc>${SITE_URL}${p.path}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`),
  ...articles.map(a => `<url><loc>${SITE_URL}/${a.category}/${a.slug}/</loc><lastmod>${a.updated || a.date}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`),
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

fs.writeFileSync(path.join(__dirname, '../public/sitemap.xml'), xml)
console.log(`Generated sitemap with ${urls.length} URLs`)
