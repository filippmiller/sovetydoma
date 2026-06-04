// Validate a Kimi-written (or any) MDX article against the site's frontmatter
// rules before it goes live. Usage:
//   node scripts/validate-article.mjs src/content/articles/my-new-slug.mdx
//
// Exits non-zero on any error so it can gate a commit.

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { validateArticle } from './article-validation.mjs'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/validate-article.mjs <file.mdx>')
  process.exit(2)
}

const raw = fs.readFileSync(file, 'utf8')
const { data: fm, content } = matter(raw)

const dir = path.dirname(file)
const existingSlugs = new Set(
  fs.readdirSync(dir)
    .filter((item) => item.endsWith('.mdx') && item !== path.basename(file) && item.replace(/\.mdx$/, '') === fm.slug)
    .map(() => fm.slug),
)
const { errors, warnings } = validateArticle({
  fm,
  content,
  filePath: file,
  existingSlugs,
  requireFilenameSlug: true,
  requireImageSlug: true,
})

console.log(`\n=== ${path.basename(file)} ===`)
if (errors.length) {
  console.log('ERRORS:')
  errors.forEach((error) => console.log(`  - ${error}`))
}
if (warnings.length) {
  console.log('warnings:')
  warnings.forEach((warning) => console.log(`  - ${warning}`))
}
if (!errors.length && !warnings.length) console.log('valid, no warnings')
else if (!errors.length) console.log('valid (warnings only)')

process.exit(errors.length ? 1 : 0)
