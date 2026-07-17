import assert from 'node:assert/strict'
import test from 'node:test'
import { verifyOAuthState } from './oauth-state'

// CSRF state verification for the custom OAuth flows (Yandex + VK ID).

test('oauth state: exact match passes', () => {
  assert.equal(verifyOAuthState('abc123', 'abc123'), true)
})

test('oauth state: mismatch is rejected (attacker/forged callback)', () => {
  assert.equal(verifyOAuthState('abc123', 'xyz789'), false)
})

test('oauth state: missing stored value is rejected (replay after one-time delete)', () => {
  assert.equal(verifyOAuthState(null, 'abc123'), false)
  assert.equal(verifyOAuthState(undefined, 'abc123'), false)
  assert.equal(verifyOAuthState('', 'abc123'), false)
})

test('oauth state: missing returned value is rejected', () => {
  assert.equal(verifyOAuthState('abc123', null), false)
  assert.equal(verifyOAuthState('abc123', undefined), false)
  assert.equal(verifyOAuthState('abc123', ''), false)
})

test('oauth state: both missing is rejected (no undefined===undefined pass)', () => {
  assert.equal(verifyOAuthState(null, null), false)
  assert.equal(verifyOAuthState(undefined, undefined), false)
  assert.equal(verifyOAuthState('', ''), false)
})
