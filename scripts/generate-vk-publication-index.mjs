import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'

const ROOT = process.cwd()
const ARTICLES_DIR = path.join(ROOT, 'src/content/articles')
const OUT_DIR = path.join(ROOT, 'workers/subscriptions/src/generated')
const OUT_FILE = path.join(OUT_DIR, 'vk-publication-index.json')

const CATEGORY_SLUGS = new Set([
  'kulinaria',
  'dom-i-uborka',
  'dacha-i-ogorod',
  'layfkhaki',
  'ekonomiya',
  'rybalka',
])

function toIsoMidnight(dateValue) {
  if (typeof dateValue !== 'string') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null
  const date = new Date(`${dateValue}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function stripMarkdownAndMdx(content) {
  // Remove import statements
  let text = content.replace(/^import\s+.+?\s+from\s+['"].+?['"];?\s*$/gim, '')
  // Remove JSX blocks (simple heuristic: lines starting with < and containing >)
  text = text.replace(/<([A-Z][A-Za-z0-9]*)[^>]*>[\s\S]*?<\/\1>/g, '')
  text = text.replace(/<[a-z][^>]*\/>/g, '')
  text = text.replace(/<[^>]+>/g, '')
  // Remove frontmatter already stripped by gray-matter
  // Remove markdown links, keep text
  text = text.replace(/\[!?([^\]]*)\]\([^)]*\)/g, '$1')
  text = text.replace(/\[!?([^\]]*)\]\[[^\]]*\]/g, '$1')
  // Remove bold/italic markers
  text = text.replace(/(\*{1,2}|_{1,2})(.+?)\1/g, '$2')
  // Remove code backticks
  text = text.replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
  // Remove horizontal rules
  text = text.replace(/^\s*[-=*]{3,}\s*$/gm, '')
  // Remove blockquote markers
  text = text.replace(/^\s*>\s?/gm, '')
  // Remove list markers
  text = text.replace(/^(\s*)[-*+\d]+\.\s+/gm, '$1')
  // Collapse excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n')
  // Trim
  text = text.trim()
  // Compact spaces to reduce bundle size
  text = text.replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').replace(/ \n/g, '\n').trim()
  return text
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
