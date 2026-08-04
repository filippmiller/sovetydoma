import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { CATEGORIES, SUBCATEGORIES } from '../../src/lib/categories.mjs'

const root = path.resolve(import.meta.dirname, '../..')

test('left-nav subcategory links stay on the canonical category hash route', () => {
  const nav = fs.readFileSync(path.join(root, 'src/components/FeedLeftNav.tsx'), 'utf8')

  assert.match(nav, /href=\{`\/\$\{slug\}\/#\$\{sub\.slug\}`\}/)
  for (const subcategory of Object.values(SUBCATEGORIES)) {
    assert.ok(CATEGORIES[subcategory.parentSlug], `${subcategory.slug} must have a real category route`)
  }
})
