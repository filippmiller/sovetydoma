import assert from 'node:assert/strict'
import test from 'node:test'
import { processFbAutopost, fbConfiguredCategories } from './fb-autopost'

test('processFbAutopost skips when supabase not configured', async () => {
  const result = await processFbAutopost({
    PUBLIC_SITE_URL: 'https://1001sovet.ru',
    FB_PAGE_ID: '111222333',
    FB_PAGE_ACCESS_TOKEN: 'test-page-token',
  })
  assert.equal(result.ran, false)
  assert.equal(result.skippedReason, 'supabase_service_role_not_configured')
})

test('processFbAutopost skips when FB not configured', async () => {
  const result = await processFbAutopost({
    PUBLIC_SITE_URL: 'https://1001sovet.ru',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  })
  assert.equal(result.ran, false)
  assert.equal(result.skippedReason, 'fb_not_configured')
})

test('processFbAutopost skips outside Moscow posting hours', async () => {
  const result = await processFbAutopost({
    PUBLIC_SITE_URL: 'https://1001sovet.ru',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    FB_PAGE_ID: '111222333',
    FB_PAGE_ACCESS_TOKEN: 'test-page-token',
  }, new Date('2026-06-06T23:30:00Z')) // 02:30 Moscow
  assert.equal(result.ran, false)
  assert.equal(result.skippedReason, 'outside_posting_hours')
})

test('processFbAutopost posts latest unposted article with photo', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } })
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
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('/photos')) {
      return new Response(JSON.stringify({ id: '9001', post_id: '111222333_444555' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: 'publication-row' }), { status: 201, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await processFbAutopost({
      PUBLIC_SITE_URL: 'https://1001sovet.ru',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      FB_PAGE_ID: '111222333',
      FB_PAGE_ACCESS_TOKEN: 'test-page-token',
      FB_API_BASE_URL: 'https://graph.facebook.test',
    }, new Date('2026-06-06T09:00:00Z')) // 12:00 Moscow
    assert.equal(result.ran, true)
    assert.equal(result.posted, true)
    assert.equal(result.providerPostId, '111222333_444555')
    assert.equal(result.postUrl, 'https://www.facebook.com/111222333_444555')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('processFbAutopost resolves a dynamic content_matrix article missing from the static index', async () => {
  // No-redeploy factory article: in articles_publication_index + content_matrix
  // but not in the baked vk-publication-index.json. Must still post.
  const DYN = 'dinamicheskaya-statya-bez-mdx'
  const originalFetch = globalThis.fetch
  let photoCalled = false
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
    if (url.includes('/photos')) {
      photoCalled = true
      return new Response(JSON.stringify({ id: '9002', post_id: '111222333_999888' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: 'publication-row' }), { status: 201, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await processFbAutopost({
      PUBLIC_SITE_URL: 'https://1001sovet.ru',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      FB_PAGE_ID: '111222333',
      FB_PAGE_ACCESS_TOKEN: 'test-page-token',
      FB_API_BASE_URL: 'https://graph.facebook.test',
    }, new Date('2026-06-06T09:00:00Z'))
    assert.equal(result.ran, true)
    assert.equal(result.posted, true)
    assert.equal(result.articleSlug, DYN)
    assert.equal(result.providerPostId, '111222333_999888')
    assert.equal(photoCalled, true)
    // Proves resolution came from content_matrix (DB fallback), not the static JSON.
    assert.equal(contentMatrixQueried, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('processFbAutopost surfaces article_lookup_failed (not article_not_found) on content_matrix DB error', async () => {
  const DYN = 'dinamicheskaya-statya-db-error'
  const originalFetch = globalThis.fetch
  let photoCalled = false
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/rpc/')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('content_matrix')) {
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
    if (url.includes('/photos')) {
      photoCalled = true
      return new Response(JSON.stringify({ id: '1', post_id: '111222333_1' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: 'publication-row' }), { status: 201, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await processFbAutopost({
      PUBLIC_SITE_URL: 'https://1001sovet.ru',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      FB_PAGE_ID: '111222333',
      FB_PAGE_ACCESS_TOKEN: 'test-page-token',
      FB_API_BASE_URL: 'https://graph.facebook.test',
    }, new Date('2026-06-06T09:00:00Z'))
    assert.equal(result.ran, true)
    assert.notEqual(result.posted, true)
    assert.equal(result.errorCode, 'article_lookup_failed')
    assert.equal(photoCalled, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// ── fbConfiguredCategories (redacted inventory helper) ──────────────────────

test('fbConfiguredCategories returns only slugs of entries that have id AND token', () => {
  const env = { FB_PAGES_BY_CATEGORY: JSON.stringify({
    'dom-i-uborka': { id: '10', token: 't10' },
    avto: { id: '20', token: 't20' },
    rybalka: { id: '30' },        // no token — excluded (mirrors routing)
    ekonomiya: { token: 't40' },  // no id — excluded
  }) }
  const cats = fbConfiguredCategories(env)
  assert.deepEqual([...cats].sort(), ['avto', 'dom-i-uborka'])
})

test('fbConfiguredCategories returns [] when map is absent or malformed', () => {
  assert.deepEqual(fbConfiguredCategories({}), [])
  assert.deepEqual(fbConfiguredCategories({ FB_PAGES_BY_CATEGORY: '' }), [])
  assert.deepEqual(fbConfiguredCategories({ FB_PAGES_BY_CATEGORY: '{ broken' }), [])
})
