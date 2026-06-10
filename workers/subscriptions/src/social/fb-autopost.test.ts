import assert from 'node:assert/strict'
import test from 'node:test'
import { processFbAutopost } from './fb-autopost'

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
