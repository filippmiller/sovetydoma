import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildVkArticlePost,
  findArticleRecord,
  isSameOrigin,
  MAX_VK_MESSAGE_CHARS,
  publishArticleToVk,
  resolveVkGroupForCategory,
  validateVkConfig,
} from './vk'
import type { Env } from '../types'

// ── resolveVkGroupForCategory ─────────────────────────────────────────────────

test('resolveVkGroupForCategory maps category to its group', () => {
  const env = { VK_GROUPS_BY_CATEGORY: JSON.stringify({ 'dacha-i-ogorod': { groupId: '111' }, rybalka: { groupId: '222' } }) }
  assert.deepEqual(resolveVkGroupForCategory(env, 'dacha-i-ogorod'), { groupId: '111' })
  assert.deepEqual(resolveVkGroupForCategory(env, 'rybalka'), { groupId: '222' })
})

test('resolveVkGroupForCategory returns undefined for unmapped category', () => {
  const env = { VK_GROUPS_BY_CATEGORY: JSON.stringify({ 'dacha-i-ogorod': { groupId: '111' } }) }
  assert.equal(resolveVkGroupForCategory(env, 'kulinaria'), undefined)
})

test('resolveVkGroupForCategory returns undefined when env is empty', () => {
  assert.equal(resolveVkGroupForCategory({}, 'dacha-i-ogorod'), undefined)
})

test('resolveVkGroupForCategory returns undefined on malformed JSON (graceful fallback)', () => {
  assert.equal(resolveVkGroupForCategory({ VK_GROUPS_BY_CATEGORY: 'not valid json' }, 'dacha-i-ogorod'), undefined)
})

test('resolveVkGroupForCategory returns undefined when groupId is absent in entry', () => {
  const env = { VK_GROUPS_BY_CATEGORY: JSON.stringify({ 'dacha-i-ogorod': {} }) }
  assert.equal(resolveVkGroupForCategory(env, 'dacha-i-ogorod'), undefined)
})

// ── isSameOrigin ──────────────────────────────────────────────────────────────

test('isSameOrigin allows same origin, rejects others', () => {
  assert.equal(isSameOrigin('https://1001sovet.ru/images/x.jpg', 'https://1001sovet.ru'), true)
  assert.equal(isSameOrigin('https://evil.com/x.jpg', 'https://1001sovet.ru'), false)
  assert.equal(isSameOrigin('http://1001sovet.ru/x.jpg', 'https://1001sovet.ru'), false)
  assert.equal(isSameOrigin('not a url', 'https://1001sovet.ru'), false)
})

const baseEnv: Env = {
  PUBLIC_SITE_URL: 'https://1001sovet.ru',
  VK_ACCESS_TOKEN: 'test-token',
  VK_PHOTO_ACCESS_TOKEN: 'test-photo-token',
  VK_GROUP_ID: '123456',
  VK_API_VERSION: '5.199',
}

test('validateVkConfig throws when token missing', () => {
  assert.throws(() => validateVkConfig({ ...baseEnv, VK_ACCESS_TOKEN: undefined }), /vk_access_token_not_configured/)
})

test('validateVkConfig throws when group id missing', () => {
  assert.throws(() => validateVkConfig({ ...baseEnv, VK_GROUP_ID: undefined }), /vk_group_id_not_configured/)
})

test('validateVkConfig returns config', () => {
  const config = validateVkConfig(baseEnv)
  assert.equal(config.accessToken, 'test-token')
  assert.equal(config.photoAccessToken, 'test-photo-token')
  assert.equal(config.groupId, '123456')
  assert.equal(config.apiVersion, '5.199')
})

test('findArticleRecord returns existing article', () => {
  const record = findArticleRecord('agrovolokno-pod-klubniku-vesnoy')
  assert.ok(record)
  assert.equal(record?.article_slug, 'agrovolokno-pod-klubniku-vesnoy')
  assert.ok(record?.plain_text.length > 0)
})

test('findArticleRecord returns undefined for unknown slug', () => {
  const record = findArticleRecord('nonexistent-article-12345')
  assert.equal(record, undefined)
})

test('buildVkArticlePost includes title, text, source url and category', () => {
  const record = findArticleRecord('agrovolokno-pod-klubniku-vesnoy')!
  const result = buildVkArticlePost({ record, siteUrl: 'https://1001sovet.ru' })
  assert.ok(result.message.includes(record.title))
  assert.ok(result.message.includes(record.plain_text.slice(0, 100)))
  assert.ok(result.message.includes('Источник:'))
  assert.ok(result.message.includes('https://1001sovet.ru/dacha-i-ogorod/agrovolokno-pod-klubniku-vesnoy/'))
  assert.ok(result.message.includes('СоветыДома'))
  assert.ok(result.message.includes('dacha-i-ogorod'))
  assert.ok(result.imageUrl.includes('.jpg'))
  assert.equal(result.messageLength, [...result.message].length)
})

test('buildVkArticlePost throws message_too_long when exceeding limit', () => {
  const record = findArticleRecord('agrovolokno-pod-klubniku-vesnoy')!
  const longText = 'x'.repeat(MAX_VK_MESSAGE_CHARS + 100)
  assert.throws(() => {
    buildVkArticlePost({ record: { ...record, title: longText, plain_text: '' }, siteUrl: 'https://1001sovet.ru' })
  }, (err: unknown) => {
    return (err as Error & { code?: string }).code === 'message_too_long'
  })
})

test('publishArticleToVk returns article_not_found for unknown slug (DB reachable, empty)', async () => {
  // Not in the static index AND content_matrix returns no row → genuine not-found.
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
  try {
    const result = await publishArticleToVk(
      { ...baseEnv, SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key' },
      'nonexistent-article-12345',
      { dryRun: true },
    )
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'article_not_found')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('publishArticleToVk returns article_lookup_failed when content_matrix lookup errors', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('boom', { status: 500, headers: { 'content-type': 'text/plain' } })
  try {
    const result = await publishArticleToVk(
      { ...baseEnv, SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key' },
      'nonexistent-article-12345',
      { dryRun: true },
    )
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'article_lookup_failed')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('publishArticleToVk dry-run succeeds for known article', async () => {
  const result = await publishArticleToVk(baseEnv, 'agrovolokno-pod-klubniku-vesnoy', { dryRun: true })
  assert.equal(result.ok, true)
  assert.equal(result.dryRun, true)
  assert.ok(result.bodyHash)
  assert.ok(result.messageLength > 0)
})

test('publishArticleToVk returns provider_unconfigured when env missing', async () => {
  const result = await publishArticleToVk({ PUBLIC_SITE_URL: 'https://1001sovet.ru' }, 'agrovolokno-pod-klubniku-vesnoy', { dryRun: true })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'provider_unconfigured')
  assert.ok(result.error?.includes('vk_access_token_not_configured') || result.error?.includes('vk_group_id_not_configured'))
})

test('publishArticleToVk uses link preview when photo token is missing', async () => {
  const originalFetch = globalThis.fetch
  let wallPostBody: URLSearchParams | null = null
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.includes('/images/agrovolokno-pod-klubniku-vesnoy.jpg')) {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/jpeg' } })
    }
    if (url.includes('/wall.post')) {
      wallPostBody = new URLSearchParams(String(init?.body || new URL(url).searchParams))
      return new Response(JSON.stringify({ response: { post_id: 42 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: { error_code: 1, error_msg: 'unexpected' } }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const result = await publishArticleToVk({
      ...baseEnv,
      VK_PHOTO_ACCESS_TOKEN: undefined,
      VK_API_BASE_URL: 'https://api.vk.test/method',
    }, 'agrovolokno-pod-klubniku-vesnoy', { requirePhoto: true, allowLinkFallback: true })

    assert.equal(result.ok, true)
    assert.equal(result.publishMode, 'link_preview')
    assert.equal(result.providerPostId, '42')
    assert.equal(wallPostBody?.get('attachments'), 'link=https://1001sovet.ru/dacha-i-ogorod/agrovolokno-pod-klubniku-vesnoy/')
    assert.ok(wallPostBody?.get('message')?.includes('https://1001sovet.ru/dacha-i-ogorod/agrovolokno-pod-klubniku-vesnoy/'))
    assert.equal(wallPostBody?.get('message')?.includes('https://1001sovet.ru/images/agrovolokno-pod-klubniku-vesnoy.jpg'), false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('publishArticleToVk uses groupOverride groupId in wall.post owner_id and postUrl', async () => {
  const originalFetch = globalThis.fetch
  let capturedBody: URLSearchParams | null = null
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.includes('/images/agrovolokno-pod-klubniku-vesnoy.jpg')) {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/jpeg' } })
    }
    if (url.includes('/wall.post')) {
      capturedBody = new URLSearchParams(String(init?.body || ''))
      return new Response(JSON.stringify({ response: { post_id: 77 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: { error_code: 1, error_msg: 'unexpected' } }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const result = await publishArticleToVk({
      ...baseEnv,
      VK_PHOTO_ACCESS_TOKEN: undefined,
      VK_API_BASE_URL: 'https://api.vk.test/method',
    }, 'agrovolokno-pod-klubniku-vesnoy', {
      requirePhoto: true,
      allowLinkFallback: true,
      groupOverride: { groupId: '999888' },
    })

    assert.equal(result.ok, true)
    assert.equal(result.providerPostId, '77')
    // owner_id must use the override group id
    assert.equal(capturedBody?.get('owner_id'), '-999888')
    // postUrl must reflect override group id
    assert.equal(result.postUrl, 'https://vk.com/wall-999888_77')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('publishArticleToVk retries text-only when link preview is rejected', async () => {
  const originalFetch = globalThis.fetch
  const wallPostBodies: URLSearchParams[] = []
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.includes('/images/agrovolokno-pod-klubniku-vesnoy.jpg')) {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/jpeg' } })
    }
    if (url.includes('/wall.post')) {
      const body = new URLSearchParams(String(init?.body || new URL(url).searchParams))
      wallPostBodies.push(body)
      if (body.get('attachments')) {
        return new Response(JSON.stringify({ error: { error_code: 100, error_msg: 'Violated: link_photo_sizing_rule. No photo given' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ response: { post_id: 43 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: { error_code: 1, error_msg: 'unexpected' } }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const result = await publishArticleToVk({
      ...baseEnv,
      VK_PHOTO_ACCESS_TOKEN: undefined,
      VK_API_BASE_URL: 'https://api.vk.test/method',
    }, 'agrovolokno-pod-klubniku-vesnoy', { requirePhoto: true, allowLinkFallback: true })

    assert.equal(result.ok, true)
    assert.equal(result.publishMode, 'text_with_links')
    assert.equal(result.providerPostId, '43')
    assert.equal(wallPostBodies.length, 2)
    assert.ok(wallPostBodies[0].get('attachments')?.startsWith('link='))
    assert.equal(wallPostBodies[1].get('attachments'), null)
  } finally {
    globalThis.fetch = originalFetch
  }
})
