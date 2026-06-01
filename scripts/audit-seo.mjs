import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const articlesDir = path.join(root, 'src/content/articles')
const imagesDir = path.join(root, 'public/images')

const files = fs.readdirSync(articlesDir).filter((file) => file.endsWith('.mdx'))
const seenSlugs = new Set()
const seenTitles = new Set()
const seenDescriptions = new Set()
const failures = []

function fail(file, message) {
  failures.push(`${file}: ${message}`)
}

for (const file of files) {
  const fullPath = path.join(articlesDir, file)
  const { data, content } = matter(fs.readFileSync(fullPath, 'utf8'))
  const title = String(data.title || '').trim()
  const slug = String(data.slug || '').trim()
  const description = String(data.description || '').trim()
  const tags = Array.isArray(data.tags) ? data.tags : []
  const imagePath = path.join(imagesDir, `${slug}.jpg`)

  if (!title) fail(file, 'missing title')
  if (title.length < 20 || title.length > 95) fail(file, `title length should be 20-95 chars, got ${title.length}`)
  if (!slug) fail(file, 'missing slug')
  if (!/^[a-z0-9-]+$/.test(slug)) fail(file, `slug is not URL-safe: ${slug}`)
  if (!data.category) fail(file, 'missing category')
  if (!description) fail(file, 'missing description')
  if (description.length < 70 || description.length > 180) fail(file, `description length should be 70-180 chars, got ${description.length}`)
  if (tags.length < 2) fail(file, 'expected at least two tags')
  if (!/^## /m.test(content)) fail(file, 'expected at least one H2 section')
  if (!fs.existsSync(imagePath)) fail(file, `missing SEO image public/images/${slug}.jpg`)

  if (seenSlugs.has(slug)) fail(file, `duplicate slug: ${slug}`)
  seenSlugs.add(slug)
  if (seenTitles.has(title)) fail(file, `duplicate title: ${title}`)
  seenTitles.add(title)
  if (seenDescriptions.has(description)) fail(file, 'duplicate meta description')
  seenDescriptions.add(description)
}

if (failures.length > 0) {
  console.error(`SEO audit failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`SEO audit passed for ${files.length} articles`)
