import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const articlesDir = path.join(__dirname, '../src/content/articles')
const SITE_URL = 'https://pogovorim.vsedomatut.com'

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

/**
 * Minimal markdown → HTML converter for Zen content:encoded.
 * Handles headings, bold, italic, and paragraphs.
 */
function markdownToHtml(md) {
  if (!md) return ''

  // Escape XML special chars first, then convert markdown syntax
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // ### heading (must come before ##)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  // ## heading
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  // **bold**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // *italic* (single asterisk)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')

  // Split into blocks on double newlines, wrap non-tag blocks in <p>
  const blocks = html.split(/\n{2,}/)
  const wrapped = blocks.map(block => {
    const trimmed = block.trim()
    if (!trimmed) return ''
    if (/^<(h[1-6]|p|ul|ol|li|blockquote|figure|hr|div)/.test(trimmed)) {
      return trimmed
    }
    return '<p>' + trimmed.replace(/\n/g, ' ') + '</p>'
  })

  return wrapped.filter(Boolean).join('\n')
}

const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.mdx'))

const articles = files
  .map(f => {
    const raw = fs.readFileSync(path.join(articlesDir, f), 'utf8')
    const { data, content } = matter(raw)
    return { ...data, body: content }
  })
  .filter(a => a.date && a.slug && a.category && a.title)
  .sort((a, b) => (a.date < b.date ? 1 : -1))
  .slice(0, 20)

function buildZenItem(a) {
  const url = `${SITE_URL}/${a.category}/${a.slug}/`
  const bodyHtml = markdownToHtml(a.body)
  const fullHtml = `<h1>${a.title}</h1>\n<p>${a.description || ''}</p>\n${bodyHtml}`

  return `
  <item>
    <title>${escapeXml(a.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <description>${escapeXml(a.description || '')}</description>
    <pubDate>${toRfc822(a.date)}</pubDate>
    <content:encoded><![CDATA[${fullHtml}]]></content:encoded>
  </item>`
}

const itemsXml = articles.map(buildZenItem).join('')

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>СоветыДома</title>
    <link>${SITE_URL}</link>
    <description>Практические советы по кулинарии, уборке, огороду, лайфхаки и экономия для вашего дома.</description>
    <language>ru</language>
    <atom:link href="${SITE_URL}/zen.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${itemsXml}
  </channel>
</rss>`

const outPath = path.join(__dirname, '../public/zen.xml')
fs.writeFileSync(outPath, feed)
console.log(`Generated Yandex Zen feed with ${articles.length} items → public/zen.xml`)
