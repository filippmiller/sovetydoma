import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

// Emits a public, fetchable SearchableArticle[]-shaped JSON for the static
// article corpus (src/content/articles/*.mdx), so client components (header
// autocomplete, etc.) can fetch it directly instead of needing the full
// article list server-embedded into every page. Same shape as the dynamic
// counterpart served by workers/renderer's /api/search-index.json — see
// src/components/HeaderSearchAutocomplete.tsx, which fetches + merges both.
const CONTENT_DIR = path.join(process.cwd(), 'src/content/articles')
const OUT = path.join(process.cwd(), 'public/search-index-static.json')

const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.mdx'))
const rows = []
for (const file of files) {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8')
  const { data, content } = matter(raw)
  const slug = file.replace(/\.mdx$/, '')
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length
  rows.push({
    title: data.title || slug,
    description: data.description || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    category: data.category || '',
    categoryName: data.categoryName || '',
    slug,
    date: data.date || '',
    wordCount,
  })
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(rows))
console.log(`Generated static search index with ${rows.length} entries -> public/search-index-static.json`)
