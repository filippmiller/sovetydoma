import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeArticleRecord } from './build-subscription-publication-index.mjs'

test('normalizes MDX frontmatter into a publication row', () => {
  const row = normalizeArticleRecord('src/content/articles/salat.mdx', {
    title: 'Salat',
    description: 'Quick salad',
    category: 'kulinaria',
    date: '2026-06-01',
  })

  assert.deepEqual(row, {
    article_slug: 'salat',
    category_slug: 'kulinaria',
    title: 'Salat',
    canonical_path: '/kulinaria/salat/',
    description: 'Quick salad',
    published_at: '2026-06-01T00:00:00.000Z',
  })
})

test('rejects an unknown category before Supabase upsert', () => {
  assert.throws(
    () => normalizeArticleRecord('src/content/articles/bad.mdx', {
      title: 'Bad',
      description: 'Invalid category',
      category: 'unknown',
      date: '2026-06-01',
    }),
    /Unknown category frontmatter/,
  )
})

test('accepts a newer top-level category (12-category taxonomy)', () => {
  // Previously only the original 6 categories were syndicated; the index now
  // covers all 12 top-level categories from the shared source of truth.
  const row = normalizeArticleRecord('src/content/articles/aptechka.mdx', {
    title: 'Аптечка',
    description: 'Что держать дома',
    category: 'zdorovie-i-bezopasnost',
    date: '2026-06-01',
  })

  assert.deepEqual(row, {
    article_slug: 'aptechka',
    category_slug: 'zdorovie-i-bezopasnost',
    title: 'Аптечка',
    canonical_path: '/zdorovie-i-bezopasnost/aptechka/',
    description: 'Что держать дома',
    published_at: '2026-06-01T00:00:00.000Z',
  })
})
