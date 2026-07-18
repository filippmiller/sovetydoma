import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkMutationRateLimit } from './rate-limit'

describe('admin-api mutation rate limit', () => {
  it('allows up to the per-minute cap then blocks, and resets after the window', () => {
    const t0 = 1_000_000
    for (let i = 0; i < 3; i++) {
      assert.equal(checkMutationRateLimit('actor-rl', 3, t0 + i), true)
    }
    assert.equal(checkMutationRateLimit('actor-rl', 3, t0 + 10), false)
    // Different actor is unaffected.
    assert.equal(checkMutationRateLimit('actor-rl-other', 3, t0 + 11), true)
    // Window rolls over.
    assert.equal(checkMutationRateLimit('actor-rl', 3, t0 + 61_000), true)
  })
})
