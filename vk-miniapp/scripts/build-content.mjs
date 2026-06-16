// Build a compact content snapshot for the VK Mini App from the site's MDX.
// Output: src/data/articles.json — { categories: [...], articles: [...] }.
// Bundled at build time so the mini-app needs no cross-origin fetch (no CORS).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'

const here = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(here, '..', '..')
const CONTENT_DIR = path.join(REPO, 'src', 'content', 'articles')
const OUT_DIR = path.join(here, '..', 'src', 'data')
const OUT = path.join(OUT_DIR, 'articles.json')

const { CATEGORIES } = await import(
  'file://' + path.join(REPO, 'src', 'lib', 'categories.mjs').replace(/\\/g, '/')
)

// Clean the MDX body into plain Markdown the mini-app can render with structure
// preserved (headings, paragraphs, lists) — NOT flattened into one blob.
function toBody(body, maxChars = 2600) {
  let md = body
    .replace(/^import .*$/gm, '')
    .replace(/^export .*$/gm, '')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')   // strip JSX/HTML tags, keep inner text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')  // drop images (shown separately)
    .replace(/\{[^}]*\}/g, '')             // drop stray JSX expressions
    .replace(/\n{3,}/g, '\n\n')            // collapse extra blank lines
    .trim()

  if (md.length <= maxChars) return md
  // Truncate on a paragraph boundary so we never cut a heading/sentence mid-way.
  const slice = md.slice(0, maxChars)
  const lastBreak = slice.lastIndexOf('\n\n')
  return (lastBreak > maxChars * 0.5 ? slice.slice(0, lastBreak) : slice).trim() + '\n\n…'
}

const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.mdx'))
const articles = []
for (const file of files) {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8')
  const { data, content } = matter(raw)
  if (!data.slug || !data.category) continue
  if (data.draft === true) continue
  articles.push({
    slug: data.slug,
    title: data.title || '',
    category: data.category,
    categoryName: data.categoryName || CATEGORIES[data.category]?.name || data.category,
    description: data.description || '',
    image: data.image || '',
    date: data.date || '',
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 6) : [],
    author: data.author || '',
    body: toBody(content),
    url: `https://1001sovet.ru/${data.category}/${data.slug}/`,
    schemaType: data.schemaType || undefined,
    recipeSteps: Array.isArray(data.recipeSteps) ? data.recipeSteps : undefined,
  })
}

// Newest first; categories with their live article counts.
articles.sort((a, b) => String(b.date).localeCompare(String(a.date)))
const counts = {}
for (const a of articles) counts[a.category] = (counts[a.category] || 0) + 1
const categories = Object.values(CATEGORIES)
  .map((c) => ({ slug: c.slug, name: c.name, description: c.description, count: counts[c.slug] || 0 }))
  .filter((c) => c.count > 0)

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ categories, articles, generatedAt: new Date().toISOString() }))
console.log(`VK mini-app content: ${articles.length} articles, ${categories.length} categories -> src/data/articles.json`)
