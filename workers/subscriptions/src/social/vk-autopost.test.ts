import assert from 'node:assert/strict'
import test from 'node:test'
import { processVkAutopost } from './vk-autopost'
import type { Env } from '../types'

const baseEnv: Env = {
  PUBLIC_SITE_URL: 'https://1001sovet.ru',
  VK_ACCESS_TOKEN: 'test-token',
  VK_PHOTO_ACCESS_TOKEN: 'test-photo-token',
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

test('processVkAutopost can run link fallback when VK photo token is missing', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('articles_publication_index')) {
      return new Response(JSON.stringify([{
        article_slug: 'agrovolokno-pod-klubniku-vesnoy',
        category_slug: 'dacha-i-ogorod',
        title: 'Агроволокно под клубнику весной',
        canonical_path: '/dacha-i-ogorod/agrovolokno-pod-klubniku-vesnoy/',
        description: 'test',
        published_at: '2026-06-06T00:00:00.000Z',
        first_seen_at: '2026-06-06T00:00:00.000Z',
      }]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('/images/agrovolokno-pod-klubniku-vesnoy.jpg')) {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } })
    }
    if (url.includes('/wall.post')) {
      return new Response(JSON.stringify({ response: { post_id: 42 } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: 'publication-row' }), { status: 201, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await processVkAutopost({
      PUBLIC_SITE_URL: 'https://1001sovet.ru',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      VK_ACCESS_TOKEN: 'test-token',
      VK_GROUP_ID: '123456',
      VK_API_BASE_URL: 'https://api.vk.test/method',
    }, new Date('2026-06-06T09:00:00Z'))
    assert.equal(result.ran, true)
    assert.equal(result.posted, true)
    assert.equal(result.providerPostId, '42')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('processVkAutopost skips when VK access token is missing', async () => {
  const result = await processVkAutopost({
    PUBLIC_SITE_URL: 'https://1001sovet.ru',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    VK_GROUP_ID: '123456',
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

test('processVkAutopost routes to mapped group when VK_GROUPS_BY_CATEGORY matches article category', async () => {
  const originalFetch = globalThis.fetch
  let capturedWallPostBody: URLSearchParams | null = null
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('articles_publication_index')) {
      return new Response(JSON.stringify([{
        article_slug: 'agrovolokno-pod-klubniku-vesnoy',
        category_slug: 'dacha-i-ogorod',
        title: 'Агроволокно',
        canonical_path: '/dacha-i-ogorod/agrovolokno-pod-klubniku-vesnoy/',
        description: 'test',
        published_at: '2026-06-06T00:00:00.000Z',
        first_seen_at: '2026-06-06T00:00:00.000Z',
      }]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('/images/agrovolokno-pod-klubniku-vesnoy.jpg')) {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } })
    }
    if (url.includes('/wall.post')) {
      capturedWallPostBody = new URLSearchParams(String(init?.body || ''))
      return new Response(JSON.stringify({ response: { post_id: 55 } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: 'publication-row' }), { status: 201, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await processVkAutopost({
      ...baseEnv,
      VK_PHOTO_ACCESS_TOKEN: undefined,
      VK_API_BASE_URL: 'https://api.vk.test/method',
      VK_GROUPS_BY_CATEGORY: JSON.stringify({ 'dacha-i-ogorod': { groupId: '777666' } }),
    }, new Date('2026-06-06T09:00:00Z'))
    assert.equal(result.ran, true)
    assert.equal(result.posted, true)
    assert.equal(result.providerPostId, '55')
    // must use the mapped group, not the default 123456
    assert.equal(capturedWallPostBody?.get('owner_id'), '-777666')
    assert.equal(result.postUrl, 'https://vk.com/wall-777666_55')
  } finally {
    globalThis.fetch = originalFetch
  }
})

// Design note: when VK_GROUPS_BY_CATEGORY is present (even with categories that don't
// match available articles), the worker operates in multi-group mode and only posts to
// the explicitly configured categories. The single-group fallback (VK_GROUP_ID) only
// activates when VK_GROUPS_BY_CATEGORY is absent/empty/malformed.
test('processVkAutopost in multi-group mode posts only to configured categories (not default group)', async () => {
  const originalFetch = globalThis.fetch
  let capturedWallPostBody: URLSearchParams | null = null
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('articles_publication_index')) {
      return new Response(JSON.stringify([{
        article_slug: 'agrovolokno-pod-klubniku-vesnoy',
        category_slug: 'dacha-i-ogorod',
        title: 'Агроволокно',
        canonical_path: '/dacha-i-ogorod/agrovolokno-pod-klubniku-vesnoy/',
        description: 'test',
        published_at: '2026-06-06T00:00:00.000Z',
        first_seen_at: '2026-06-06T00:00:00.000Z',
      }]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('/images/agrovolokno-pod-klubniku-vesnoy.jpg')) {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } })
    }
    if (url.includes('/wall.post')) {
      capturedWallPostBody = new URLSearchParams(String(init?.body || ''))
      return new Response(JSON.stringify({ response: { post_id: 66 } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: 'publication-row' }), { status: 201, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await processVkAutopost({
      ...baseEnv,
      VK_PHOTO_ACCESS_TOKEN: undefined,
      VK_API_BASE_URL: 'https://api.vk.test/method',
      // rybalka is mapped → multi-group mode: only post to configured categories
      VK_GROUPS_BY_CATEGORY: JSON.stringify({ rybalka: { groupId: '444555' } }),
    }, new Date('2026-06-06T09:00:00Z'))
    assert.equal(result.ran, true)
    assert.equal(result.posted, true)
    // In multi-group mode, posts go to the configured group (444555), not the default
    assert.equal(capturedWallPostBody?.get('owner_id'), '-444555')
    assert.equal(result.postUrl, 'https://vk.com/wall-444555_66')
    // Result carries categoryResults
    assert.equal(result.categoryResults?.length, 1)
    assert.equal(result.categoryResults?.[0]?.groupId, '444555')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('processVkAutopost falls back to default group on malformed VK_GROUPS_BY_CATEGORY JSON', async () => {
  const originalFetch = globalThis.fetch
  let capturedWallPostBody: URLSearchParams | null = null
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('articles_publication_index')) {
      return new Response(JSON.stringify([{
        article_slug: 'agrovolokno-pod-klubniku-vesnoy',
        category_slug: 'dacha-i-ogorod',
        title: 'Агроволокно',
        canonical_path: '/dacha-i-ogorod/agrovolokno-pod-klubniku-vesnoy/',
        description: 'test',
        published_at: '2026-06-06T00:00:00.000Z',
        first_seen_at: '2026-06-06T00:00:00.000Z',
      }]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('/images/agrovolokno-pod-klubniku-vesnoy.jpg')) {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } })
    }
    if (url.includes('/wall.post')) {
      capturedWallPostBody = new URLSearchParams(String(init?.body || ''))
      return new Response(JSON.stringify({ response: { post_id: 88 } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: 'publication-row' }), { status: 201, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await processVkAutopost({
      ...baseEnv,
      VK_PHOTO_ACCESS_TOKEN: undefined,
      VK_API_BASE_URL: 'https://api.vk.test/method',
      VK_GROUPS_BY_CATEGORY: '{ this is not valid json }',
    }, new Date('2026-06-06T09:00:00Z'))
    assert.equal(result.ran, true)
    assert.equal(result.posted, true)
    // must fall back to default VK_GROUP_ID = 123456
    assert.equal(capturedWallPostBody?.get('owner_id'), '-123456')
  } finally {
    globalThis.fetch = originalFetch
  }
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

// ── Per-category (multi-group) mode tests ───────────────────────────────────

test('per-category: each category gets its own rate-limit bucket key', async () => {
  const originalFetch = globalThis.fetch
  const bucketsSeen: string[] = []

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/notification_check_rate_limit')) {
      // Capture the bucket sent in the request body
      return new Response(JSON.stringify({ allowed: true, bucket: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('articles_publication_index')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  // Intercept at the supabase RPC level by inspecting URL params
  const originalFetchBuckets = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/notification_check_rate_limit')) {
      // body is JSON with p_bucket
      try {
        const body = JSON.parse(String(init?.body || '{}')) as { p_bucket?: string }
        if (body.p_bucket) bucketsSeen.push(body.p_bucket)
      } catch { /* ignore */ }
      return new Response(JSON.stringify({ allowed: true, bucket: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('articles_publication_index')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await processVkAutopost({
      ...baseEnv,
      VK_GROUPS_BY_CATEGORY: JSON.stringify({
        'dacha-i-ogorod': { groupId: 'G1' },
        'kuhnya': { groupId: 'G2' },
      }),
    }, new Date('2026-06-06T09:00:00Z'))

    // Both categories should have been checked — each produces 2 rate-limit calls (daily + hourly)
    assert.equal(result.categoryResults?.length, 2)
    // Buckets for G1 must differ from buckets for G2
    const g1Buckets = bucketsSeen.filter((b) => b.includes('G1'))
    const g2Buckets = bucketsSeen.filter((b) => b.includes('G2'))
    assert.ok(g1Buckets.length >= 1, 'G1 should have its own rate-limit bucket')
    assert.ok(g2Buckets.length >= 1, 'G2 should have its own rate-limit bucket')
    // Buckets must not overlap
    assert.ok(!g1Buckets.some((b) => b.includes('G2')), 'G1 buckets must not reference G2')
    assert.ok(!g2Buckets.some((b) => b.includes('G1')), 'G2 buckets must not reference G1')
  } finally {
    globalThis.fetch = originalFetchBuckets
    globalThis.fetch = originalFetch
  }
})

test('per-category: if one category is rate-limited, others still proceed', async () => {
  const originalFetch = globalThis.fetch
  const categoriesAttempted: string[] = []

  // G1 is rate-limited (daily), G2 is allowed
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/notification_check_rate_limit')) {
      const body = JSON.parse(String(init?.body || '{}')) as { p_bucket?: string }
      const bucket = body.p_bucket || ''
      const allowed = !bucket.includes('G1') // G1 is blocked, G2 is allowed
      return new Response(JSON.stringify({ allowed, bucket }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('articles_publication_index')) {
      const urlObj = new URL(url)
      const query = urlObj.search
      // Track which category was queried
      if (query.includes('dacha-i-ogorod')) categoriesAttempted.push('dacha-i-ogorod')
      if (query.includes('kuhnya')) categoriesAttempted.push('kuhnya')
      return new Response(JSON.stringify([{
        article_slug: 'agrovolokno-pod-klubniku-vesnoy',
        category_slug: 'dacha-i-ogorod',
        title: 'Test',
        canonical_path: '/dacha-i-ogorod/agrovolokno-pod-klubniku-vesnoy/',
        description: 'test',
        published_at: '2026-06-06T00:00:00.000Z',
        first_seen_at: '2026-06-06T00:00:00.000Z',
      }]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('/wall.post')) {
      return new Response(JSON.stringify({ response: { post_id: 99 } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: 'pub-row' }), { status: 201, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await processVkAutopost({
      ...baseEnv,
      VK_PHOTO_ACCESS_TOKEN: undefined,
      VK_API_BASE_URL: 'https://api.vk.test/method',
      VK_GROUPS_BY_CATEGORY: JSON.stringify({
        'dacha-i-ogorod': { groupId: 'G1' },
        'kuhnya': { groupId: 'G2' },
      }),
    }, new Date('2026-06-06T09:00:00Z'))

    assert.equal(result.categoryResults?.length, 2)
    const g1 = result.categoryResults?.find((r) => r.groupId === 'G1')
    const g2 = result.categoryResults?.find((r) => r.groupId === 'G2')

    // G1 skipped due to rate limit
    assert.equal(g1?.ran, false)
    assert.equal(g1?.skippedReason, 'daily_limit_reached')

    // G2 still ran (rate limit allowed)
    assert.equal(g2?.ran, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('per-category: falls back to single-group when VK_GROUPS_BY_CATEGORY absent', async () => {
  const originalFetch = globalThis.fetch
  let wallPostCalled = false

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('articles_publication_index')) {
      return new Response(JSON.stringify([{
        article_slug: 'agrovolokno-pod-klubniku-vesnoy',
        category_slug: 'dacha-i-ogorod',
        title: 'Test',
        canonical_path: '/dacha-i-ogorod/agrovolokno-pod-klubniku-vesnoy/',
        description: 'test',
        published_at: '2026-06-06T00:00:00.000Z',
        first_seen_at: '2026-06-06T00:00:00.000Z',
      }]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('/wall.post')) {
      wallPostCalled = true
      return new Response(JSON.stringify({ response: { post_id: 77 } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: 'pub-row' }), { status: 201, headers: { 'content-type': 'application/json' } })
  }

  try {
    // No VK_GROUPS_BY_CATEGORY — should use single-group path
    const result = await processVkAutopost({
      ...baseEnv,
      VK_PHOTO_ACCESS_TOKEN: undefined,
      VK_API_BASE_URL: 'https://api.vk.test/method',
    }, new Date('2026-06-06T09:00:00Z'))

    assert.equal(result.ran, true)
    assert.equal(result.posted, true)
    assert.equal(result.providerPostId, '77')
    // No categoryResults in single-group mode
    assert.equal(result.categoryResults, undefined)
    assert.equal(wallPostCalled, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('processVkAutopost resolves a dynamic content_matrix article missing from the static index', async () => {
  // A no-redeploy factory article: present in articles_publication_index +
  // content_matrix, but NOT in the baked vk-publication-index.json. It must
  // still post (resolved from content_matrix), proving the static-index
  // dependency is no longer a hard gate.
  const DYN = 'dinamicheskaya-statya-bez-mdx'
  const originalFetch = globalThis.fetch
  let wallPostCalled = false
  let contentMatrixQueried = false
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('content_matrix')) {
      contentMatrixQueried = true
      return new Response(JSON.stringify([{
        slug: DYN,
        category: 'dacha-i-ogorod',
        title: 'Динамическая статья без MDX',
        description: 'Короткий анонс',
        image_filename: `${DYN}.jpg`,
        published_at: '2026-06-06T00:00:00.000Z',
      }]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('articles_publication_index')) {
      return new Response(JSON.stringify([{
        article_slug: DYN,
        category_slug: 'dacha-i-ogorod',
        title: 'Динамическая статья без MDX',
        canonical_path: `/dacha-i-ogorod/${DYN}/`,
        description: 'Короткий анонс',
        published_at: '2026-06-06T00:00:00.000Z',
        first_seen_at: '2026-06-06T00:00:00.000Z',
      }]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes(`/images/${DYN}.jpg`)) {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } })
    }
    if (url.includes('/wall.post')) {
      wallPostCalled = true
      return new Response(JSON.stringify({ response: { post_id: 4242 } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: 'publication-row' }), { status: 201, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await processVkAutopost({
      ...baseEnv,
      VK_PHOTO_ACCESS_TOKEN: undefined,
      VK_API_BASE_URL: 'https://api.vk.test/method',
    }, new Date('2026-06-06T09:00:00Z'))
    assert.equal(result.ran, true)
    assert.equal(result.posted, true)
    assert.equal(result.articleSlug, DYN)
    assert.equal(result.providerPostId, '4242')
    assert.equal(wallPostCalled, true)
    // Proves resolution came from content_matrix (DB fallback), not the static JSON.
    assert.equal(contentMatrixQueried, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('processVkAutopost surfaces article_lookup_failed (not article_not_found) on content_matrix DB error', async () => {
  // Candidate exists in articles_publication_index but is absent from the static
  // index; the content_matrix lookup then errors. The resolver must NOT mask this
  // as "not found" — autopost should report a diagnosable lookup failure and not
  // attempt to post.
  const DYN = 'dinamicheskaya-statya-db-error'
  const originalFetch = globalThis.fetch
  let wallPostCalled = false
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('content_matrix')) {
      // Simulate a transient Supabase failure during the resolver lookup.
      return new Response('boom', { status: 500, headers: { 'content-type': 'text/plain' } })
    }
    if (url.includes('articles_publication_index')) {
      return new Response(JSON.stringify([{
        article_slug: DYN,
        category_slug: 'dacha-i-ogorod',
        title: 'Статья с ошибкой БД',
        canonical_path: `/dacha-i-ogorod/${DYN}/`,
        description: 'desc',
        published_at: '2026-06-06T00:00:00.000Z',
        first_seen_at: '2026-06-06T00:00:00.000Z',
      }]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('/wall.post')) {
      wallPostCalled = true
      return new Response(JSON.stringify({ response: { post_id: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: 'publication-row' }), { status: 201, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await processVkAutopost({
      ...baseEnv,
      VK_PHOTO_ACCESS_TOKEN: undefined,
      VK_API_BASE_URL: 'https://api.vk.test/method',
    }, new Date('2026-06-06T09:00:00Z'))
    assert.equal(result.ran, true)
    assert.notEqual(result.posted, true)
    assert.equal(result.errorCode, 'article_lookup_failed')
    assert.equal(wallPostCalled, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('per-category: category article filtering by category_slug', async () => {
  const originalFetch = globalThis.fetch
  const queriedUrls: string[] = []

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('articles_publication_index')) {
      queriedUrls.push(url)
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await processVkAutopost({
      ...baseEnv,
      VK_GROUPS_BY_CATEGORY: JSON.stringify({
        'dacha-i-ogorod': { groupId: 'G10' },
        'bezopasnost': { groupId: 'G20' },
      }),
    }, new Date('2026-06-06T09:00:00Z'))

    assert.equal(result.categoryResults?.length, 2)

    // Each query to articles_publication_index must include the category_slug filter
    const dachaQuery = queriedUrls.find((u) => u.includes('dacha-i-ogorod'))
    const bezQuery = queriedUrls.find((u) => u.includes('bezopasnost'))
    assert.ok(dachaQuery, 'should query for dacha-i-ogorod articles')
    assert.ok(bezQuery, 'should query for bezopasnost articles')
    // Must NOT cross-contaminate: dacha query should not mention bezopasnost
    assert.ok(!dachaQuery?.includes('bezopasnost'), 'dacha query must not include bezopasnost filter')
    assert.ok(!bezQuery?.includes('dacha-i-ogorod'), 'bezopasnost query must not include dacha filter')
  } finally {
    globalThis.fetch = originalFetch
  }
})
