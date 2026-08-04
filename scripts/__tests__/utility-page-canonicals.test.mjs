import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const files = [
  ['src/app/search/page.tsx', '/search/'],
  ['src/app/podpiski/page.tsx', '/podpiski/'],
  ['src/app/izbrannoe/layout.tsx', '/izbrannoe/'],
  ['src/app/moy-kabinet/layout.tsx', '/moy-kabinet/'],
]

test('utility pages declare a canonical URL even when noindex', () => {
  for (const [relativePath, canonical] of files) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
    assert.match(source, new RegExp(`canonicalPath\\('${canonical.replaceAll('/', '\\/')}\\'\\)`))
  }
})
