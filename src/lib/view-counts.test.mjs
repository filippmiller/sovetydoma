import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  getArticleViewStorageKey,
  getViewCount,
  sortArticlesByViews,
} from './view-counts.mjs'

describe('getArticleViewStorageKey', () => {
  it('uses one key per slug per UTC day', () => {
    const key = getArticleViewStorageKey('domashnie-bliny', new Date('2026-05-31T23:59:00Z'))
    assert.equal(key, 'article_viewed_domashnie-bliny_2026-05-31')
  })
})

describe('getViewCount', () => {
  it('returns the aggregate view count for a slug', () => {
    const rows = [
      { article_slug: 'a', kind: 'view', count: 12 },
      { article_slug: 'a', kind: 'helped', count: 99 },
      { article_slug: 'b', kind: 'view', count: 3 },
    ]

    assert.equal(getViewCount(rows, 'a'), 12)
    assert.equal(getViewCount(rows, 'missing'), 0)
  })
})

describe('sortArticlesByViews', () => {
  it('sorts by views first and newest date as fallback', () => {
    const articles = [
      { slug: 'old-popular', date: '2026-05-01' },
      { slug: 'new-empty', date: '2026-05-31' },
      { slug: 'less-popular', date: '2026-05-30' },
    ]
    const rows = [
      { article_slug: 'old-popular', kind: 'view', count: 10 },
      { article_slug: 'less-popular', kind: 'view', count: 2 },
    ]

    assert.deepEqual(
      sortArticlesByViews(articles, rows).map((a) => a.slug),
      ['old-popular', 'less-popular', 'new-empty'],
    )
  })
})
