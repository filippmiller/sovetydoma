import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { CATEGORIES, SUBCATEGORIES } from '../../src/lib/categories.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('every left-nav subcategory has a static route and canonical category filter', () => {
  const nav = read('src/components/FeedLeftNav.tsx')
  const articleRoute = read('src/app/[category]/[slug]/page.tsx')

  assert.match(nav, /href=\{`\/\$\{slug\}\/\$\{sub\.slug\}\/`\}/)
  assert.match(articleRoute, /Object\.values\(SUBCATEGORIES\)/)
  assert.match(articleRoute, /redirect\(`\/\$\{category\}\/#\$\{slug\}`\)/)

  for (const subcategory of Object.values(SUBCATEGORIES)) {
    assert.ok(CATEGORIES[subcategory.parentSlug], `${subcategory.slug} has a real parent category`)
  }
})

test('legacy healthy-eating links resolve to the canonical culinary content', () => {
  const articles = read('src/lib/articles.ts')
  const legacyCategory = read('src/app/zdorovoe-pitanie/page.tsx')

  assert.match(articles, /'rastitelny-belok-chem-zamenit-myaso': \{ oldCategory: 'zdorovoe-pitanie', newCategory: 'kulinaria' \}/)
  assert.match(legacyCategory, /redirect\('\/kulinaria\/'\)/)
})
