import assert from 'node:assert/strict'
import { describe, it, afterEach } from 'node:test'
import worker, { type Env } from './index'

// ---------------------------------------------------------------------------
// Fetch mocking (same pattern as workers/photo-upload tests, but overriding
// globalThis.fetch because the worker calls fetch directly).
// ---------------------------------------------------------------------------

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: Record<string, unknown> | undefined
}

type Handler = (call: Call) => Response | Promise<Response>

const originalFetch = globalThis.fetch
let calls: Call[] = []

function installFetch(handler: Handler) {
  calls = []
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers: Record<string, string> = {}
    new Headers(init.headers || {}).forEach((v, k) => { headers[k] = v })
    const call: Call = {
      url: String(input),
      method: String(init.method || 'GET').toUpperCase(),
      headers,
      body: init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined,
    }
    calls.push(call)
    return handler(call)
  }) as typeof fetch
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

const ENV: Env = {
  SUPABASE_URL: 'https://sb.test',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ALLOWED_ORIGINS: 'https://1001sovet.ru,http://localhost:3000',
  RENDERER_URL: 'https://renderer.test',
  RENDERER_PURGE_SECRET: 'purge-secret',
}

const ARTICLE_ID = '11111111-2222-3333-4444-555555555555'
const AUTH = { Authorization: 'Bearer good-token' }

function currentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ARTICLE_ID,
    slug: 'test-article',
    category: 'ekonomiya',
    title: 'Test title',
    description: 'Test description',
    text_status: 'approved',
    disposition: 'active',
    body_md: '# Body',
    frontmatter: {},
    image_filename: 'test-article.jpg',
    revision_count: 2,
    quality_score: 0.8,
    published_at: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-17T10:00:00Z',
    ...overrides,
  }
}

/** Auth handling: /auth/v1/user + /rest/v1/profiles. role=null → profile miss. */
function authOk(call: Call, role: string | null = 'admin'): Response | null {
  if (call.url.includes('/auth/v1/user')) {
    if (call.headers['authorization'] === 'Bearer good-token') {
      return new Response(JSON.stringify({ id: 'user-1', email: 'admin@1001sovet.ru' }), { status: 200 })
    }
    return new Response(JSON.stringify({}), { status: 401 })
  }
  if (call.url.includes('/rest/v1/profiles')) {
    return new Response(JSON.stringify(role ? [{ role }] : []), { status: 200 })
  }
  return null
}

function restJson(rows: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(rows), { status: init.status || 200, headers: init.headers })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin-api worker', () => {
  it('GET /admin/health requires no auth', async () => {
    installFetch(() => { throw new Error('fetch must not be called') })
    const res = await worker.fetch(new Request('https://api.test/admin/health'), ENV)
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.ok, true)
    assert.ok(body.now)
  })

  it('returns 401 without a token', async () => {
    installFetch((call) => authOk(call) || restJson([]))
    const res = await worker.fetch(new Request('https://api.test/admin/articles'), ENV)
    assert.equal(res.status, 401)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.error, 'unauthorized')
  })

  it('returns 403 for a valid non-admin user', async () => {
    installFetch((call) => authOk(call, 'editor') || restJson([]))
    const res = await worker.fetch(
      new Request('https://api.test/admin/articles', { headers: AUTH }),
      ENV,
    )
    assert.equal(res.status, 403)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.error, 'forbidden')
  })

  it('list builds the correct PostgREST query with filters and Range', async () => {
    installFetch((call) => {
      const authRes = authOk(call)
      if (authRes) return authRes
      if (call.url.includes('/rest/v1/content_matrix')) {
        return restJson([{ id: ARTICLE_ID }], { headers: { 'content-range': '25-25/137' } })
      }
      throw new Error(`unexpected call ${call.url}`)
    })

    const res = await worker.fetch(
      new Request('https://api.test/admin/articles?status=draft&category=ekonomiya&q=hello,world&page=2&per_page=25&sort=title&sort_dir=asc', { headers: AUTH }),
      ENV,
    )
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.page, 2)
    assert.equal(body.per_page, 25)
    assert.equal(body.total, 137)
    assert.equal(body.items.length, 1)

    const listCall = calls.find((c) => c.url.includes('/rest/v1/content_matrix'))!
    const url = new URL(listCall.url)
    const sp = url.searchParams
    assert.ok(sp.get('select')!.includes('quality_score'))
    assert.ok(!sp.get('select')!.includes('body_md'))
    assert.equal(sp.get('text_status'), 'eq.draft')
    assert.equal(sp.get('category'), 'eq.ekonomiya')
    // PostgREST-grammar chars are stripped from q (comma removed).
    assert.equal(sp.get('or'), '(title.ilike.*hello world*,slug.ilike.*hello world*)')
    assert.equal(sp.get('order'), 'title.asc')
    assert.equal(listCall.headers['range'], '25-49')
    assert.equal(listCall.headers['range-unit'], 'items')
    assert.equal(listCall.headers['prefer'], 'count=exact')
    // Service-role key only goes upstream as a header, never in the URL.
    assert.equal(listCall.headers['apikey'], 'service-role-key')
    assert.ok(!listCall.url.includes('service-role-key'))
  })

  it('list caps per_page at 100', async () => {
    installFetch((call) => {
      const authRes = authOk(call)
      if (authRes) return authRes
      return restJson([], { headers: { 'content-range': '*/0' } })
    })
    const res = await worker.fetch(
      new Request('https://api.test/admin/articles?per_page=1000', { headers: AUTH }),
      ENV,
    )
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.per_page, 100)
    const listCall = calls.find((c) => c.url.includes('/rest/v1/content_matrix'))!
    assert.equal(listCall.headers['range'], '0-99')
  })

  it('PATCH returns 428 without X-Expected-Updated-At', async () => {
    installFetch((call) => authOk(call) || restJson([]))
    const res = await worker.fetch(
      new Request(`https://api.test/admin/articles/${ARTICLE_ID}`, {
        method: 'PATCH',
        headers: { ...AUTH, 'Content-Type': 'application/json', 'Idempotency-Key': 'k-1' },
        body: JSON.stringify({ title: 'New' }),
      }),
      ENV,
    )
    assert.equal(res.status, 428)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.error, 'precondition_required')
    // No mutation calls beyond auth.
    assert.equal(calls.some((c) => c.method === 'PATCH'), false)
  })

  it('PATCH returns 400 without Idempotency-Key', async () => {
    installFetch((call) => authOk(call) || restJson([]))
    const res = await worker.fetch(
      new Request(`https://api.test/admin/articles/${ARTICLE_ID}`, {
        method: 'PATCH',
        headers: { ...AUTH, 'Content-Type': 'application/json', 'X-Expected-Updated-At': '2026-07-17T10:00:00Z' },
        body: JSON.stringify({ title: 'New' }),
      }),
      ENV,
    )
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.error, 'bad_request')
  })

  it('PATCH rejects unknown fields with 400', async () => {
    installFetch((call) => authOk(call) || restJson([]))
    const res = await worker.fetch(
      new Request(`https://api.test/admin/articles/${ARTICLE_ID}`, {
        method: 'PATCH',
        headers: {
          ...AUTH,
          'Content-Type': 'application/json',
          'X-Expected-Updated-At': '2026-07-17T10:00:00Z',
          'Idempotency-Key': 'k-2',
        },
        body: JSON.stringify({ title: 'New', text_status: 'published' }),
      }),
      ENV,
    )
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.error, 'unknown_field')
    assert.ok(body.message.includes('text_status'))
  })

  it('PATCH happy path: revision snapshot, guarded write, audit + event', async () => {
    const row = currentRow()
    const updatedRow = { ...row, title: 'New title', revision_count: 3 }
    installFetch((call) => {
      const authRes = authOk(call)
      if (authRes) return authRes
      if (call.url.includes('/rest/v1/admin_audit_events') && call.method === 'GET') return restJson([])
      if (call.url.includes('/rest/v1/content_matrix') && call.method === 'GET') return restJson([row])
      if (call.url.includes('/rest/v1/article_revisions') && call.method === 'POST') return restJson(null, { status: 201 })
      if (call.url.includes('/rest/v1/content_matrix') && call.method === 'PATCH') return restJson([updatedRow])
      if (call.url.includes('/rest/v1/admin_audit_events') && call.method === 'POST') return restJson(null, { status: 201 })
      if (call.url.includes('/rest/v1/content_matrix_events') && call.method === 'POST') return restJson(null, { status: 201 })
      throw new Error(`unexpected call ${call.method} ${call.url}`)
    })

    const res = await worker.fetch(
      new Request(`https://api.test/admin/articles/${ARTICLE_ID}`, {
        method: 'PATCH',
        headers: {
          ...AUTH,
          'Content-Type': 'application/json',
          'X-Expected-Updated-At': '2026-07-17T10:00:00Z',
          'Idempotency-Key': 'k-3',
          'cf-ray': 'ray-123',
        },
        body: JSON.stringify({ title: 'New title', frontmatter: { pinned: true } }),
      }),
      ENV,
    )
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.item.title, 'New title')

    // Guarded PATCH targets id + updated_at.
    const patchCall = calls.find((c) => c.method === 'PATCH')!
    assert.ok(patchCall.url.includes(`id=eq.${ARTICLE_ID}`))
    assert.ok(patchCall.url.includes('updated_at=eq.'))
    assert.equal(patchCall.body.title, 'New title')
    assert.equal(patchCall.body.revision_count, 3)
    assert.deepEqual(patchCall.body.frontmatter, { pinned: true })

    // Revision snapshot happens BEFORE the guarded write and holds the old row.
    const revCall = calls.find((c) => c.url.includes('article_revisions'))!
    assert.ok(calls.indexOf(revCall) < calls.indexOf(patchCall))
    assert.equal(revCall.body.matrix_id, ARTICLE_ID)
    assert.equal(revCall.body.revision, 3)
    assert.equal(revCall.body.snapshot.title, 'Test title')
    assert.equal(revCall.body.actor_id, 'user-1')

    // Audit row carries before/after, idempotency key and cf-ray request id.
    const auditCall = calls.find((c) => c.url.includes('admin_audit_events') && c.method === 'POST')!
    assert.equal(auditCall.body.action, 'article.update')
    assert.equal(auditCall.body.actor_email, 'admin@1001sovet.ru')
    assert.deepEqual(auditCall.body.before, { title: 'Test title', frontmatter: {} })
    assert.deepEqual(auditCall.body.after, { title: 'New title', frontmatter: { pinned: true } })
    assert.equal(auditCall.body.idempotency_key, 'k-3')
    assert.equal(auditCall.body.request_id, 'ray-123')

    // Factory event log row.
    const evtCall = calls.find((c) => c.url.includes('content_matrix_events'))!
    assert.equal(evtCall.body.axis, 'admin')
    assert.equal(evtCall.body.agent, 'admin-api')
  })

  it('PATCH returns 409 when the guarded update matches no row', async () => {
    const row = currentRow()
    installFetch((call) => {
      const authRes = authOk(call)
      if (authRes) return authRes
      if (call.url.includes('/rest/v1/admin_audit_events')) return restJson([])
      if (call.url.includes('/rest/v1/article_revisions')) return restJson(null, { status: 201 })
      if (call.url.includes('/rest/v1/content_matrix') && call.method === 'PATCH') return restJson([])
      if (call.url.includes('/rest/v1/content_matrix') && call.url.includes('select=id')) return restJson([{ id: ARTICLE_ID }])
      if (call.url.includes('/rest/v1/content_matrix') && call.method === 'GET') return restJson([row])
      throw new Error(`unexpected call ${call.method} ${call.url}`)
    })

    const res = await worker.fetch(
      new Request(`https://api.test/admin/articles/${ARTICLE_ID}`, {
        method: 'PATCH',
        headers: {
          ...AUTH,
          'Content-Type': 'application/json',
          'X-Expected-Updated-At': '2026-07-16T09:00:00Z',
          'Idempotency-Key': 'k-4',
        },
        body: JSON.stringify({ title: 'New title' }),
      }),
      ENV,
    )
    assert.equal(res.status, 409)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.error, 'conflict')
  })

  it('idempotent replay returns the stored result without mutating', async () => {
    const stored = { item: { id: ARTICLE_ID, title: 'Stored title' } }
    installFetch((call) => {
      const authRes = authOk(call)
      if (authRes) return authRes
      if (call.url.includes('/rest/v1/admin_audit_events') && call.method === 'GET') {
        return restJson([{ result: stored }])
      }
      throw new Error(`mutation must not happen: ${call.method} ${call.url}`)
    })

    const res = await worker.fetch(
      new Request(`https://api.test/admin/articles/${ARTICLE_ID}`, {
        method: 'PATCH',
        headers: {
          ...AUTH,
          'Content-Type': 'application/json',
          'X-Expected-Updated-At': '2026-07-17T10:00:00Z',
          'Idempotency-Key': 'k-replay',
        },
        body: JSON.stringify({ title: 'New title' }),
      }),
      ENV,
    )
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('idempotent-replay'), 'true')
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.item.title, 'Stored title')
  })

  it('publish happy path: guarded update, index upsert, events, purge', async () => {
    const row = currentRow()
    const publishedRow = { ...row, text_status: 'published' }
    installFetch((call) => {
      const authRes = authOk(call)
      if (authRes) return authRes
      if (call.url === 'https://renderer.test/__purge') return restJson({ ok: true })
      if (call.url.includes('/rest/v1/admin_audit_events') && call.method === 'GET') return restJson([])
      if (call.url.includes('/rest/v1/content_matrix') && call.method === 'GET') return restJson([row])
      if (call.url.includes('/rest/v1/content_matrix') && call.method === 'PATCH') return restJson([publishedRow])
      if (call.url.includes('/rest/v1/articles_publication_index')) return restJson(null, { status: 201 })
      if (call.url.includes('/rest/v1/content_matrix_events')) return restJson(null, { status: 201 })
      if (call.url.includes('/rest/v1/admin_audit_events')) return restJson(null, { status: 201 })
      throw new Error(`unexpected call ${call.method} ${call.url}`)
    })

    const res = await worker.fetch(
      new Request(`https://api.test/admin/articles/${ARTICLE_ID}/publish`, {
        method: 'POST',
        headers: { ...AUTH, 'Idempotency-Key': 'pub-1' },
      }),
      ENV,
    )
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.item.text_status, 'published')
    assert.equal(body.index_ok, true)
    assert.equal(body.purge_ok, true)

    const patchCall = calls.find((c) => c.method === 'PATCH')!
    assert.ok(patchCall.url.includes('text_status=in.(approved,draft,unpublished)'))
    assert.equal(patchCall.body.text_status, 'published')
    assert.ok(patchCall.body.published_at)
    assert.equal(patchCall.body.frontmatter.published_via, 'dynamic')

    const idxCall = calls.find((c) => c.url.includes('articles_publication_index'))!
    assert.equal(idxCall.body.article_slug, 'test-article')
    assert.equal(idxCall.body.canonical_path, '/ekonomiya/test-article/')
    assert.ok(idxCall.headers['prefer']!.includes('resolution=merge-duplicates'))

    const purgeCall = calls.find((c) => c.url === 'https://renderer.test/__purge')!
    assert.equal(purgeCall.method, 'POST')
    assert.equal(purgeCall.headers['x-purge-secret'], 'purge-secret')
    assert.deepEqual(purgeCall.body, { category: 'ekonomiya', slug: 'test-article' })

    const auditCall = calls.find((c) => c.url.includes('admin_audit_events') && c.method === 'POST')!
    assert.equal(auditCall.body.action, 'article.publish')
  })

  it('publish is idempotent for an already-published row', async () => {
    const row = currentRow({ text_status: 'published', published_at: '2026-07-10T00:00:00Z' })
    installFetch((call) => {
      const authRes = authOk(call)
      if (authRes) return authRes
      if (call.url.includes('/rest/v1/admin_audit_events')) return restJson([])
      if (call.url.includes('/rest/v1/content_matrix') && call.method === 'GET') return restJson([row])
      throw new Error(`mutation must not happen: ${call.method} ${call.url}`)
    })
    const res = await worker.fetch(
      new Request(`https://api.test/admin/articles/${ARTICLE_ID}/publish`, {
        method: 'POST',
        headers: { ...AUTH, 'Idempotency-Key': 'pub-2' },
      }),
      ENV,
    )
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.already_published, true)
  })

  it('unpublish rejects a non-published row with 409', async () => {
    const row = currentRow({ text_status: 'draft' })
    installFetch((call) => {
      const authRes = authOk(call)
      if (authRes) return authRes
      if (call.url.includes('/rest/v1/admin_audit_events')) return restJson([])
      if (call.url.includes('/rest/v1/content_matrix') && call.method === 'GET') return restJson([row])
      throw new Error(`mutation must not happen: ${call.method} ${call.url}`)
    })
    const res = await worker.fetch(
      new Request(`https://api.test/admin/articles/${ARTICLE_ID}/unpublish`, {
        method: 'POST',
        headers: { ...AUTH, 'Idempotency-Key': 'unpub-1' },
      }),
      ENV,
    )
    assert.equal(res.status, 409)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.error, 'conflict')
  })

  it('unpublish happy path sets unpublished and purges', async () => {
    const row = currentRow({ text_status: 'published', published_at: '2026-07-10T00:00:00Z' })
    installFetch((call) => {
      const authRes = authOk(call)
      if (authRes) return authRes
      if (call.url === 'https://renderer.test/__purge') return restJson({ ok: true })
      if (call.url.includes('/rest/v1/admin_audit_events') && call.method === 'GET') return restJson([])
      if (call.url.includes('/rest/v1/content_matrix') && call.method === 'GET') return restJson([row])
      if (call.url.includes('/rest/v1/content_matrix') && call.method === 'PATCH') return restJson([{ ...row, text_status: 'unpublished' }])
      if (call.url.includes('/rest/v1/content_matrix_events')) return restJson(null, { status: 201 })
      if (call.url.includes('/rest/v1/admin_audit_events')) return restJson(null, { status: 201 })
      throw new Error(`unexpected call ${call.method} ${call.url}`)
    })
    const res = await worker.fetch(
      new Request(`https://api.test/admin/articles/${ARTICLE_ID}/unpublish`, {
        method: 'POST',
        headers: { ...AUTH, 'Idempotency-Key': 'unpub-2' },
      }),
      ENV,
    )
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.item.text_status, 'unpublished')
    assert.equal(body.purge_ok, true)
    const patchCall = calls.find((c) => c.method === 'PATCH')!
    assert.ok(patchCall.url.includes('text_status=eq.published'))
    assert.equal(patchCall.body.text_status, 'unpublished')
  })

  it('rejects cross-origin mutation from a disallowed Origin', async () => {
    installFetch(() => { throw new Error('fetch must not be called') })
    const res = await worker.fetch(
      new Request(`https://api.test/admin/articles/${ARTICLE_ID}/publish`, {
        method: 'POST',
        headers: { ...AUTH, 'Idempotency-Key': 'x', Origin: 'https://evil.example' },
      }),
      ENV,
    )
    assert.equal(res.status, 403)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.error, 'forbidden_origin')
  })

  it('returns 400 for a non-uuid article id', async () => {
    installFetch((call) => authOk(call) || restJson([]))
    const res = await worker.fetch(
      new Request('https://api.test/admin/articles/not-a-uuid', { headers: AUTH }),
      ENV,
    )
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.error, 'bad_id')
  })
})
