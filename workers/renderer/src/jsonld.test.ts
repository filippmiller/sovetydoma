import assert from 'node:assert/strict'
import test from 'node:test'
import { articleImageFilename, type ArticleRow } from './jsonld'

function row(slug: string, imageFilename: string | null = null): ArticleRow {
  return {
    slug,
    category: 'zdorovie-i-bezopasnost',
    title: 'Test',
    description: 'Test',
    body_md: null,
    tags: [],
    image_filename: imageFilename,
    frontmatter: {},
    published_at: '2026-07-18T00:00:00Z',
    updated_at: null,
    word_count: 1,
  }
}

test('replacement media uses a fresh immutable URL', () => {
  assert.equal(
    articleImageFilename(row('kak-snizit-davlenie-za-10-minut-bez-tabletok')),
    'kak-snizit-davlenie-za-10-minut-bez-tabletok-no-person.jpg',
  )
})

test('other articles keep their configured image filename', () => {
  assert.equal(articleImageFilename(row('other', 'custom.jpg')), 'custom.jpg')
})
