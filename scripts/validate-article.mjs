// Validate a Kimi-written (or any) MDX article against the site's frontmatter
// rules before it goes live. Usage:
//   node scripts/validate-article.mjs src/content/articles/my-new-slug.mdx
//
// Exits non-zero on any error so it can gate a commit.

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const CATEGORIES = {
  kulinaria: 'Кулинария',
  'dom-i-uborka': 'Дом и уборка',
  'dacha-i-ogorod': 'Дача и огород',
  layfkhaki: 'Лайфхаки',
  ekonomiya: 'Экономия',
  rybalka: 'Рыбалка',
}

const file = process.argv[2]
if (!file) { console.error('Usage: node scripts/validate-article.mjs <file.mdx>'); process.exit(2) }

const errs = []
const warns = []
const raw = fs.readFileSync(file, 'utf8')
const { data: fm, content } = matter(raw)

const req = ['title', 'slug', 'category', 'categoryName', 'description', 'date', 'image', 'tags']
for (const k of req) if (!fm[k] && fm[k] !== '') if (fm[k] === undefined) errs.push(`missing frontmatter: ${k}`)

if (fm.category && !CATEGORIES[fm.category]) errs.push(`invalid category "${fm.category}" (allowed: ${Object.keys(CATEGORIES).join(', ')})`)
if (fm.category && fm.categoryName && CATEGORIES[fm.category] && fm.categoryName !== CATEGORIES[fm.category])
  errs.push(`categoryName "${fm.categoryName}" must be "${CATEGORIES[fm.category]}" for category ${fm.category}`)

// slug must match filename and be url-safe ascii
const base = path.basename(file, '.mdx')
if (fm.slug && fm.slug !== base) errs.push(`slug "${fm.slug}" must equal filename "${base}"`)
if (fm.slug && !/^[a-z0-9-]+$/.test(fm.slug)) errs.push(`slug must be lowercase latin/digits/hyphens only (no Cyrillic)`)

// duplicate slug check
const dir = path.dirname(file)
const dupes = fs.readdirSync(dir).filter((f) => f.endsWith('.mdx') && f !== path.basename(file) && f.replace(/\.mdx$/, '') === fm.slug)
if (dupes.length) errs.push(`duplicate slug — already exists: ${dupes.join(', ')}`)

if (fm.tags && (!Array.isArray(fm.tags) || fm.tags.length === 0)) errs.push('tags must be a non-empty array')
if (fm.description && fm.description.length > 200) warns.push(`description ${fm.description.length} chars (keep <=160 for SEO)`)
if (fm.date && !/^\d{4}-\d{2}-\d{2}$/.test(fm.date)) errs.push('date must be YYYY-MM-DD')

// recipe-specific
if (fm.schemaType === 'Recipe' && (!fm.recipeIngredient || !Array.isArray(fm.recipeIngredient)))
  errs.push('Recipe articles need recipeIngredient (array)')

// body sanity
const words = content.trim().split(/\s+/).length
if (words < 200) warns.push(`body only ${words} words (aim for 600+)`)
if (!/^##\s/m.test(content)) warns.push('no "## " H2 headings found (TOC + structure need them)')

console.log(`\n=== ${path.basename(file)} ===`)
if (errs.length) { console.log('❌ ERRORS:'); errs.forEach((e) => console.log('  - ' + e)) }
if (warns.length) { console.log('⚠️  warnings:'); warns.forEach((w) => console.log('  - ' + w)) }
if (!errs.length && !warns.length) console.log('✅ valid, no warnings')
else if (!errs.length) console.log('✅ valid (warnings only)')

process.exit(errs.length ? 1 : 0)
