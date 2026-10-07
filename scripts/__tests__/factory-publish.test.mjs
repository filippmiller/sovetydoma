import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { publishArgs } from '../factory/publish-generated.mjs'
import { allSlugsPublished, assertAllSlugsReady, updateConfirmed, validateRequiredSlugs } from '../matrix/publish-require-all.mjs'

describe('factory publish safety', () => {
  it('passes only validated generated slugs and exact count to publisher', () => {
    const result = { schema: 1, ok: true, dryRun: false, exitCode: 0, counts: { requested: 2, generated: 2 }, generated: [{ slug: 'first-article' }, { slug: 'second-article' }] }
    assert.deepEqual(publishArgs(result), ['scripts/matrix/publish-dynamic.mjs', '--slugs', 'first-article,second-article', '--limit', '2', '--require-all'])
  })

  it('refuses partial, empty, malformed, or duplicate machine results', () => {
    for (const result of [null, { schema: 1, ok: false, exitCode: 1, generated: [{ slug: 'x' }] }, { schema: 1, ok: true, exitCode: 0, counts: { requested: 0, generated: 0 }, generated: [] }, { schema: 1, ok: true, exitCode: 0, counts: { requested: 1, generated: 1 }, generated: [{ slug: '../x' }] }, { schema: 1, ok: true, exitCode: 0, counts: { requested: 2, generated: 2 }, generated: [{ slug: 'x' }, { slug: 'x' }] }, { schema: 1, ok: true, dryRun: true, exitCode: 0, counts: { requested: 1, generated: 0 }, generated: [{ slug: 'x' }] }]) {
      assert.throws(() => publishArgs(result))
    }
  })

  it('requires every requested slug to be ready before publishing starts', () => {
    assert.throws(() => assertAllSlugsReady(['a', 'b'], [{ slug: 'a' }]), /no articles will publish/)
    assert.throws(() => validateRequiredSlugs(['a', '', 'b']))
    assert.throws(() => validateRequiredSlugs(['a', 'a']))
    assert.equal(assertAllSlugsReady(['a'], [{ slug: 'a' }]), true)
    assert.equal(allSlugsPublished(['a', 'b'], 2), true)
    assert.equal(allSlugsPublished(['a', 'b'], 1), false)
    assert.equal(updateConfirmed([{ id: 'row-1' }], 'row-1'), true)
    assert.equal(updateConfirmed([], 'row-1'), false)
    assert.equal(updateConfirmed([{ id: 'other' }], 'row-1'), false)
  })
})
