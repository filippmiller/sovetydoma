import assert from 'node:assert/strict'
import test from 'node:test'
import { AdminApiError, createAdminApiClient } from './admin-api'

// Unit tests for the sovetydoma-admin-api client. fetch is mocked; no network.

interface CapturedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
}

function mockFetch(handler: (req: CapturedRequest) => { status: number; body?: unknown }) {
  const calls: CapturedRequest[] = []
  const fetchImpl: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) {
      headers[k.toLowerCase()] = v
    }
    const req: CapturedRequest = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? init.body : null,
    }
    calls.push(req)
    const { status, body } = handler(req)
    return new Response(body === undefined ? '' : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
  return { calls, fetchImpl }
}

function makeClient(fetchImpl: typeof fetch) {
  return createAdminApiClient({
    baseUrl: 'https://admin-api.test',
    getToken: async () => 'test-token-123',
    fetchImpl,
  })
}

test('attaches Authorization Bearer token from the session to every request', async () => {
  const { calls, fetchImpl } = mockFetch(() => ({ status: 200, body: { item: { id: 'a1' } } }))
  const client = makeClient(fetchImpl)
  await client.getArticle('a1')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].headers['authorization'], 'Bearer test-token-123')
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].url, 'https://admin-api.test/admin/articles/a1')
})

test('listArticles serializes page/per_page/status/category/q/sort query params', async () => {
  const { calls, fetchImpl } = mockFetch(() => ({ status: 200, body: { items: [], page: 2, per_page: 25, total: 0 } }))
  const client = makeClient(fetchImpl)
  await client.listArticles({ page: 2, per_page: 25, status: 'draft', category: 'avto', q: 'масло' })
  const url = new URL(calls[0].url)
  assert.equal(url.pathname, '/admin/articles')
  assert.equal(url.searchParams.get('page'), '2')
  assert.equal(url.searchParams.get('per_page'), '25')
  assert.equal(url.searchParams.get('status'), 'draft')
  assert.equal(url.searchParams.get('category'), 'avto')
  assert.equal(url.searchParams.get('q'), 'масло')
  assert.equal(url.searchParams.get('sort'), 'updated_at.desc')
})

test('listArticles defaults sort to updated_at.desc', async () => {
  const { calls, fetchImpl } = mockFetch(() => ({ status: 200, body: { items: [], page: 1, per_page: 50, total: 0 } }))
  const client = makeClient(fetchImpl)
  await client.listArticles()
  const url = new URL(calls[0].url)
  assert.equal(url.searchParams.get('page'), '1')
  assert.equal(url.searchParams.get('per_page'), '50')
  assert.equal(url.searchParams.get('sort'), 'updated_at.desc')
})

test('409 conflict is surfaced as a typed AdminApiError (not swallowed)', async () => {
  const { fetchImpl } = mockFetch(() => ({ status: 409, body: { error: 'conflict', message: 'Row changed since you loaded it' } }))
  const client = makeClient(fetchImpl)
  await assert.rejects(
    client.updateArticle('a1', { title: 'x' }, '2026-07-18T00:00:00Z'),
    (err: unknown) => {
      assert.ok(err instanceof AdminApiError)
      assert.equal(err.status, 409)
      assert.equal(err.code, 'conflict')
      assert.equal(err.message, 'Row changed since you loaded it')
      return true
    },
  )
})

test('updateArticle sends X-Expected-Updated-At and keeps the Idempotency-Key stable across a retry', async () => {
  const { calls, fetchImpl } = mockFetch(() => ({ status: 200, body: { item: { id: 'a1', revision_count: 2 } } }))
  const client = makeClient(fetchImpl)
  const key = crypto.randomUUID()
  // First attempt "fails" at the UI level, user retries with the SAME key.
  await client.updateArticle('a1', { title: 'x' }, '2026-07-18T00:00:00Z', key).catch(() => undefined)
  await client.updateArticle('a1', { title: 'x' }, '2026-07-18T00:00:00Z', key)
  assert.equal(calls.length, 2)
  assert.equal(calls[0].headers['idempotency-key'], key)
  assert.equal(calls[1].headers['idempotency-key'], key)
  assert.equal(calls[0].headers['x-expected-updated-at'], '2026-07-18T00:00:00Z')
  assert.equal(calls[0].method, 'PATCH')
  assert.deepEqual(JSON.parse(calls[0].body as string), { title: 'x' })
})

test('publish/unpublish send an Idempotency-Key and a fresh key is generated per mutation by default', async () => {
  const { calls, fetchImpl } = mockFetch(() => ({ status: 200, body: { item: { id: 'a1' }, purge_ok: true } }))
  const client = makeClient(fetchImpl)
  await client.publishArticle('a1')
  await client.publishArticle('a1')
  await client.unpublishArticle('a1')
  assert.equal(calls.length, 3)
  const keys = calls.map(c => c.headers['idempotency-key'])
  assert.ok(keys.every(k => typeof k === 'string' && k.length > 0))
  // Two separate user-initiated publishes → two distinct keys.
  assert.notEqual(keys[0], keys[1])
  assert.equal(calls[0].url, 'https://admin-api.test/admin/articles/a1/publish')
  assert.equal(calls[2].url, 'https://admin-api.test/admin/articles/a1/unpublish')
})

test('missing base URL throws a typed not_configured error', async () => {
  const prev = process.env.NEXT_PUBLIC_ADMIN_API_URL
  delete process.env.NEXT_PUBLIC_ADMIN_API_URL
  try {
    const client = createAdminApiClient({ getToken: async () => 't', fetchImpl: (() => Promise.reject(new Error('should not fetch'))) as unknown as typeof fetch })
    await assert.rejects(client.listArticles(), (err: unknown) => {
      assert.ok(err instanceof AdminApiError)
      assert.equal(err.code, 'not_configured')
      return true
    })
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_ADMIN_API_URL
    else process.env.NEXT_PUBLIC_ADMIN_API_URL = prev
  }
})

test('missing session token throws 401 not_authenticated before any fetch', async () => {
  const { calls, fetchImpl } = mockFetch(() => ({ status: 200, body: {} }))
  const client = createAdminApiClient({ baseUrl: 'https://admin-api.test', getToken: async () => null, fetchImpl })
  await assert.rejects(client.getArticle('a1'), (err: unknown) => {
    assert.ok(err instanceof AdminApiError)
    assert.equal(err.status, 401)
    assert.equal(err.code, 'not_authenticated')
    return true
  })
  assert.equal(calls.length, 0)
})

test('network failure is rethrown as AdminApiError (never swallowed)', async () => {
  const fetchImpl = (() => Promise.reject(new Error('socket hangup'))) as unknown as typeof fetch
  const client = makeClient(fetchImpl)
  await assert.rejects(client.listArticles(), (err: unknown) => {
    assert.ok(err instanceof AdminApiError)
    assert.equal(err.status, 0)
    assert.equal(err.code, 'network_error')
    assert.match(err.message, /socket hangup/)
    return true
  })
})
