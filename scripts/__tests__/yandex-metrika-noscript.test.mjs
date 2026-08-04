import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Yandex no-JS pixel is opaque to React hydration', async () => {
  const source = await readFile(new URL('../../src/components/YandexMetrika.tsx', import.meta.url), 'utf8')
  assert.match(source, /<noscript\s+dangerouslySetInnerHTML=/)
  assert.doesNotMatch(source, /<noscript>\s*<div>/)
})
