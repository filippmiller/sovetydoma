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
import { validateArticle } from './article-validation.mjs'

const ROOT = process.cwd()
const SRC = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'incoming-articles'
const DRY = process.argv.includes('--dry')
const SRC_DIR = path.resolve(ROOT, SRC)
const DEST_DIR = path.join(ROOT, 'src/content/articles')

if (!fs.existsSync(SRC_DIR)) {
  console.error(`Source folder not found: ${SRC_DIR}\nCreate it and drop Kimi .mdx files there, or pass a folder path.`)
  process.exit(2)
}

const existingSlugs = new Set(
  fs.readdirSync(DEST_DIR).filter((file) => file.endsWith('.mdx')).map((file) => file.replace(/\.mdx$/, '')),
)
const files = fs.readdirSync(SRC_DIR).filter((file) => file.endsWith('.mdx'))
if (!files.length) {
  console.error(`No .mdx files in ${SRC_DIR}`)
  process.exit(2)
}

const batchSlugs = new Set()
let imported = 0
let skipped = 0
console.log(`\nImporting from ${SRC_DIR}${DRY ? '  (DRY RUN)' : ''}\n`)

for (const file of files) {
  const raw = fs.readFileSync(path.join(SRC_DIR, file), 'utf8')
  let fm
  let content
  try {
    ;({ data: fm, content } = matter(raw))
  } catch (error) {
    console.log(`${file}: invalid frontmatter (${error.message})`)
    skipped++
    continue
  }

  const { errors, warnings } = validateArticle({ fm, content, existingSlugs, batchSlugs, requireImageSlug: true })
  if (errors.length) {
    console.log(`${file}:`)
    errors.forEach((error) => console.log(`     - ${error}`))
    skipped++
    continue
  }
  if (warnings.length) {
    console.log(`${file}: warnings:`)
    warnings.forEach((warning) => console.log(`     - ${warning}`))
  }

  batchSlugs.add(fm.slug)
  const dest = path.join(DEST_DIR, `${fm.slug}.mdx`)
  if (!DRY) fs.writeFileSync(dest, raw)
  console.log(`${file} -> src/content/articles/${fm.slug}.mdx [${fm.category}]`)
  imported++
}

console.log(`\nDone: ${imported} imported, ${skipped} skipped.`)
if (imported && !DRY) console.log('Next: review with `git diff`, then commit. Build will index them automatically.')
process.exit(skipped ? 1 : 0)
