import assert from 'node:assert/strict'
import test from 'node:test'
import worker from './index'
import type { Env } from './types'

const baseEnv: Env = {
  ALLOWED_ORIGINS: 'https://1001sovet.ru',
  SUBSCRIPTIONS_API_URL: 'https://api.1001sovet.ru',
  PUBLIC_SITE_URL: 'https://1001sovet.ru',
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://api.1001sovet.ru${path}`, init)
}

test('subscription start rejects origins outside the allowlist', async () => {
  const response = await worker.fetch(request('/subscriptions/start', {
    method: 'POST',
    headers: {
      Origin: 'https://evil.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      categories: ['kulinaria'],
      channels: ['email'],
      contacts: { email: 'reader@example.com' },
      consent: true,
    }),
  }), baseEnv)

  assert.equal(response.status, 403)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
})

test('subscription start fails closed when turnstile is not configured', async () => {
  const response = await worker.fetch(request('/subscriptions/start', {
    method: 'POST',
    headers: {
      Origin: 'https://1001sovet.ru',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      categories: ['kulinaria'],
      channels: ['email'],
      contacts: { email: 'reader@example.com' },
      consent: true,
    }),
  }), baseEnv)

  assert.equal(response.status, 403)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://1001sovet.ru')
  assert.deepEqual(await response.json(), { ok: false, error: 'turnstile_failed' })
})

test('GET confirmation renders a non-mutating confirmation page', async () => {
  const response = await worker.fetch(request('/subscriptions/confirm?token=email_test'), baseEnv)
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.match(html, /method="post"/)
  assert.match(html, /name="token"/)
})

test('admin diagnostics requires configured admin key', async () => {
  const response = await worker.fetch(request('/admin/subscriptions/diagnostics'), baseEnv)

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { ok: false, error: 'admin_api_key_not_configured' })
})

test('telegram webhook requires configured secret', async () => {
  const response = await worker.fetch(request('/webhooks/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { text: '/start telegram_token', chat: { id: 123 } } }),
  }), {
    ...baseEnv,
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  })

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { ok: false, error: 'telegram_webhook_secret_not_configured' })
})

test('social track rejects disallowed origins', async () => {
  const response = await worker.fetch(request('/social/track', {
    method: 'POST',
    headers: {
      Origin: 'https://evil.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ platform: 'vk', action: 'cta_click', sourcePath: '/podpiski/' }),
  }), {
    ...baseEnv,
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  })

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { ok: false, error: 'origin_not_allowed' })
})

test('social targets requires service role configuration', async () => {
  const response = await worker.fetch(request('/social/targets'), baseEnv)
  assert.equal(response.status, 503)
})

test('resend webhook requires svix secret before accepting suppression events', async () => {
  const response = await worker.fetch(request('/webhooks/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'email.bounced', data: { to: 'reader@example.com' } }),
  }), {
    ...baseEnv,
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  })

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { ok: false, error: 'resend_webhook_secret_not_configured' })
})

test('vk dry-run requires admin key', async () => {
  const response = await worker.fetch(request('/admin/social/vk/dry-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleSlug: 'agrovolokno-pod-klubniku-vesnoy' }),
  }), baseEnv)

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { ok: false, error: 'admin_api_key_not_configured' })
})

test('vk dry-run returns provider_unconfigured when VK env missing', async () => {
  const response = await worker.fetch(request('/admin/social/vk/dry-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': 'admin-secret' },
    body: JSON.stringify({ articleSlug: 'agrovolokno-pod-klubniku-vesnoy' }),
  }), {
    ...baseEnv,
    ADMIN_API_KEY: 'admin-secret',
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  })

  assert.equal(response.status, 503)
  const body = await response.json()
  assert.equal(body.error, 'provider_unconfigured')
  assert.ok(Array.isArray(body.missing))
})

test('vk dry-run returns article_not_found for unknown slug', async () => {
  const response = await worker.fetch(request('/admin/social/vk/dry-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': 'admin-secret' },
    body: JSON.stringify({ articleSlug: 'nonexistent-article-12345' }),
  }), {
    ...baseEnv,
    ADMIN_API_KEY: 'admin-secret',
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    VK_ACCESS_TOKEN: 'vk-token',
    VK_GROUP_ID: '123456',
  })

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { ok: false, error: 'article_not_found' })
})

test('vk dry-run returns build info for known article', async () => {
  const response = await worker.fetch(request('/admin/social/vk/dry-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': 'admin-secret' },
    body: JSON.stringify({ articleSlug: 'agrovolokno-pod-klubniku-vesnoy' }),
  }), {
    ...baseEnv,
    ADMIN_API_KEY: 'admin-secret',
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    VK_ACCESS_TOKEN: 'vk-token',
    VK_GROUP_ID: '123456',
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.equal(body.dryRun, true)
  assert.equal(body.articleSlug, 'agrovolokno-pod-klubniku-vesnoy')
  assert.ok(body.title)
  assert.ok(body.canonicalUrl)
  assert.ok(body.imageUrl)
  assert.ok(body.messageLength > 0)
  assert.ok(body.bodyHash)
  assert.ok(body.wouldPost)
})

test('vk post requires admin key', async () => {
  const response = await worker.fetch(request('/admin/social/vk/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleSlug: 'agrovolokno-pod-klubniku-vesnoy' }),
  }), baseEnv)

  assert.equal(response.status, 503)
})
