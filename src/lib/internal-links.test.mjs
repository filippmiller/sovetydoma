import assert from 'node:assert'
import test from 'node:test'
import { findInternalLinks } from './internal-links.mjs'

function article(overrides) {
  return {
    title: 'Title',
    slug: 'title',
    category: 'dom-i-uborka',
    tags: [],
    wordCount: 500,
    description: 'Desc',
    date: '2026-06-01',
    ...overrides,
  }
}

test('excludes self and duplicates', () => {
  const source = article({ slug: 'a', tags: ['уборка'] })
  const all = [
    source,
    article({ slug: 'b', tags: ['уборка'] }),
    article({ slug: 'c', tags: ['уборка'] }),
  ]
  const links = findInternalLinks(source, all, 4)
  assert.strictEqual(links.length, 2)
  assert.ok(!links.some((l) => l.slug === 'a'))
})

test('prefers shared tags over same category only', () => {
  const source = article({ slug: 'a', category: 'kulinaria', tags: ['пирог'] })
  const all = [
    source,
    article({ slug: 'b', category: 'kulinaria', tags: ['суп'] }),
    article({ slug: 'c', category: 'dom-i-uborka', tags: ['пирог'] }),
  ]
  const links = findInternalLinks(source, all, 4)
  assert.strictEqual(links[0].slug, 'c')
  assert.strictEqual(links[1].slug, 'b')
})

test('returns empty array when no overlap', () => {
  const source = article({ slug: 'a', title: 'Foo', tags: ['a'] })
  const all = [source, article({ slug: 'b', title: 'Bar', tags: ['b'] })]
  const links = findInternalLinks(source, all, 4)
  assert.strictEqual(links.length, 0)
})
