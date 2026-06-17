import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { renderSocialText } from './lib/social-text.mjs'
import { SUBSCRIPTION_CATEGORY_SLUGS } from '../src/lib/subscriptions/constants.mjs'

const ROOT = process.cwd()
const ARTICLES_DIR = path.join(ROOT, 'src/content/articles')
const OUT_DIR = path.join(ROOT, 'workers/subscriptions/src/generated')
const OUT_FILE = path.join(OUT_DIR, 'vk-publication-index.json')

// Single source of truth for top-level categories (all 12) — keep in sync via
// src/lib/subscriptions/constants.mjs instead of a local hardcoded subset.
const CATEGORY_SLUGS = new Set(SUBSCRIPTION_CATEGORY_SLUGS)

function toIsoMidnight(dateValue) {
  if (typeof dateValue !== 'string') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null
  const date = new Date(`${dateValue}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

// Render the Markdown body into readable social-wall text (headings, bullets,
// blank lines between blocks) instead of a flattened blob with raw "## ".
function stripMarkdownAndMdx(content) {
  return renderSocialText(content)
}

export function buildVkPublicationIndex() {
  const files = fs
    .readdirSync(ARTICLES_DIR)
    .filter((fileName) => fileName.endsWith('.mdx'))
    .sort((a, b) => a.localeCompare(b))

  const records = []
  for (const fileName of files) {
    const filePath = path.join(ARTICLES_DIR, fileName)
    const raw = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(raw)

    const articleSlug = path.basename(fileName, path.extname(fileName))
    const categorySlug = String(data?.category || '').trim()
    const title = String(data?.title || '').trim()
    const description = String(data?.description || '').trim()
    const imagePath = String(data?.image || '').trim()

    if (!CATEGORY_SLUGS.has(categorySlug)) continue
    if (!title) continue

    const plainText = stripMarkdownAndMdx(content)

    records.push({
      article_slug: articleSlug,
      category_slug: categorySlug,
      title,
      description,
      canonical_path: `/${categorySlug}/${articleSlug}/`,
      image_path: imagePath || `/images/${articleSlug}.jpg`,
      plain_text: plainText,
      published_at: toIsoMidnight(data?.date) ?? null,
    })
  }

  return records
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  const rows = buildVkPublicationIndex()
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
  process.stdout.write(`Generated ${rows.length} records → ${OUT_FILE}\n`)
}
