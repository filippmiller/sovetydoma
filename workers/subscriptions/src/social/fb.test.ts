import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFbArticlePost, publishArticleToFacebook, validateFbConfig, MAX_FB_MESSAGE_CHARS } from './fb'
import { findArticleRecord } from './vk'
import type { Env } from '../types'

const baseEnv: Env = {
  PUBLIC_SITE_URL: 'https://1001sovet.ru',
  FB_PAGE_ID: '111222333',
  FB_PAGE_ACCESS_TOKEN: 'test-page-token',
  FB_API_BASE_URL: 'https://graph.facebook.test',
}

const sampleRecord = findArticleRecord('agrovolokno-pod-klubniku-vesnoy')

test('validateFbConfig throws without page id', () => {
  assert.throws(() => validateFbConfig({ FB_PAGE_ACCESS_TOKEN: 'x' }), /fb_page_id_not_configured/)
})

test('validateFbConfig throws without page token', () => {
  assert.throws(() => validateFbConfig({ FB_PAGE_ID: '1' }), /fb_page_access_token_not_configured/)
})

test('validateFbConfig applies defaults', () => {
  const config = validateFbConfig({ FB_PAGE_ID: '1', FB_PAGE_ACCESS_TOKEN: 'x' })
  assert.equal(config.apiBaseUrl, 'https://graph.facebook.com')
  assert.match(config.apiVersion, /^v\d+\.\d+$/)
})

test('buildFbArticlePost composes message with source link', () => {
  assert.ok(sampleRecord, 'sample article must exist in publication index')
  const post = buildFbArticlePost(sampleRecord!, 'https://1001sovet.ru')
  assert.ok(post.message.includes(sampleRecord!.title))
  assert.ok(post.message.includes(`Источник: https://1001sovet.ru${sampleRecord!.canonical_path}`))
  assert.equal(post.imageUrl, `https://1001sovet.ru${sampleRecord!.image_path}`)
  assert.ok(post.messageLength <= MAX_FB_MESSAGE_CHARS)
})

test('publishArticleToFacebook returns provider_unconfigured without config', async () => {
  const result = await publishArticleToFacebook({}, 'agrovolokno-pod-klubniku-vesnoy')
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'provider_unconfigured')
})

test('publishArticleToFacebook returns article_not_found for unknown slug', async () => {
  const result = await publishArticleToFacebook(baseEnv, 'no-such-article')
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'article_not_found')
})

test('publishArticleToFacebook dry run returns hash and length', async () => {
  const result = await publishArticleToFacebook(baseEnv, 'agrovolokno-pod-klubniku-vesnoy', { dryRun: true })
  assert.equal(result.ok, true)
  assert.equal(result.dryRun, true)
  assert.ok(result.bodyHash.length === 64)
  assert.ok(result.messageLength > 0)
})

test('publishArticleToFacebook posts photo by url', async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ url: string; body: string }> = []
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push({ url, body: String(init?.body || '') })
    if (url.includes('/photos')) {
      return new Response(JSON.stringify({ id: '9001', post_id: '111222333_444555' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: { message: 'unexpected', code: 1 } }), { status: 400, headers: { 'content-type': 'application/json' } })
  }

  try {
    const result = await publishArticleToFacebook(baseEnv, 'agrovolokno-pod-klubniku-vesnoy')
    assert.equal(result.ok, true)
    assert.equal(result.publishMode, 'photo_url')
    assert.equal(result.providerPostId, '111222333_444555')
    assert.equal(result.postUrl, 'https://www.facebook.com/111222333_444555')
    const photoCall = calls.find((c) => c.url.includes('/photos'))
    assert.ok(photoCall)
    const params = new URLSearchParams(photoCall!.body)
    assert.ok(params.get('url')?.includes('/images/'))
    assert.ok(params.get('caption')?.includes('Источник:'))
    assert.equal(params.get('access_token'), 'test-page-token')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('publishArticleToFacebook falls back to link post when photo fails and fallback allowed', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/photos')) {
      return new Response(JSON.stringify({ error: { message: 'photo rejected', code: 100 } }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    if (url.includes('/feed')) {
      return new Response(JSON.stringify({ id: '111222333_777888' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response('{}', { status: 404 })
  }

  try {
    const result = await publishArticleToFacebook(baseEnv, 'agrovolokno-pod-klubniku-vesnoy', { requirePhoto: true, allowLinkFallback: true })
    assert.equal(result.ok, true)
    assert.equal(result.publishMode, 'link_post')
    assert.equal(result.providerPostId, '111222333_777888')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('publishArticleToFacebook fails hard when photo fails and fallback not allowed', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/photos')) {
      return new Response(JSON.stringify({ error: { message: 'photo rejected', code: 100 } }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    return new Response('{}', { status: 404 })
  }

  try {
    const result = await publishArticleToFacebook(baseEnv, 'agrovolokno-pod-klubniku-vesnoy', { requirePhoto: true, allowLinkFallback: false })
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'photo_post_failed')
    assert.match(result.error || '', /fb_100/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
