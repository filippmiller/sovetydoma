import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generateComparisonPairs } from './comparison-pairs.mjs'

function article(overrides) {
  return {
    title: 'Title',
    slug: 'title',
    category: 'kulinaria',
    tags: [],
    description: 'Desc',
    ...overrides,
  }
}

describe('generateComparisonPairs', () => {
  it('returns empty when no pairs share tags', () => {
    const pairs = generateComparisonPairs([
      article({ slug: 'a', tags: ['a'] }),
      article({ slug: 'b', tags: ['b'] }),
    ])
    assert.strictEqual(pairs.length, 0)
  })

  it('pairs articles with shared and complementary tags', () => {
    const pairs = generateComparisonPairs([
      article({ slug: 'a', tags: ['пирог', 'вишня'] }),
      article({ slug: 'b', tags: ['пирог', 'яблоко'] }),
    ])
    assert.strictEqual(pairs.length, 1)
    assert.strictEqual(pairs[0].a, 'a')
    assert.strictEqual(pairs[0].b, 'b')
    assert.deepStrictEqual(pairs[0].sharedTags, ['пирог'])
  })

  it('does not pair completely identical tag sets', () => {
    const pairs = generateComparisonPairs([
      article({ slug: 'a', tags: ['пирог'] }),
      article({ slug: 'b', tags: ['пирог'] }),
    ])
    assert.strictEqual(pairs.length, 0)
  })

  it('respects the global cap', () => {
    const articles = []
    for (let i = 0; i < 10; i++) {
      articles.push(article({ slug: `a${i}`, tags: ['shared', `tag${i}`] }))
    }
    const pairs = generateComparisonPairs(articles, 3, 20)
    assert.strictEqual(pairs.length, 3)
  })
})
