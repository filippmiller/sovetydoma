#!/usr/bin/env node
// Repair image frontmatter drifts: ensure every article has
// image: "/images/<slug>.jpg" exactly (the value the validator and
// components expect). This makes the 329 real jpg files visible
// instead of emoji fallbacks for drifted entries.
//
// Usage: node scripts/fix-image-frontmatter-drifts.mjs [--dry]
//
// Safe: only mutates the image: line; leaves titles, cyrillic, tags etc untouched.
// Idempotent.

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ARTICLES_DIR = path.join(ROOT, 'src/content/articles')
const DRY = process.argv.includes('--dry')

const files = fs.readdirSync(ARTICLES_DIR)
  .filter((f) => f.endsWith('.mdx'))
  .sort()

let fixed = 0
let alreadyGood = 0
const fixedSlugs = []

for (const file of files) {
  const filePath = path.join(ARTICLES_DIR, file)
  let text = fs.readFileSync(filePath, 'utf8')

  // Extract slug (prefer frontmatter, fallback to filename)
  const slugMatch = text.match(/^slug:\s*["']?([a-z0-9-]+)["']?/m)
  const slug = slugMatch ? slugMatch[1] : file.replace(/\.mdx$/, '')

  const expected = `/images/${slug}.jpg`

  // Current image value (if any)
  const imgMatch = text.match(/^image:\s*["']?([^"'\n]+?)["']?\s*$/m)
  const current = imgMatch ? imgMatch[1].trim() : ''

  if (current === expected) {
    alreadyGood++
    continue
  }

  // Replace the entire image: line (handles quoted/unquoted, any prior value)
  const replaced = text.replace(
    /^image:\s*["']?[^"'\n]*["']?\s*$/m,
    `image: "${expected}"`
  )

  if (replaced !== text) {
    if (!DRY) {
      fs.writeFileSync(filePath, replaced, 'utf8')
    }
    fixed++
    fixedSlugs.push(slug)
  }
}

console.log(`\nImage frontmatter fix${DRY ? ' (DRY RUN)' : ''}`)
console.log(`  Already correct: ${alreadyGood}`)
console.log(`  Fixed: ${fixed}`)
if (fixedSlugs.length && fixedSlugs.length <= 20) {
  console.log(`  Fixed slugs: ${fixedSlugs.join(', ')}`)
} else if (fixedSlugs.length) {
  console.log(`  Fixed slugs (first 15): ${fixedSlugs.slice(0,15).join(', ')} ... (+${fixedSlugs.length-15})`)
}
console.log(`\nNext: run 'node scripts/validate-articles.mjs' and 'node scripts/audit-article-images.mjs --json' to verify.`)

if (fixed && !DRY) {
  console.log('Review changes with git diff, then commit.')
}

process.exit(0)
