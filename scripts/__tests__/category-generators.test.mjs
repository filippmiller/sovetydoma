import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { CATEGORIES } from '../../src/lib/categories.mjs'

const root = path.join(import.meta.dirname, '..', '..')

describe('category generators', () => {
  it('keeps sitemap category hubs in sync with shared categories', () => {
    const sitemap = fs.readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8')

    for (const category of Object.values(CATEGORIES)) {
      assert.match(sitemap, new RegExp(`<loc>https://1001sovet\\.ru/${category.slug}/</loc>`))
    }
  })

  it('keeps per-category RSS feeds in sync with shared categories', () => {
    for (const category of Object.values(CATEGORIES)) {
      assert.equal(
        fs.existsSync(path.join(root, 'public', `feed-${category.slug}.xml`)),
        true,
        `missing feed-${category.slug}.xml`,
      )
    }
  })
})
