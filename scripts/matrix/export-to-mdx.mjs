// export-to-mdx.mjs — reconstruct validator-compliant MDX files from matrix rows.
// Does NOT change DB status (status flips to 'published' only after a successful deploy — see design P1-5).
// Usage: node scripts/matrix/export-to-mdx.mjs --status draft,reviewed,approved --limit 100 --out matrix-exports
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { CATEGORIES } from '../../src/lib/categories.mjs'
import helpers from './lib.mjs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const statuses = (arg('--status', 'draft,reviewed,approved')).split(',')
const limit = parseInt(arg('--limit', '100'), 10)
const outDir = path.resolve(arg('--out', 'matrix-exports'))
const DOMAIN = '1001sovet.ru'
const PERSONA = {
  kulinaria: 'maryana-sidorova', 'dom-i-uborka': 'maryana-sidorova',
  'dacha-i-ogorod': 'petr-ivanov', ekonomiya: 'petr-ivanov',
  layfkhaki: 'petr-pupkin', rybalka: 'andrey-rybak',
}
const TODAY = new Date().toISOString().slice(0, 10)

const sb = helpers.getServiceClient()
fs.mkdirSync(outDir, { recursive: true })

const { data, error } = await sb.from('content_matrix')
  .select('*').eq('domain', DOMAIN).eq('disposition', 'active')
  .in('text_status', statuses).not('body_md', 'is', null).not('image_filename', 'is', null)
  .limit(limit)
if (error) { console.error(error.message); process.exit(1) }

let written = 0, skipped = 0
for (const r of data || []) {
  const cat = CATEGORIES[r.category]
  if (!cat) { console.warn(`skip ${r.slug}: bad category ${r.category}`); skipped++; continue }
  const fm = r.frontmatter && typeof r.frontmatter === 'object' ? { ...r.frontmatter } : {}
  delete fm.target_wc
  const data2 = {
    title: r.title,
    slug: r.slug,
    category: r.category,
    categoryName: cat.name,
    description: r.description || '',
    date: r.published_at ? r.published_at.slice(0, 10) : TODAY,
    image: `/images/${r.image_filename}`,
    tags: Array.isArray(r.tags) && r.tags.length ? r.tags : ['советы'],
    author: fm.author || PERSONA[r.category] || 'maryana-sidorova',
    ...fm,
  }
  const mdx = matter.stringify('\n' + (r.body_md || '').trim() + '\n', data2)
  fs.writeFileSync(path.join(outDir, `${r.slug}.mdx`), mdx, 'utf8')
  written++
}
console.log(`Exported ${written} MDX to ${outDir} (skipped ${skipped}). Next: validate, move to src/content/articles, build, commit.`)
