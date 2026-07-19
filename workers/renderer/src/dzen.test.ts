import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildDzenFeed, moscowDay, selectDailyDzenRows, type DzenRow } from './dzen'

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
    assert.match(xml, /<media:content url="https:\/\/1001sovet\.ru\/images\/sovet-i-uyut\.jpg" medium="image" type="image\/jpeg" \/>/)
    assert.doesNotMatch(xml, /pogovorim\.vsedomatut\.com/)
  })
})
