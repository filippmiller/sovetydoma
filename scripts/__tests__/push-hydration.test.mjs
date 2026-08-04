import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

for (const component of ['CategoryPushSubscribe.tsx', 'CategoryFollowControl.tsx']) {
  test(`${component} defers browser-only push state until after hydration`, async () => {
    const source = await readFile(new URL(`../../src/components/${component}`, import.meta.url), 'utf8')
    assert.match(source, /const \[supported, setSupported\] = useState\(false\)/)
    assert.match(source, /const \[subscribed, setSubscribed\] = useState\(false\)/)
    assert.match(source, /setSupported\('PushManager' in window/)
    assert.doesNotMatch(source, /useState\(\(\) => \{\s*if \(typeof window/)
  })
}
