import assert from 'node:assert/strict'
import { describe, it, afterEach } from 'node:test'
import worker, { type Env } from './index'

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
    let body: Record<string, unknown> | undefined
    if (init.body && typeof init.body === 'string') {
      try { body = JSON.parse(init.body) as Record<string, unknown> } catch { body = undefined }
    }
    const call: Call = {
      url: String(input),
      method: String(init.method || 'GET').toUpperCase(),
      headers,
      body,
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
  SITE_URL: 'https://1001sovet.ru',
  FAL_KEY: 'fal-test-key',
}

const ARTICLE_ID = '8ffade5c-493d-4ec2-80d7-de1cfae7c4e5'
const MEDIA_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const AUTH = { Authorization: 'Bearer good-token' }

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

function articleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ARTICLE_ID,
    slug: 'rulet-lavash-avokado-krab',
    category: 'kulinaria',
    title: 'Рулет',
    description: 'd',
    text_status: 'unpublished',
    body_md: '# x',
    frontmatter: {},
    image_filename: 'rulet-lavash-avokado-krab.jpg',
    image_prompt: 'lavash roll still life',
    image_source: 'fal',
    revision_count: 1,
    updated_at: '2026-07-18T12:00:00Z',
    published_at: null,
    ...overrides,
  }
}

describe('admin-api media routes', () => {
  it('GET /admin/media requires auth', async () => {
    installFetch(() => restJson([]))
    const res = await worker.fetch(new Request('https://api.test/admin/media'), ENV)
    assert.equal(res.status, 401)
  })

  it('GET /admin/media lists inventory with cursor page', async () => {
    installFetch((call) => {
      const a = authOk(call)
      if (a) return a
      if (call.url.includes('/rest/v1/content_matrix') && call.method === 'GET') {
        return restJson([
          articleRow(),
          articleRow({ id: '11111111-1111-1111-1111-111111111111', slug: 'other', updated_at: '2026-07-17T00:00:00Z' }),
        ])
      }
      if (call.url.includes('/rest/v1/article_media')) return restJson([])
      throw new Error(`unexpected ${call.method} ${call.url}`)
    })
    const res = await worker.fetch(new Request('https://api.test/admin/media?limit=30', { headers: AUTH }), ENV)
    assert.equal(res.status, 200)
    const body = await res.json() as { items: Array<{ article: { slug: string }; media_status: string }> }
    assert.ok(body.items.length >= 1)
    assert.equal(body.items[0].article.slug, 'rulet-lavash-avokado-krab')
    assert.equal(body.items[0].media_status, 'live') // synthetic legacy
  })

  it('POST generations requires Idempotency-Key', async () => {
    installFetch((call) => authOk(call) || restJson([]))
    const res = await worker.fetch(new Request(`https://api.test/admin/articles/${ARTICLE_ID}/media/generations`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', Origin: 'https://1001sovet.ru' },
      body: JSON.stringify({ count: 2 }),
    }), ENV)
    assert.equal(res.status, 400)
    const body = await res.json() as { error: string }
    assert.equal(body.error, 'bad_request')
  })

  it('POST generations creates job when FAL configured', async () => {
    installFetch((call) => {
      const a = authOk(call)
      if (a) return a
      if (call.url.includes('admin_audit_events') && call.method === 'GET') return restJson([])
      if (call.url.includes('content_matrix') && call.method === 'GET') return restJson([articleRow()])
      if (call.url.includes('media_generation_jobs') && call.method === 'POST') {
        return restJson([{
          id: '99999999-9999-9999-9999-999999999999',
          article_id: ARTICLE_ID,
          status: 'queued',
          prompt: 'x',
          candidate_count: 2,
        }])
      }
      if (call.url.includes('admin_audit_events') && call.method === 'POST') return restJson({}, { status: 201 })
      if (call.url.includes('article_media_events') && call.method === 'POST') return restJson({}, { status: 201 })
      // background job may fire — tolerate
      if (call.url.includes('media_generation_jobs')) return restJson([{
        id: '99999999-9999-9999-9999-999999999999',
        article_id: ARTICLE_ID,
        status: 'queued',
        prompt: 'lavash',
        candidate_count: 2,
        attempt: 0,
      }])
      if (call.url.includes('fal.run')) {
        return new Response(JSON.stringify({ images: [{ url: 'https://img.test/a.jpg', width: 1280, height: 960 }] }), { status: 200 })
      }
      if (call.url.includes('img.test')) return new Response(new Uint8Array(8000), { status: 200 })
      if (call.url.includes('article_media')) return restJson([{ id: MEDIA_ID, version: 1, status: 'candidate' }], { status: 201 })
      return restJson([])
    })
    const res = await worker.fetch(new Request(`https://api.test/admin/articles/${ARTICLE_ID}/media/generations`, {
      method: 'POST',
      headers: {
        ...AUTH,
        'Content-Type': 'application/json',
        Origin: 'https://1001sovet.ru',
        'Idempotency-Key': 'gen-1',
      },
      body: JSON.stringify({ count: 2, prompt: 'lavash roll still life' }),
    }), ENV)
    assert.equal(res.status, 202)
    const body = await res.json() as { job: { id: string; status: string } }
    assert.equal(body.job.status, 'queued')
    assert.ok(body.job.id)
  })

  it('POST assign updates image_filename with immutable key and purges when published', async () => {
    installFetch((call) => {
      const a = authOk(call)
      if (a) return a
      if (call.url.includes('admin_audit_events') && call.method === 'GET') return restJson([])
      if (call.url.includes('content_matrix') && call.method === 'GET') {
        return restJson([articleRow({ text_status: 'published', published_at: '2026-07-01T00:00:00Z' })])
      }
      if (call.url.includes('article_media') && call.method === 'GET') {
        return restJson([{
          id: MEDIA_ID,
          article_id: ARTICLE_ID,
          version: 2,
          storage_key: 'rulet-lavash-avokado-krab-v2-abc123.jpg',
          status: 'candidate',
          source: 'generated',
          provider: 'fal',
          prompt: 'still life',
        }])
      }
      if (call.url.includes('article_media') && call.method === 'PATCH') {
        if (call.url.includes('status=eq.live')) return restJson([])
        return restJson([{
          id: MEDIA_ID,
          article_id: ARTICLE_ID,
          version: 2,
          storage_key: 'rulet-lavash-avokado-krab-v2-abc123.jpg',
          status: 'live',
          source: 'generated',
        }])
      }
      if (call.url.includes('content_matrix') && call.method === 'PATCH') {
        return restJson([articleRow({
          text_status: 'published',
          image_filename: 'rulet-lavash-avokado-krab-v2-abc123.jpg',
          active_media_id: MEDIA_ID,
          revision_count: 2,
          updated_at: '2026-07-19T00:00:00Z',
        })])
      }
      if (call.url.includes('article_revisions')) return restJson({}, { status: 201 })
      if (call.url.includes('content_matrix_events')) return restJson({}, { status: 201 })
      if (call.url.includes('admin_audit_events') && call.method === 'POST') return restJson({}, { status: 201 })
      if (call.url.includes('article_media_events')) return restJson({}, { status: 201 })
      if (call.url === 'https://renderer.test/__purge') return restJson({ ok: true })
      throw new Error(`unexpected ${call.method} ${call.url}`)
    })
    const res = await worker.fetch(new Request(
      `https://api.test/admin/articles/${ARTICLE_ID}/media/${MEDIA_ID}/assign`,
      {
        method: 'POST',
        headers: {
          ...AUTH,
          Origin: 'https://1001sovet.ru',
          'Idempotency-Key': 'assign-1',
          'X-Expected-Updated-At': '2026-07-18T12:00:00Z',
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    ), ENV)
    assert.equal(res.status, 200)
    const body = await res.json() as { purge_ok: boolean; item: { image_filename: string } }
    assert.equal(body.purge_ok, true)
    assert.equal(body.item.image_filename, 'rulet-lavash-avokado-krab-v2-abc123.jpg')
    const purgeCall = calls.find((c) => c.url.includes('/__purge'))
    assert.ok(purgeCall)
  })

  it('assign leaves media rows untouched when the guarded article update loses a 409 race', async () => {
    installFetch((call) => {
      const a = authOk(call)
      if (a) return a
      if (call.url.includes('admin_audit_events') && call.method === 'GET') return restJson([])
      if (call.url.includes('content_matrix') && call.method === 'GET') return restJson([articleRow()])
      if (call.url.includes('article_media') && call.method === 'GET') {
        return restJson([{ id: MEDIA_ID, article_id: ARTICLE_ID, version: 2, storage_key: 'k-v2.jpg', status: 'candidate', source: 'generated', provider: 'fal' }])
      }
      if (call.url.includes('content_matrix') && call.method === 'PATCH') return restJson([]) // guarded update matches no row
      if (call.url.includes('article_media') && call.method === 'PATCH') return restJson([])
      throw new Error(`unexpected ${call.method} ${call.url}`)
    })
    const res = await worker.fetch(new Request(
      `https://api.test/admin/articles/${ARTICLE_ID}/media/${MEDIA_ID}/assign`,
      {
        method: 'POST',
        headers: { ...AUTH, Origin: 'https://1001sovet.ru', 'Idempotency-Key': 'assign-409', 'X-Expected-Updated-At': '2026-07-18T12:00:00Z', 'Content-Type': 'application/json' },
        body: '{}',
      },
    ), ENV)
    assert.equal(res.status, 409)
    // The article guard runs first, so no media-status flip happened.
    const mediaPatch = calls.find((c) => c.url.includes('article_media') && c.method === 'PATCH')
    assert.equal(mediaPatch, undefined)
  })

  it('archiving the live media promotes the previous version back to live', async () => {
    const PREV_ID = 'ffffffff-1111-2222-3333-444444444444'
    installFetch((call) => {
      const a = authOk(call)
      if (a) return a
      if (call.url.includes('admin_audit_events') && call.method === 'GET') return restJson([])
      if (call.url.includes('content_matrix') && call.method === 'GET') {
        return restJson([articleRow({ text_status: 'published', published_at: '2026-07-01T00:00:00Z', active_media_id: MEDIA_ID, image_filename: 'k-v3.jpg' })])
      }
      if (call.url.includes('article_media') && call.url.includes('status=eq.archived') && call.method === 'GET') {
        return restJson([{ id: PREV_ID, article_id: ARTICLE_ID, version: 2, storage_key: 'k-v2.jpg', status: 'archived' }])
      }
      if (call.url.includes('article_media') && call.url.includes(`id=eq.${MEDIA_ID}`) && call.method === 'GET') {
        return restJson([{ id: MEDIA_ID, article_id: ARTICLE_ID, version: 3, storage_key: 'k-v3.jpg', status: 'live' }])
      }
      if (call.url.includes('article_media') && call.method === 'PATCH') return restJson([{}])
      if (call.url.includes('content_matrix') && call.method === 'PATCH') {
        return restJson([articleRow({ active_media_id: PREV_ID, image_filename: 'k-v2.jpg' })])
      }
      if (call.url.includes('article_revisions')) return restJson({}, { status: 201 })
      if (call.url.includes('content_matrix_events')) return restJson({}, { status: 201 })
      if (call.url.includes('admin_audit_events') && call.method === 'POST') return restJson({}, { status: 201 })
      if (call.url.includes('article_media_events')) return restJson({}, { status: 201 })
      if (call.url === 'https://renderer.test/__purge') return restJson({ ok: true })
      throw new Error(`unexpected ${call.method} ${call.url}`)
    })
    const res = await worker.fetch(new Request(
      `https://api.test/admin/articles/${ARTICLE_ID}/media/${MEDIA_ID}/archive`,
      {
        method: 'POST',
        headers: { ...AUTH, Origin: 'https://1001sovet.ru', 'Idempotency-Key': 'arch-1', 'Content-Type': 'application/json' },
        body: '{}',
      },
    ), ENV)
    assert.equal(res.status, 200)
    const promote = calls.find((c) => c.url.includes(`article_media?id=eq.${PREV_ID}`) && c.method === 'PATCH')
    assert.ok(promote, 'expected a PATCH promoting the previous version')
    assert.equal(promote!.body!.status, 'live')
  })

  it('health reports media capability flags', async () => {
    installFetch(() => { throw new Error('no fetch') })
    const res = await worker.fetch(new Request('https://api.test/admin/health'), ENV)
    assert.equal(res.status, 200)
    const body = await res.json() as { media: { fal: boolean; purge: boolean } }
    assert.equal(body.media.fal, true)
    assert.equal(body.media.purge, true)
  })
})
