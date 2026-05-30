// Bulk-import Kimi/AI-written MDX articles from a drop folder into the site.
//
//   node scripts/import-articles.mjs            # imports from ./incoming-articles
//   node scripts/import-articles.mjs <folder>   # custom source folder
//   node scripts/import-articles.mjs <folder> --dry   # validate only, don't copy
//
// Each .mdx in the folder is validated against the site's frontmatter rules.
// Valid files are copied to src/content/articles/<slug>.mdx (slug taken from
// frontmatter, so the filename is always correct). Invalid files are skipped
// and reported. Nothing that fails validation reaches the build.

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const ROOT = process.cwd()
const SRC = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'incoming-articles'
const DRY = process.argv.includes('--dry')
const SRC_DIR = path.resolve(ROOT, SRC)
const DEST_DIR = path.join(ROOT, 'src/content/articles')

const CATEGORIES = {
  kulinaria: 'Кулинария',
  'dom-i-uborka': 'Дом и уборка',
  'dacha-i-ogorod': 'Дача и огород',
  layfkhaki: 'Лайфхаки',
  ekonomiya: 'Экономия',
}

function validate(fm, content, existingSlugs, batchSlugs) {
  const errs = []
  for (const k of ['title', 'slug', 'category', 'categoryName', 'description', 'date', 'image', 'tags']) {
    if (fm[k] === undefined || fm[k] === null || fm[k] === '') errs.push(`missing ${k}`)
  }
  if (fm.category && !CATEGORIES[fm.category]) errs.push(`bad category "${fm.category}"`)
  if (fm.category && CATEGORIES[fm.category] && fm.categoryName !== CATEGORIES[fm.category])
    errs.push(`categoryName must be "${CATEGORIES[fm.category]}"`)
  if (fm.slug && !/^[a-z0-9-]+$/.test(fm.slug)) errs.push('slug must be ascii lowercase/digits/hyphens')
  if (fm.slug && existingSlugs.has(fm.slug)) errs.push(`slug already exists on site: ${fm.slug}`)
  if (fm.slug && batchSlugs.has(fm.slug)) errs.push(`duplicate slug within this batch: ${fm.slug}`)
  if (fm.tags && (!Array.isArray(fm.tags) || fm.tags.length === 0)) errs.push('tags must be a non-empty array')
  if (fm.date && !/^\d{4}-\d{2}-\d{2}$/.test(fm.date)) errs.push('date must be YYYY-MM-DD')
  if (fm.schemaType === 'Recipe' && !Array.isArray(fm.recipeIngredient)) errs.push('Recipe needs recipeIngredient[]')
  if (content.trim().split(/\s+/).length < 200) errs.push('body too short (<200 words)')
  return errs
}

if (!fs.existsSync(SRC_DIR)) {
  console.error(`Source folder not found: ${SRC_DIR}\nCreate it and drop Kimi .mdx files there, or pass a folder path.`)
  process.exit(2)
}

const existingSlugs = new Set(
  fs.readdirSync(DEST_DIR).filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, '')),
)
const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.mdx'))
if (!files.length) { console.error(`No .mdx files in ${SRC_DIR}`); process.exit(2) }

const batchSlugs = new Set()
let imported = 0, skipped = 0
console.log(`\nImporting from ${SRC_DIR}${DRY ? '  (DRY RUN)' : ''}\n`)

for (const f of files) {
  const raw = fs.readFileSync(path.join(SRC_DIR, f), 'utf8')
  let fm, content
  try { ({ data: fm, content } = matter(raw)) } catch (e) { console.log(`❌ ${f}: invalid frontmatter (${e.message})`); skipped++; continue }
  const errs = validate(fm, content, existingSlugs, batchSlugs)
  if (errs.length) {
    console.log(`❌ ${f}:`)
    errs.forEach((e) => console.log(`     - ${e}`))
    skipped++
    continue
  }
  batchSlugs.add(fm.slug)
  const dest = path.join(DEST_DIR, `${fm.slug}.mdx`)
  if (!DRY) fs.writeFileSync(dest, raw)
  console.log(`✅ ${f}  →  src/content/articles/${fm.slug}.mdx  [${fm.category}]`)
  imported++
}

console.log(`\nDone: ${imported} imported, ${skipped} skipped.`)
if (imported && !DRY) console.log('Next: review with `git diff`, then commit. Build will index them automatically.')
process.exit(skipped ? 1 : 0)
