import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { SUBSCRIPTION_CATEGORY_SLUGS } from '../src/lib/subscriptions/constants.mjs'

const ROOT = process.cwd()
const ARTICLES_DIR = path.join(ROOT, 'src/content/articles')
// Single source of truth for top-level categories (all 12) — keep scripts, app
// and worker in sync via src/lib/subscriptions/constants.mjs instead of a local
// hardcoded subset.
const CATEGORY_SLUGS = new Set(SUBSCRIPTION_CATEGORY_SLUGS)

function toIsoMidnight(dateValue) {
  if (typeof dateValue !== 'string') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null

  const date = new Date(`${dateValue}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function normalizeArticleRecord(filePath, frontmatter) {
  const articleSlug = path.basename(filePath, path.extname(filePath))
  const categorySlug = String(frontmatter?.category || '').trim()
  const title = String(frontmatter?.title || '').trim()
  const description = String(frontmatter?.description || '').trim()

  if (!articleSlug) {
    throw new Error(`Unable to derive article slug from path: ${filePath}`)
  }
  if (!categorySlug) {
    throw new Error(`Missing category frontmatter for article: ${filePath}`)
  }
  if (!CATEGORY_SLUGS.has(categorySlug)) {
    throw new Error(`Unknown category frontmatter for article: ${filePath}`)
  }
  if (!title) {
    throw new Error(`Missing title frontmatter for article: ${filePath}`)
  }

  return {
    article_slug: articleSlug,
    category_slug: categorySlug,
    title,
    canonical_path: `/${categorySlug}/${articleSlug}/`,
    description,
    published_at: toIsoMidnight(frontmatter?.date) ?? null,
  }
}

export function buildPublicationIndex() {
  const files = fs
    .readdirSync(ARTICLES_DIR)
    .filter((fileName) => fileName.endsWith('.mdx'))
    .sort((a, b) => a.localeCompare(b))

  const rows = []
  for (const fileName of files) {
    const filePath = path.join(ARTICLES_DIR, fileName)
    const raw = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(raw)
    // Syndicate all known top-level categories; skip anything outside the
    // taxonomy rather than failing the whole sync.
    const categorySlug = String(data?.category || '').trim()
    if (!CATEGORY_SLUGS.has(categorySlug)) continue
    rows.push(normalizeArticleRecord(filePath, data))
  }
  return rows
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  const rows = buildPublicationIndex()
  process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`)
}
