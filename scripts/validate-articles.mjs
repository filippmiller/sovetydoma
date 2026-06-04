import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { validateArticle } from './article-validation.mjs'

export function validateArticles({ articlesDir = path.join(process.cwd(), 'src/content/articles') } = {}) {
  const files = fs.readdirSync(articlesDir).filter((file) => file.endsWith('.mdx')).sort()
  const failures = []
  const batchSlugs = new Set()

  for (const file of files) {
    const filePath = path.join(articlesDir, file)
    const raw = fs.readFileSync(filePath, 'utf8')
    const { data: fm, content } = matter(raw)
    const result = validateArticle({
      fm,
      content,
      filePath,
      existingSlugs: new Set(),
      batchSlugs,
      requireFilenameSlug: true,
      requireImageSlug: true,
    })

    for (const error of result.errors) failures.push(`${file}: ${error}`)
    if (fm.slug) batchSlugs.add(fm.slug)
  }

  return { files, failures }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, failures } = validateArticles()
  if (failures.length) {
    console.error(`Article validation failed with ${failures.length} issue(s):`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }

  console.log(`Article validation passed for ${files.length} articles`)
}
