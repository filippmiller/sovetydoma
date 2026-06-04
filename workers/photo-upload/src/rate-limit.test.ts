import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildRateLimitBucket,
  checkIngestionRateLimit,
} from './rate-limit'

describe('photo worker ingestion rate limiting', () => {
  it('builds stable privacy-safe buckets without raw IP or slug values', async () => {
    const first = await buildRateLimitBucket('view', '203.0.113.10', 'test-article')
    const second = await buildRateLimitBucket('view', '203.0.113.10', 'test-article')
    const differentScope = await buildRateLimitBucket('analytics', '203.0.113.10')

    assert.equal(first, second)
    assert.notEqual(first, differentScope)
    assert.match(first, /^view:[A-Za-z0-9_-]{43}$/)
    assert.equal(first.includes('203.0.113.10'), false)
    assert.equal(first.includes('test-article'), false)
  })

  it('checks Supabase durable rate RPC with the service-role key only', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const allowed = await checkIngestionRateLimit({
      env: {
        SUPABASE_URL: 'https://example.supabase.co/',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      },
      bucketKey: 'analytics:abc',
      windowSeconds: 60,
      maxHits: 90,
      fetcher: async (url, init) => {
        calls.push({ url: String(url), init: init || {} })
        return new Response(JSON.stringify({ allowed: true }), { status: 200 })
      },
    })

    assert.equal(allowed, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/rpc/check_ingestion_rate_limit')
    assert.equal(calls[0].init.method, 'POST')
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
      bucket_key: 'analytics:abc',
      window_seconds: 60,
      max_hits: 90,
    })
    assert.equal((calls[0].init.headers as Record<string, string>).apikey, 'service-role')
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer service-role')
  })
})
