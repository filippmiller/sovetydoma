import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { describe, it } from 'node:test'
import { validateArticle } from '../article-validation.mjs'

const root = path.join(import.meta.dirname, '..', '..')
const articlesDir = path.join(root, 'src', 'content', 'articles')

function validFrontmatter(overrides = {}) {
  return {
    title: 'Проверочная статья',
    slug: 'proverochnaya-statya',
    category: 'layfkhaki',
    categoryName: 'Лайфхаки',
    description: 'Короткое описание проверочной статьи без поврежденной кодировки.',
    date: '2026-06-04',
    image: '/images/proverochnaya-statya.jpg',
    tags: ['проверка', 'контент'],
    ...overrides,
  }
}

function words(count) {
  return Array.from({ length: count }, (_, index) => `слово${index}`).join(' ')
}

describe('article validation', () => {
  it('rejects imported articles below the same 300-word minimum as production validation', () => {
    const result = validateArticle({
      fm: validFrontmatter(),
      content: words(299),
      filePath: path.join(articlesDir, 'proverochnaya-statya.mdx'),
      existingSlugs: new Set(),
      batchSlugs: new Set(),
    })

    assert.match(result.errors.join('\n'), /minimum 300/)
  })

  it('rejects mojibake in frontmatter and body', () => {
    const result = validateArticle({
      fm: validFrontmatter({
        title: 'ÐŸÐ¾Ð²Ñ€ÐµÐ¶Ð´ÐµÐ½Ð½Ñ‹Ð¹ Ñ‚ÐµÐºÑÑ‚',
        description: '??????????? ????????',
      }),
      content: `${words(310)}\n\n## Раздел\n\nÐŸÐ»Ð¾Ñ…Ð°Ñ ÐºÐ¾Ð´Ð¸Ñ€Ð¾Ð²ÐºÐ°`,
      filePath: path.join(articlesDir, 'proverochnaya-statya.mdx'),
      existingSlugs: new Set(),
      batchSlugs: new Set(),
    })

    assert.match(result.errors.join('\n'), /mojibake/)
  })

  it('rejects image frontmatter that does not match the slug when required for imports', () => {
    const result = validateArticle({
      fm: validFrontmatter({ image: '/images/placeholder.jpg' }),
      content: `${words(310)}\n\n## Раздел\n\nТекст проверки.`,
      filePath: path.join(articlesDir, 'proverochnaya-statya.mdx'),
      existingSlugs: new Set(),
      batchSlugs: new Set(),
      requireImageSlug: true,
    })

    assert.match(result.errors.join('\n'), /image must be/)
  })

  it('keeps the production corpus above the minimum and free of mojibake', () => {
    const failures = []

    for (const file of fs.readdirSync(articlesDir).filter((item) => item.endsWith('.mdx'))) {
      const filePath = path.join(articlesDir, file)
      const raw = fs.readFileSync(filePath, 'utf8')
      const { data: fm, content } = matter(raw)
      const result = validateArticle({
        fm,
        content,
        filePath,
        existingSlugs: new Set(),
        batchSlugs: new Set(),
        requireFilenameSlug: true,
      })
      const relevantErrors = result.errors.filter((error) => /minimum 300|mojibake/.test(error))
      if (relevantErrors.length) failures.push(`${file}: ${relevantErrors.join('; ')}`)
    }

    assert.deepEqual(failures, [])
  })
})
