import path from 'node:path'
import { CATEGORIES } from '../src/lib/categories.mjs'

export const MIN_ARTICLE_WORDS = 300

const CATEGORY_NAMES = Object.fromEntries(
  Object.entries(CATEGORIES).map(([slug, category]) => [slug, category.name]),
)

export function countWords(content) {
  return String(content || '').trim().split(/\s+/).filter(Boolean).length
}

export function hasMojibake(value) {
  return /[\uFFFD?]{2,}|Ð|Ñ|Â|Ã/.test(String(value || ''))
}

export function validateArticle({
  fm,
  content,
  filePath = '',
  existingSlugs = new Set(),
  batchSlugs = new Set(),
  requireFilenameSlug = false,
  requireImageSlug = false,
}) {
  const errors = []
  const warnings = []

  for (const key of ['title', 'slug', 'category', 'categoryName', 'description', 'date', 'image', 'tags']) {
    if (fm[key] === undefined || fm[key] === null || fm[key] === '') errors.push(`missing ${key}`)
  }

  if (fm.category && !CATEGORY_NAMES[fm.category]) errors.push(`bad category "${fm.category}"`)
  if (fm.category && CATEGORY_NAMES[fm.category] && fm.categoryName !== CATEGORY_NAMES[fm.category]) {
    errors.push(`categoryName must be "${CATEGORY_NAMES[fm.category]}"`)
  }

  if (fm.slug && !/^[a-z0-9-]+$/.test(fm.slug)) errors.push('slug must be ascii lowercase/digits/hyphens')

  if (requireImageSlug && fm.slug && fm.image && fm.image !== `/images/${fm.slug}.jpg`) {
    errors.push(`image must be "/images/${fm.slug}.jpg"`)
  }

  if (requireFilenameSlug && filePath && fm.slug) {
    const base = path.basename(filePath, '.mdx')
    if (fm.slug !== base) errors.push(`slug "${fm.slug}" must equal filename "${base}"`)
  }

  if (fm.slug && existingSlugs.has(fm.slug)) errors.push(`slug already exists on site: ${fm.slug}`)
  if (fm.slug && batchSlugs.has(fm.slug)) errors.push(`duplicate slug within this batch: ${fm.slug}`)

  if (fm.tags && (!Array.isArray(fm.tags) || fm.tags.length === 0)) errors.push('tags must be a non-empty array')
  if (fm.description && String(fm.description).length > 200) {
    warnings.push(`description ${String(fm.description).length} chars (keep <=160 for SEO)`)
  }
  if (fm.date && !/^\d{4}-\d{2}-\d{2}$/.test(fm.date)) errors.push('date must be YYYY-MM-DD')
  if (fm.schemaType === 'Recipe' && (!fm.recipeIngredient || !Array.isArray(fm.recipeIngredient))) {
    errors.push('Recipe articles need recipeIngredient (array)')
  }

  const words = countWords(content)
  if (words < MIN_ARTICLE_WORDS) {
    errors.push(`body only ${words} words (aim for 600+; minimum 300 enforced)`)
  }
  if (!/^##\s/m.test(String(content || ''))) warnings.push('no "## " H2 headings found (TOC + structure need them)')

  const textToCheck = [
    fm.title,
    fm.categoryName,
    fm.description,
    Array.isArray(fm.tags) ? fm.tags.join(' ') : '',
    content,
  ].join(' ')
  if (hasMojibake(textToCheck)) {
    errors.push('possible mojibake / encoding corruption detected in title/category/desc/tags/body')
  }

  return { errors, warnings, words }
}
