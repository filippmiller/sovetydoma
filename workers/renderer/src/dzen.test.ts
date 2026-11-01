import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildDzenFeed, dzenIndexSince, moscowDay, nextDzenRenderBatch, renderDzenItem, selectDailyDzenRows, wrapDzenFeed, type DzenRow } from './dzen'

function row(slug: string, publishedAt: string, overrides: Partial<DzenRow> = {}): DzenRow {
  return {
    slug,
    category: 'dom-i-uborka',
    title: `Заголовок ${slug}`,
    description: `Описание ${slug}`,
    body_md: 'Первый абзац.\n\n## Раздел\n\nТекст.',
    image_filename: `${slug}.jpg`,
    published_at: publishedAt,
    ...overrides,
  }
}

describe('Dzen daily feed', () => {
  it('groups timestamps by fixed Moscow UTC+3 calendar day', () => {
    assert.equal(moscowDay('2026-07-18T21:30:00Z'), '2026-07-19')
    assert.equal(moscowDay('2026-07-19T20:59:59Z'), '2026-07-19')
    assert.equal(moscowDay('not-a-date'), '')
  })

  it('keeps the earliest publication per day and returns newest days first', () => {
    const selected = selectDailyDzenRows([
      row('day-2-late', '2026-07-19T12:00:00Z'),
      row('day-1', '2026-07-18T05:00:00Z'),
      row('day-2-first', '2026-07-18T22:00:00Z'),
    ])
    assert.deepEqual(selected.map((item) => item.slug), ['day-2-first', 'day-1'])
  })

  it('selects days from light index rows that carry no body', () => {
    const selected = selectDailyDzenRows([
      { slug: 'a', published_at: '2026-07-19T04:00:00Z', updated_at: null },
      { slug: 'b', published_at: '2026-07-20T04:00:00Z', updated_at: '2026-07-21T00:00:00Z' },
    ])
    assert.deepEqual(selected.map((item) => item.slug), ['b', 'a'])
  })

  it('queries only the recent window, never before the configured start date', () => {
    assert.equal(dzenIndexSince('2026-07-19', new Date('2026-11-01T09:00:00Z')), '2026-09-27')
    assert.equal(dzenIndexSince('2026-07-19', new Date('2026-08-01T09:00:00Z')), '2026-07-19')
  })

  it('renders at most the budget of uncached days, newest first', () => {
    const selected = ['d5', 'd4', 'd3', 'd2', 'd1'].map((slug) => ({ slug }))
    assert.deepEqual(nextDzenRenderBatch(selected, new Set(), 3).map((row) => row.slug), ['d5', 'd4', 'd3'])
    assert.deepEqual(nextDzenRenderBatch(selected, new Set(['d5', 'd3']), 3).map((row) => row.slug), ['d4', 'd2', 'd1'])
    assert.deepEqual(nextDzenRenderBatch(selected, new Set(['d5', 'd4', 'd3', 'd2', 'd1']), 3), [])
  })

  it('assembles the same feed from cached items as from rows', () => {
    const rows = [row('a', '2026-07-20T04:00:00Z'), row('b', '2026-07-19T04:00:00Z')]
    const now = new Date('2026-07-21T00:00:00Z')
    const fromItems = wrapDzenFeed(rows.map((item) => renderDzenItem(item, 'https://1001sovet.ru')), 'https://1001sovet.ru', now)
    assert.equal(fromItems, buildDzenFeed(rows, 'https://1001sovet.ru', now))
  })

  it('builds canonical UTF-8 RSS with full content and an image', () => {
    const xml = buildDzenFeed([
      row('sovet-i-uyut', '2026-07-19T04:00:00Z', {
        title: 'Совет & уют',
        description: 'Дом < дача',
      }),
    ], 'https://1001sovet.ru/', new Date('2026-07-19T06:00:00Z'))

    assert.match(xml, /<title>СоветыДома<\/title>/)
    assert.match(xml, /https:\/\/1001sovet\.ru\/dom-i-uborka\/sovet-i-uyut\//)
    assert.match(xml, /Совет &amp; уют/)
    assert.match(xml, /Дом &lt; дача/)
    assert.match(xml, /<content:encoded><!\[CDATA\[/)
    assert.match(xml, /<h2 id="раздел">Раздел<\/h2>/)
    assert.match(xml, /<figure><img src="https:\/\/1001sovet\.ru\/images\/sovet-i-uyut\.jpg"/)
    assert.match(xml, /<figcaption>.*<\/figcaption><\/figure>/)
    assert.match(xml, /<enclosure url="https:\/\/1001sovet\.ru\/images\/sovet-i-uyut\.jpg" type="image\/jpeg" \/>/)
    assert.doesNotMatch(xml, /<media:content/)
    assert.doesNotMatch(xml, /pogovorim\.vsedomatut\.com/)
  })
})
