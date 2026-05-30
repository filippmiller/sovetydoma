import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

// Emits a lightweight slug -> { category, title } map that CLIENT components
// can import (the main articles.ts reads the filesystem and is server-only).
const CONTENT_DIR = path.join(process.cwd(), 'src/content/articles')
const OUT = path.join(process.cwd(), 'src/lib/article-index.json')

const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.mdx'))
const index = {}
for (const file of files) {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8')
  const { data } = matter(raw)
  const slug = file.replace(/\.mdx$/, '')
  index[slug] = { category: data.category || '', title: data.title || slug }
}

fs.writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n')
console.log(`Generated article index with ${Object.keys(index).length} entries -> src/lib/article-index.json`)
