import assert from 'node:assert/strict'
import test from 'node:test'
import { processVkAutopost } from './vk-autopost'
import type { Env } from '../types'

const baseEnv: Env = {
  PUBLIC_SITE_URL: 'https://1001sovet.ru',
  VK_ACCESS_TOKEN: 'test-token',
  VK_GROUP_ID: '123456',
  VK_API_VERSION: '5.199',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
}

// These tests are dry-run / shallow because the real dependencies
// (Supabase REST + VK API) are mocked implicitly by the absence of
// network in node:test.  We verify structural behaviour: skipped when
// unconfigured, skipped outside hours, and that the function returns
// the expected shape.

test('processVkAutopost skips when supabase not configured', async () => {
  const result = await processVkAutopost({
    PUBLIC_SITE_URL: 'https://1001sovet.ru',
    VK_ACCESS_TOKEN: 'test-token',
    VK_GROUP_ID: '123456',
  })
  assert.equal(result.ran, false)
  assert.equal(result.skippedReason, 'supabase_service_role_not_configured')
})

test('processVkAutopost skips when VK not configured', async () => {
  const result = await processVkAutopost({
    PUBLIC_SITE_URL: 'https://1001sovet.ru',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  })
  assert.equal(result.ran, false)
  assert.equal(result.skippedReason, 'vk_not_configured')
})

test('processVkAutopost skips outside Moscow posting hours', async () => {
  // 03:00 Moscow time (UTC+3) => outside 09-21 window
  const night = new Date('2026-06-06T00:00:00Z')
  const result = await processVkAutopost(baseEnv, night)
  assert.equal(result.ran, false)
  assert.equal(result.skippedReason, 'outside_posting_hours')
})

test('processVkAutopost attempts to run during posting hours when configured', async () => {
  // 12:00 Moscow time (UTC+3) => 09:00 UTC, inside window
  const noonMoscow = new Date('2026-06-06T09:00:00Z')

  // Mock fetch to return empty arrays for Supabase queries and valid
  // rate-limit responses for the RPC endpoint.
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await processVkAutopost(baseEnv, noonMoscow)
    assert.equal(result.ran, false)
    assert.equal(result.skippedReason, 'no_unposted_articles')
  } finally {
    globalThis.fetch = originalFetch
  }
})
