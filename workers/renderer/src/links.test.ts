import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildHubHtml,
  buildHubIndexHtml,
  buildRelatedHtml,
  fetchAllPages,
  hashSlug,
  HUB_PAGE_SIZE,
  paginate,
  selectRelated,
  type RelatedCandidate,
} from './links'

function candidate(overrides: Partial<RelatedCandidate>): RelatedCandidate {
  return {
    slug: 'some-article',
    category: 'ekonomiya',
    title: 'Какая-то статья',
    description: 'Описание статьи',
    tags: [],
    image_filename: 'some-article.jpg',
    published_at: '2026-07-01T00:00:00+00:00',
    published_via: 'dynamic',
    text_status: 'published',
    ...overrides,
  }
}

describe('selectRelated', () => {
  it('never links unpublished rows (defensive publish filter)', () => {
    const candidates = [
      candidate({ slug: 'draft-one', text_status: 'draft' }),
      candidate({ slug: 'idea-one', text_status: 'idea' }),
      candidate({ slug: 'approved-one', text_status: 'approved' }),
      candidate({ slug: 'pub-one', text_status: 'published' }),
    ]
    const related = selectRelated(candidates, { slug: 'current', tags: [] }, 6)
    assert.deepEqual(related.map((r) => r.slug), ['pub-one'])
  })

  it('never emits self-links or duplicates', () => {
    const candidates = [
      candidate({ slug: 'current' }),
      candidate({ slug: 'a' }),
      candidate({ slug: 'a' }), // duplicate row from a bad join must not duplicate the link
      candidate({ slug: 'b' }),
    ]
    const related = selectRelated(candidates, { slug: 'current', tags: [] }, 6)
    const slugs = related.map((r) => r.slug)
    assert.equal(slugs.includes('current'), false)
    assert.equal(new Set(slugs).size, slugs.length)
    assert.deepEqual(slugs.sort(), ['a', 'b'])
  })

  it('returns everything when fewer candidates exist than requested', () => {
    const candidates = [candidate({ slug: 'a' }), candidate({ slug: 'b' })]
    const related = selectRelated(candidates, { slug: 'current', tags: [] }, 6)
    assert.equal(related.length, 2)
  })

  it('returns an empty list for an empty category', () => {
    assert.deepEqual(selectRelated([], { slug: 'current', tags: [] }, 6), [])
  })

  it('prefers articles with shared tags', () => {
    const candidates = [
      candidate({ slug: 'no-tags', tags: ['другое'], published_at: '2026-07-10T00:00:00+00:00' }),
      candidate({ slug: 'tagged', tags: ['вода', 'счётчики'], published_at: '2026-07-01T00:00:00+00:00' }),
    ]
    const related = selectRelated(candidates, { slug: 'current', tags: ['вода'] }, 1)
    assert.equal(related[0].slug, 'tagged')
  })

  it('is deterministic and spreads links across the corpus (rotation)', () => {
    const candidates = Array.from({ length: 30 }, (_, i) =>
      candidate({ slug: `art-${String(i).padStart(2, '0')}`, published_at: `2026-07-${String((i % 28) + 1).padStart(2, '0')}T00:00:00+00:00` }))
    const first = selectRelated(candidates, { slug: 'current-a', tags: [] }, 6).map((r) => r.slug)
    const second = selectRelated(candidates, { slug: 'current-a', tags: [] }, 6).map((r) => r.slug)
    const other = selectRelated(candidates, { slug: 'current-b', tags: [] }, 6).map((r) => r.slug)
    assert.deepEqual(first, second) // same input → same output
    assert.notDeepEqual(first, other) // different articles link different neighbours
  })
})

describe('fetchAllPages (PostgREST pagination)', () => {
  it('pages with limit/offset until a short page', async () => {
    const offsets: number[] = []
    const limits: number[] = []
    const rows = await fetchAllPages<number>(async (offset, limit) => {
      offsets.push(offset)
      limits.push(limit)
      // Simulate a 2,350-row table capped at 1,000 rows per response
      const remaining = 2350 - offset
      const n = Math.min(limit, Math.max(0, remaining))
      return Array.from({ length: n }, (_, i) => offset + i)
    })
    assert.deepEqual(offsets, [0, 1000, 2000])
    assert.deepEqual(limits, [1000, 1000, 1000])
    assert.equal(rows.length, 2350)
    assert.equal(rows[2349], 2349)
  })

  it('stops at maxRows even when more data exists', async () => {
    const rows = await fetchAllPages<number>(
      async (offset, limit) => Array.from({ length: limit }, (_, i) => offset + i),
      { pageSize: 100, maxRows: 250 },
    )
    assert.equal(rows.length, 300) // last full page is kept, then the loop stops
    assert.ok(rows.length >= 250)
  })

  it('handles an empty source', async () => {
    const rows = await fetchAllPages<number>(async () => [])
    assert.deepEqual(rows, [])
  })
})

describe('paginate', () => {
  const items = Array.from({ length: 95 }, (_, i) => i)

  it('slices pages correctly', () => {
    const p1 = paginate(items, 1, HUB_PAGE_SIZE)
    assert.equal(p1.items.length, HUB_PAGE_SIZE)
    assert.equal(p1.items[0], 0)
    assert.equal(p1.totalPages, 3)
    const p3 = paginate(items, 3, HUB_PAGE_SIZE)
    assert.equal(p3.items.length, 15)
    assert.equal(p3.items[0], 80)
  })

  it('clamps out-of-range pages', () => {
    const p = paginate(items, 99, HUB_PAGE_SIZE)
    assert.equal(p.page, 3)
    const p0 = paginate(items, 0, HUB_PAGE_SIZE)
    assert.equal(p0.page, 1)
  })

  it('handles empty input as page 1 of 1', () => {
    const p = paginate([], 1, HUB_PAGE_SIZE)
    assert.equal(p.totalPages, 1)
    assert.equal(p.totalItems, 0)
    assert.deepEqual(p.items, [])
  })
})

describe('hub + related HTML (crawlable without JavaScript)', () => {
  const categories = [
    { slug: 'ekonomiya', name: 'Экономия' },
    { slug: 'avto', name: 'Авто' },
  ]

  it('related block contains plain <a href> links, no scripts, no self-link', () => {
    const html = buildRelatedHtml(
      [candidate({ slug: 'rel-1' }), candidate({ slug: 'rel-2', image_filename: null })],
      { category: 'ekonomiya', categoryName: 'Экономия' },
    )
    assert.match(html, /<a [^>]*href="\/ekonomiya\/rel-1\/"/)
    assert.match(html, /<a [^>]*href="\/ekonomiya\/rel-2\/"/)
    assert.match(html, /href="\/stati\/ekonomiya\/"/) // hub link
    assert.equal(html.includes('<script'), false)
    assert.equal(html.includes('current-slug'), false)
  })

  it('related block escapes HTML in titles/descriptions', () => {
    const html = buildRelatedHtml(
      [candidate({ slug: 'x', title: '<b>жирный</b>', description: '5 < 7 & "кавычки"' })],
      { category: 'ekonomiya', categoryName: 'Экономия' },
    )
    assert.equal(html.includes('<b>жирный</b>'), false)
    assert.match(html, /&lt;b&gt;/)
    assert.match(html, /&quot;кавычки&quot;/)
  })

  it('hub page lists articles as crawlable links and paginates', () => {
    const html = buildHubHtml({
      siteUrl: 'https://1001sovet.ru',
      category: categories[0],
      categories,
      articles: [
        { slug: 'art-1', title: 'Первая', description: 'Описание', published_at: '2026-07-01T00:00:00+00:00' },
        { slug: 'art-2', title: 'Вторая', description: null, published_at: '2026-07-02T00:00:00+00:00' },
      ],
      page: 2,
      totalPages: 5,
      totalItems: 170,
    })
    assert.match(html, /<a class="item" href="\/ekonomiya\/art-1\/">/)
    assert.match(html, /<a class="item" href="\/ekonomiya\/art-2\/">/)
    assert.match(html, /<link rel="canonical" href="https:\/\/1001sovet\.ru\/stati\/ekonomiya\/2\/"\/>/)
    assert.match(html, /href="\/stati\/ekonomiya\/3\/"/) // next page
    assert.match(html, /rel="prev" href="\/stati\/ekonomiya\/"/) // prev → page 1 canonical
    assert.match(html, /href="\/ekonomiya\/"/) // link back to the main category page
    assert.equal(html.includes('<script'), false)
  })

  it('hub page 1 has a bare canonical and no self-referencing page link', () => {
    const html = buildHubHtml({
      siteUrl: 'https://1001sovet.ru',
      category: categories[0],
      categories,
      articles: [],
      page: 1,
      totalPages: 1,
      totalItems: 0,
    })
    assert.match(html, /<link rel="canonical" href="https:\/\/1001sovet\.ru\/stati\/ekonomiya\/"\/>/)
    assert.equal(html.includes('rel="next"'), false)
  })

  it('hub index links every category hub', () => {
    const html = buildHubIndexHtml(categories, 'https://1001sovet.ru')
    assert.match(html, /href="\/stati\/ekonomiya\/"/)
    assert.match(html, /href="\/stati\/avto\/"/)
    assert.match(html, /<link rel="canonical" href="https:\/\/1001sovet\.ru\/stati\/"\/>/)
    assert.equal(html.includes('<script'), false)
  })
})

describe('hashSlug', () => {
  it('is stable and distinguishes slugs', () => {
    assert.equal(hashSlug('abc'), hashSlug('abc'))
    assert.notEqual(hashSlug('abc'), hashSlug('abd'))
  })
})
