import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const articlesDir = path.join(__dirname, '../src/content/articles')
const SITE_URL = 'https://1001sovet.ru'
const METRIKA_ID = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || 'XXXXXXXX'

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
 * Minimal markdown → HTML converter for Turbo content.
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
  // *italic* (single asterisk, not preceded/followed by another *)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')

  // Split into blocks on double newlines, wrap non-tag blocks in <p>
  const blocks = html.split(/\n{2,}/)
  const wrapped = blocks.map(block => {
    const trimmed = block.trim()
    if (!trimmed) return ''
    // Already a block-level HTML tag
    if (/^<(h[1-6]|p|ul|ol|li|blockquote|figure|hr|div)/.test(trimmed)) {
      return trimmed
    }
    // Join internal single newlines with a space
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

function buildTurboItem(a) {
  const url = `${SITE_URL}/${a.category}/${a.slug}/`
  const bodyHtml = markdownToHtml(a.body)
  const descHtml = escapeXml(a.description || '')

  return `
  <item turbo="true">
    <title>${escapeXml(a.title)}</title>
    <link>${url}</link>
    <pubDate>${toRfc822(a.date)}</pubDate>
    <turbo:content>
      <![CDATA[
        <header><h1>${a.title}</h1></header>
        <p>${a.description || ''}</p>
        ${bodyHtml}
      ]]>
    </turbo:content>
  </item>`
}

const itemsXml = articles.map(buildTurboItem).join('')

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:yandex="http://news.yandex.ru"
     xmlns:media="http://search.yahoo.com/mrss/"
     xmlns:turbo="http://turbo.yandex.ru"
     version="2.0">
  <channel>
    <title>СоветыДома</title>
    <link>${SITE_URL}</link>
    <language>ru</language>
    <turbo:analytics type="Metrika" id="${METRIKA_ID}"/>
    ${itemsXml}
  </channel>
</rss>`

const outPath = path.join(__dirname, '../public/turbo.xml')
fs.writeFileSync(outPath, feed)
console.log(`Generated Yandex Turbo feed with ${articles.length} items → public/turbo.xml`)
