// Export SovetyDoma articles to the normalized Knowledge Core format.
//
// SovetyDoma stays a separate Russian site for now; this is the FUTURE
// import seam for HowBase Knowledge Core. It does not migrate anything — it
// only emits a normalized JSON snapshot you can later import.
//
//   node scripts/export-knowledge-articles.mjs
//   → writes knowledge-export.json at repo root
//
// Format: see docs/knowledge-core-export.md (KnowledgeArticleExport).

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const CONTENT_DIR = path.join(ROOT, 'src/content/articles')
const OUT = path.join(ROOT, 'knowledge-export.json')
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sovetydoma.vercel.app'

// Keep persona resolution in sync with src/lib/personas.ts (category → slug).
const PERSONA_BY_CATEGORY = {
  'dom-i-uborka': 'maryana-sidorova',
  kulinaria: 'maryana-sidorova',
  layfkhaki: 'petr-pupkin',
  'dacha-i-ogorod': 'petr-ivanov',
  ekonomiya: 'petr-ivanov',
}

/** Split raw MDX body into coarse blocks (heading / paragraph / list). */
function toBlocks(body) {
  const blocks = []
  const lines = body.split(/\r?\n/)
  let para = []
  const flushPara = () => {
    const text = para.join(' ').trim()
    if (text) blocks.push({ type: 'paragraph', text })
    para = []
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) { flushPara(); blocks.push({ type: 'heading', level: h[1].length, text: h[2].trim() }); continue }
    const li = line.match(/^\s*[-*]\s+(.*)$/)
    if (li) { flushPara(); blocks.push({ type: 'list_item', text: li[1].trim() }); continue }
    if (!line.trim()) { flushPara(); continue }
    para.push(line.trim())
  }
  flushPara()
  return blocks
}

const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.mdx'))
const exported = files.map((file) => {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')
  const { data: fm, content } = matter(raw)
  const slug = file.replace(/\.mdx$/, '')
  return {
    sourceSite: 'sovetydoma',
    sourceUrl: `${SITE_URL}/${fm.category}/${slug}/`,
    language: 'ru',
    title: fm.title || slug,
    slug,
    summary: fm.quickAnswer || fm.description || '',
    category: fm.category || '',
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    bodyBlocks: toBlocks(content),
    publishedAt: fm.date || '',
    updatedAt: fm.updated || fm.date || '',
    authorPersona: fm.author || PERSONA_BY_CATEGORY[fm.category] || undefined,
    seo: {
      title: fm.title || slug,
      description: fm.description || '',
    },
  }
})

fs.writeFileSync(OUT, JSON.stringify(exported, null, 2) + '\n')
console.log(`Exported ${exported.length} articles → ${path.relative(ROOT, OUT)}`)
