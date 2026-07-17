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
  // Not in the static index AND content_matrix returns no row → genuine not-found.
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
  try {
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
  } finally {
    globalThis.fetch = originalFetch
  }
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

test('vk id exchange fails closed when VK_ID_APP_ID is not configured', async () => {
  // No hardcoded fallback app id (the stale 54625895 fallback previously pointed
  // the flow at the wrong VK app). Missing env => provider_unconfigured, never
  // a silent default.
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.includes('/rest/v1/rpc/notification_check_rate_limit')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
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
      body: JSON.stringify({ code: 'code', device_id: 'device', code_verifier: 'verifier' }),
    }), {
      ...baseEnv,
      SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      // VK_ID_APP_ID intentionally omitted
    })

    assert.equal(response.status, 503)
    const body = await response.json()
    assert.equal(body.error, 'provider_unconfigured')
    assert.deepEqual(body.missing, ['VK_ID_APP_ID'])
  } finally {
    globalThis.fetch = originalFetch
  }
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
      assert.equal(body.get('client_id'), '54626241')
      return new Response(JSON.stringify({ access_token: 'vk-access-token', user_id: '123' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url === 'https://id.vk.com/oauth2/user_info') {
      const body = new URLSearchParams(String(init?.body || ''))
      assert.equal(body.get('access_token'), 'vk-access-token')
      assert.equal(body.get('client_id'), '54626241')
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
      VK_ID_APP_ID: '54626241',
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

// L3: OPTIONS preflight must return CORS headers (not a bare 204)
test('OPTIONS preflight returns CORS headers and 204', async () => {
  const response = await worker.fetch(request('/subscriptions/start', {
    method: 'OPTIONS',
    headers: { Origin: 'https://1001sovet.ru' },
  }), baseEnv)

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://1001sovet.ru')
  assert.ok(response.headers.get('Access-Control-Allow-Methods'))
  assert.ok(response.headers.get('Access-Control-Allow-Headers'))
  assert.equal(response.headers.get('Vary'), 'Origin')
})

test('OPTIONS preflight does not set ACAO for disallowed origins', async () => {
  const response = await worker.fetch(request('/subscriptions/start', {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example' },
  }), baseEnv)

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
})

// M2: Yandex exchange must ignore client-supplied redirect_uri
test('yandex exchange ignores client redirect_uri and uses server-derived one', async () => {
  const originalFetch = globalThis.fetch
  const capturedRedirectUri: string[] = []
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (url.includes('/rest/v1/rpc/notification_check_rate_limit')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url === 'https://oauth.yandex.ru/token') {
      const body = new URLSearchParams(String(init?.body || ''))
      capturedRedirectUri.push(body.get('redirect_uri') || '')
      return new Response(JSON.stringify({ access_token: 'ya-access-token' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url === 'https://login.yandex.ru/info?format=json') {
      return new Response(JSON.stringify({ id: 'ya123', default_email: 'user@yandex.ru' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url === 'https://supabase.example/auth/v1/admin/generate_link') {
      return new Response(JSON.stringify({ action_link: 'https://supabase.example/auth/v1/verify?token=ya' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: 'unexpected_fetch', url }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const response = await worker.fetch(request('/auth/yandex/exchange', {
      method: 'POST',
      headers: { Origin: 'https://1001sovet.ru', 'Content-Type': 'application/json' },
      // Client sends a malicious redirect_uri — must be ignored
      body: JSON.stringify({ code: 'ya-code', redirect_uri: 'https://evil.example/steal', redirectUri: 'https://evil.example/steal' }),
    }), {
      ...baseEnv,
      SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      YANDEX_OAUTH_CLIENT_ID: 'ya-client-id',
      YANDEX_OAUTH_CLIENT_SECRET: 'ya-secret',
      YANDEX_OAUTH_REDIRECT_URI: 'https://1001sovet.ru/auth/callback/',
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.ok, true)
    // Verify the redirect_uri sent to Yandex was the server value, not the client one
    assert.equal(capturedRedirectUri[0], 'https://1001sovet.ru/auth/callback/')
    assert.notEqual(capturedRedirectUri[0], 'https://evil.example/steal')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('yandex exchange falls back to PUBLIC_SITE_URL when YANDEX_OAUTH_REDIRECT_URI is unset', async () => {
  const originalFetch = globalThis.fetch
  const capturedRedirectUri: string[] = []
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (url.includes('/rest/v1/rpc/notification_check_rate_limit')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url === 'https://oauth.yandex.ru/token') {
      const body = new URLSearchParams(String(init?.body || ''))
      capturedRedirectUri.push(body.get('redirect_uri') || '')
      return new Response(JSON.stringify({ access_token: 'ya-access-token' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url === 'https://login.yandex.ru/info?format=json') {
      return new Response(JSON.stringify({ id: 'ya456', default_email: 'user2@yandex.ru' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url === 'https://supabase.example/auth/v1/admin/generate_link') {
      return new Response(JSON.stringify({ action_link: 'https://supabase.example/auth/v1/verify?token=ya2' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: 'unexpected_fetch', url }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const response = await worker.fetch(request('/auth/yandex/exchange', {
      method: 'POST',
      headers: { Origin: 'https://1001sovet.ru', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'ya-code2' }),
    }), {
      ...baseEnv,
      SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      YANDEX_OAUTH_CLIENT_ID: 'ya-client-id',
      YANDEX_OAUTH_CLIENT_SECRET: 'ya-secret',
      // YANDEX_OAUTH_REDIRECT_URI intentionally omitted — should fall back
    })

    assert.equal(response.status, 200)
    // redirect_uri should be derived from PUBLIC_SITE_URL
    assert.equal(capturedRedirectUri[0], 'https://1001sovet.ru/auth/callback/')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('vk id exchange falls back to a private email when VK omits email', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (url.includes('/rest/v1/rpc/notification_check_rate_limit')) {
      return new Response(JSON.stringify({ allowed: true, bucket: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url === 'https://id.vk.com/oauth2/auth') {
      return new Response(JSON.stringify({ access_token: 'vk-access-token', user_id: '123' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url === 'https://id.vk.com/oauth2/user_info') {
      return new Response(JSON.stringify({
        user: { user_id: '123', first_name: 'Ivan', last_name: 'Petrov' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url === 'https://supabase.example/auth/v1/admin/generate_link') {
      const body = JSON.parse(String(init?.body || '{}'))
      assert.equal(body.email, 'vk-123@users.1001sovet.ru')
      assert.equal(body.data.vk_id, '123')
      assert.equal(body.data.vk_email_missing, true)
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
      VK_ID_APP_ID: '54626241',
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.ok, true)
    assert.equal(body.actionLink, 'https://supabase.example/auth/v1/verify?token=generated')
    assert.equal(body.emailHint, 'vk***@users.1001sovet.ru')
  } finally {
    globalThis.fetch = originalFetch
  }
})

// ── GET /admin/social/autopost-inventory (redacted coverage) ────────────────

test('autopost-inventory returns 503 when ADMIN_API_KEY is not configured', async () => {
  const response = await worker.fetch(request('/admin/social/autopost-inventory'), baseEnv)
  assert.equal(response.status, 503)
})

test('autopost-inventory returns 401 without a valid admin key', async () => {
  const response = await worker.fetch(request('/admin/social/autopost-inventory'), { ...baseEnv, ADMIN_API_KEY: 'topsecret' })
  assert.equal(response.status, 401)
})

test('autopost-inventory returns redacted coverage (slugs only, no IDs/tokens)', async () => {
  const env: Env = {
    ...baseEnv,
    ADMIN_API_KEY: 'topsecret',
    VK_GROUPS_BY_CATEGORY: JSON.stringify({
      'dacha-i-ogorod': { groupId: 'SECRET_GID_111' },
      avto: { groupId: 'SECRET_GID_222' },
    }),
    FB_PAGES_BY_CATEGORY: JSON.stringify({
      'dom-i-uborka': { id: 'SECRET_PID_333', token: 'EAA_SECRET_TOKEN' },
    }),
  }
  const response = await worker.fetch(request('/admin/social/autopost-inventory', {
    headers: { 'x-admin-key': 'topsecret' },
  }), env)
  assert.equal(response.status, 200)

  const raw = await response.text()
  // Redaction: no group IDs / page IDs / tokens may appear in the response.
  assert.ok(!raw.includes('SECRET_GID_111'), 'must not leak VK groupId')
  assert.ok(!raw.includes('SECRET_GID_222'), 'must not leak VK groupId')
  assert.ok(!raw.includes('SECRET_PID_333'), 'must not leak FB page id')
  assert.ok(!raw.includes('EAA_SECRET_TOKEN'), 'must not leak FB token')

  const body = JSON.parse(raw)
  assert.equal(body.ok, true)
  assert.equal(body.total, 12)
  assert.deepEqual([...body.vk.present].sort(), ['avto', 'dacha-i-ogorod'])
  assert.equal(body.vk.count, 2)
  assert.equal(body.vk.missing.length, 10)
  assert.deepEqual(body.fb.present, ['dom-i-uborka'])
  assert.equal(body.fb.count, 1)
  assert.equal(body.fb.missing.length, 11)
  assert.ok(!body.vk.missing.includes('avto'))
  assert.ok(!body.fb.missing.includes('dom-i-uborka'))
})

// ── admin VK/FB dry-run resolves dynamic (content_matrix) articles (da3) ─────

const DRY_SLUG = 'dinamicheskaya-dry-run-statya'

// Mock fetch that drives resolveArticleRecord's content_matrix lookup. The slug
// is absent from the static vk-publication-index.json, so the resolver falls
// back to content_matrix (this mock).
function contentMatrixMock(mode: 'found' | 'empty' | 'error') {
  return async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('content_matrix')) {
      if (mode === 'error') return new Response('boom', { status: 500, headers: { 'content-type': 'text/plain' } })
      const rows = mode === 'found' ? [{
        slug: DRY_SLUG,
        category: 'dacha-i-ogorod',
        title: 'Динамическая статья',
        description: 'Анонс',
        image_filename: `${DRY_SLUG}.jpg`,
        published_at: '2026-06-06T00:00:00.000Z',
      }] : []
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
  }
}

const supaCreds = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role' }
const vkDryEnv: Env = { ...baseEnv, ADMIN_API_KEY: 'topsecret', VK_ACCESS_TOKEN: 'vk-token', VK_GROUP_ID: '123456', ...supaCreds }
const fbDryEnv: Env = { ...baseEnv, ADMIN_API_KEY: 'topsecret', FB_PAGE_ID: '111222333', FB_PAGE_ACCESS_TOKEN: 'fb-token', ...supaCreds }

function dryRun(path: string, env: Env) {
  return worker.fetch(request(path, {
    method: 'POST',
    headers: { 'x-admin-key': 'topsecret', 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleSlug: DRY_SLUG }),
  }), env)
}

test('vk dry-run resolves a dynamic content_matrix article (200)', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = contentMatrixMock('found')
  try {
    const res = await dryRun('/admin/social/vk/dry-run', vkDryEnv)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.ok, true)
    assert.equal(body.dryRun, true)
    assert.equal(body.articleSlug, DRY_SLUG)
    assert.equal(body.title, 'Динамическая статья')
    assert.equal(body.canonicalUrl, `https://1001sovet.ru/dacha-i-ogorod/${DRY_SLUG}/`)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('vk dry-run returns 404 article_not_found for an unknown slug', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = contentMatrixMock('empty')
  try {
    const res = await dryRun('/admin/social/vk/dry-run', vkDryEnv)
    assert.equal(res.status, 404)
    assert.equal((await res.json()).error, 'article_not_found')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('vk dry-run returns 502 article_lookup_failed on content_matrix error', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = contentMatrixMock('error')
  try {
    const res = await dryRun('/admin/social/vk/dry-run', vkDryEnv)
    assert.equal(res.status, 502)
    assert.equal((await res.json()).errorCode, 'article_lookup_failed')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fb dry-run resolves a dynamic content_matrix article (200)', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = contentMatrixMock('found')
  try {
    const res = await dryRun('/admin/social/fb/dry-run', fbDryEnv)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.ok, true)
    assert.equal(body.dryRun, true)
    assert.equal(body.articleSlug, DRY_SLUG)
    assert.equal(body.title, 'Динамическая статья')
    assert.equal(body.canonicalUrl, `https://1001sovet.ru/dacha-i-ogorod/${DRY_SLUG}/`)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fb dry-run returns 404 article_not_found for an unknown slug', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = contentMatrixMock('empty')
  try {
    const res = await dryRun('/admin/social/fb/dry-run', fbDryEnv)
    assert.equal(res.status, 404)
    assert.equal((await res.json()).error, 'article_not_found')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fb dry-run returns 502 article_lookup_failed on content_matrix error', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = contentMatrixMock('error')
  try {
    const res = await dryRun('/admin/social/fb/dry-run', fbDryEnv)
    assert.equal(res.status, 502)
    assert.equal((await res.json()).errorCode, 'article_lookup_failed')
  } finally {
    globalThis.fetch = originalFetch
  }
})
