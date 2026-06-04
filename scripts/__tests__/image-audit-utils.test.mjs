import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildImageAudit,
  buildUnsplashQueries,
  chooseUniqueUnsplashResult,
} from '../image-audit-utils.mjs'

describe('buildImageAudit', () => {
  it('groups exact duplicates and reports missing and orphan images', () => {
    const articles = [
      { slug: 'bliny', image: '/images/bliny.jpg' },
      { slug: 'borshch', image: '/images/borshch.jpg' },
      { slug: 'kasha', image: '/images/kasha.jpg' },
      { slug: 'drifty', image: '/images/old-name.jpg' }, // drift case
    ]
    const images = [
      { slug: 'bliny', sha256: 'same' },
      { slug: 'borshch', sha256: 'same' },
      { slug: 'unused', sha256: 'other' },
    ]

    const audit = buildImageAudit({ articles, images })

    assert.deepEqual(audit.exactDuplicateGroups, [['bliny', 'borshch']])
    assert.deepEqual(audit.missingImages, ['drifty', 'kasha'])
    assert.deepEqual(audit.orphanImages, ['unused'])
    assert.equal(audit.uniqueImageCount, 2)
    assert.deepEqual(audit.imageFrontmatterDrifts, ['drifty'])
  })
})

describe('buildUnsplashQueries', () => {
  it('starts with a hand tuned query and then article-specific queries', () => {
    const queries = buildUnsplashQueries({
      slug: 'domashnie-bliny',
      title: 'Домашние блины на молоке',
      category: 'kulinaria',
      tags: ['блины', 'молоко'],
    })

    assert.equal(queries[0], 'russian pancakes blini')
    assert.ok(queries.includes('Домашние блины на молоке блины молоко'))
    assert.ok(queries.includes('russian food cooking dish'))
  })
})

describe('chooseUniqueUnsplashResult', () => {
  it('skips already used IDs and results without usable URLs', () => {
    const result = chooseUniqueUnsplashResult(
      [
        { id: 'used', urls: { regular: 'https://example.com/used.jpg' } },
        { id: 'broken', urls: {} },
        { id: 'fresh', urls: { regular: 'https://example.com/fresh.jpg' } },
      ],
      new Set(['used']),
    )

    assert.equal(result.id, 'fresh')
    assert.equal(result.url, 'https://example.com/fresh.jpg')
  })
})
