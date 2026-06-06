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

test('vk id exchange rejects disallowed origins', async () => {
  const response = await worker.fetch(request('/auth/vk/exchange', {
    method: 'POST',
    headers: {
      Origin: 'https://evil.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code: 'code', device_id: 'device', code_verifier: 'verifier' }),
  }), baseEnv)

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { ok: false, error: 'origin_not_allowed' })
})

test('vk id exchange requires code device id and verifier', async () => {
  const response = await worker.fetch(request('/auth/vk/exchange', {
    method: 'POST',
    headers: {
      Origin: 'https://1001sovet.ru',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code: 'code' }),
  }), baseEnv)

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { ok: false, error: 'vk_code_device_id_and_verifier_required' })
})

test('vk id exchange requires Supabase service role configuration', async () => {
  const response = await worker.fetch(request('/auth/vk/exchange', {
    method: 'POST',
    headers: {
      Origin: 'https://1001sovet.ru',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code: 'code', device_id: 'device', code_verifier: 'verifier' }),
  }), baseEnv)

  assert.equal(response.status, 503)
  const body = await response.json()
  assert.equal(body.error, 'provider_unconfigured')
  assert.deepEqual(body.missing, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
})

test('vk id exchange returns Supabase action link after VK verification', async () => {
  const originalFetch = globalThis.fetch
  const calls: string[] = []
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    calls.push(url)

    if (url.includes('/rest/v1/rpc/notification_check_rate_limit')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url === 'https://id.vk.com/oauth2/auth') {
      const body = new URLSearchParams(String(init?.body || ''))
      assert.equal(body.get('code'), 'vk-code')
      assert.equal(body.get('device_id'), 'vk-device')
      assert.equal(body.get('code_verifier'), 'vk-verifier')
      assert.equal(body.get('client_id'), '54625895')
      return new Response(JSON.stringify({ access_token: 'vk-access-token', user_id: '123' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url === 'https://id.vk.com/oauth2/user_info') {
      const body = new URLSearchParams(String(init?.body || ''))
      assert.equal(body.get('access_token'), 'vk-access-token')
      assert.equal(body.get('client_id'), '54625895')
      return new Response(JSON.stringify({
        user: { user_id: '123', first_name: 'Ivan', last_name: 'Petrov', avatar: 'https://vk.example/avatar.jpg', email: 'ivan@example.com' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url === 'https://supabase.example/auth/v1/admin/generate_link') {
      const body = JSON.parse(String(init?.body || '{}'))
      assert.equal(body.type, 'magiclink')
      assert.equal(body.email, 'ivan@example.com')
      assert.equal(body.redirect_to, 'https://1001sovet.ru/moy-kabinet/')
      assert.equal(body.data.provider, 'vk_id')
      assert.equal(body.data.vk_id, '123')
      return new Response(JSON.stringify({ action_link: 'https://supabase.example/auth/v1/verify?token=generated' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: 'unexpected_fetch', url }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const response = await worker.fetch(request('/auth/vk/exchange', {
      method: 'POST',
      headers: {
        Origin: 'https://1001sovet.ru',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: 'vk-code', device_id: 'vk-device', code_verifier: 'vk-verifier' }),
    }), {
      ...baseEnv,
      SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      VK_ID_APP_ID: '54625895',
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.ok, true)
    assert.equal(body.actionLink, 'https://supabase.example/auth/v1/verify?token=generated')
    assert.equal(body.emailHint, 'iv***@example.com')
    assert.ok(calls.includes('https://id.vk.com/oauth2/auth'))
    assert.ok(calls.includes('https://id.vk.com/oauth2/user_info'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
