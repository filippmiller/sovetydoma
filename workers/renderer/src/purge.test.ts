import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import worker from './index'
import { timingSafeEqual } from './purge'

// Map-backed fake for the Workers Cache API (caches.default).
function installFakeCache() {
  const store = new Map<string, Response>()
  const deleted: string[] = []
  const fake = {
    async match(key: Request): Promise<Response | undefined> {
      const hit = store.get(key.url)
      return hit ? hit.clone() : undefined
    },
    async put(key: Request, response: Response): Promise<void> {
      store.set(key.url, response.clone())
    },
    async delete(key: Request): Promise<boolean> {
      deleted.push(key.url)
      return store.delete(key.url)
    },
  }
  const g = globalThis as { caches?: { default: unknown } }
  const previous = g.caches
  g.caches = { default: fake }
  return {
    store,
    deleted,
    restore() {
      if (previous === undefined) delete g.caches
      else g.caches = previous
    },
  }
}

type Env = Parameters<typeof worker.fetch>[1]

function makeEnv(secret?: string): Env {
  return {
    ARTICLE_IMAGES: {} as Env['ARTICLE_IMAGES'],
    SUPABASE_URL: 'https://db.test',
    SUPABASE_SERVICE_ROLE_KEY: 'db-key',
    TEMPLATE_URL: 'https://1001sovet.ru/ekonomiya/ekonomiya-vody/',
    SITE_URL: 'https://1001sovet.ru',
    RENDERER_PURGE_SECRET: secret,
  } as Env
}

function purgeRequest(body: unknown, secret?: string, method = 'POST'): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret !== undefined) headers['x-purge-secret'] = secret
  return new Request('https://1001sovet.ru/__purge', {
    method,
    headers,
    ...(method === 'GET' || method === 'HEAD'
      ? {}
      : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  })
}

// Seed the fake cat-rows cache so the purge handler can compute hub pages
// without touching the DB. Counts mirror fetchCategoryRows output.
function seedCategoryRows(store: Map<string, Response>, category: string, dynamic: number, stat: number) {
  const rows = [
    ...Array.from({ length: dynamic }, (_, i) => ({ slug: `dyn-${i}`, published_via: 'dynamic' })),
    ...Array.from({ length: stat }, (_, i) => ({ slug: `st-${i}`, published_via: 'static' })),
  ]
  store.set(
    `https://1001sovet.ru/__internal/cat-rows/${category}?render=13`,
    new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } }),
  )
}

function sorted(values: string[]): string[] {
  return [...values].sort()
}

describe('timingSafeEqual', () => {
  it('matches equal strings and rejects different or different-length strings', () => {
    assert.equal(timingSafeEqual('abc', 'abc'), true)
    assert.equal(timingSafeEqual('abc', 'abd'), false)
    assert.equal(timingSafeEqual('abc', 'abcd'), false)
    assert.equal(timingSafeEqual('', ''), true)
  })
})

describe('POST /__purge', () => {
  it('returns 405 for non-POST methods', async () => {
    const cache = installFakeCache()
    try {
      const resp = await worker.fetch(purgeRequest({}, 's', 'GET'), makeEnv('s'))
      assert.equal(resp.status, 405)
    } finally {
      cache.restore()
    }
  })

  it('returns 503 purge_not_configured when RENDERER_PURGE_SECRET is unset (fail closed)', async () => {
    const cache = installFakeCache()
    try {
      const resp = await worker.fetch(purgeRequest({ category: 'ekonomiya' }, 'anything'), makeEnv(undefined))
      assert.equal(resp.status, 503)
      const body = await resp.json() as { error: string }
      assert.equal(body.error, 'purge_not_configured')
      assert.deepEqual(cache.deleted, [])
    } finally {
      cache.restore()
    }
  })

  it('returns 401 without the secret header and with a wrong secret', async () => {
    const cache = installFakeCache()
    try {
      const missing = await worker.fetch(purgeRequest({ category: 'ekonomiya' }), makeEnv('s3cret'))
      assert.equal(missing.status, 401)
      const body = await missing.json() as { error: string }
      assert.equal(body.error, 'unauthorized')

      const wrong = await worker.fetch(purgeRequest({ category: 'ekonomiya' }, 'nope'), makeEnv('s3cret'))
      assert.equal(wrong.status, 401)
      assert.deepEqual(cache.deleted, [])
    } finally {
      cache.restore()
    }
  })

  it('returns 400 on invalid JSON and on invalid params', async () => {
    const cache = installFakeCache()
    try {
      const badJson = await worker.fetch(purgeRequest('not-json{', 's3cret'), makeEnv('s3cret'))
      assert.equal(badJson.status, 400)

      const badCategory = await worker.fetch(purgeRequest({ category: 'Bad Category!' }, 's3cret'), makeEnv('s3cret'))
      assert.equal(badCategory.status, 400)

      const badSlug = await worker.fetch(purgeRequest({ category: 'ekonomiya', slug: 'UPPER/bad' }, 's3cret'), makeEnv('s3cret'))
      assert.equal(badSlug.status, 400)

      const missingCategory = await worker.fetch(purgeRequest({ slug: 'x' }, 's3cret'), makeEnv('s3cret'))
      assert.equal(missingCategory.status, 400)
      assert.deepEqual(cache.deleted, [])
    } finally {
      cache.restore()
    }
  })

  it('purges article + cat-rows + hub + sitemap keys when slug is given', async () => {
    const cache = installFakeCache()
    try {
      // 45 dynamic rows → ceil(45/40) = 2 hub pages → delete pages 1..3
      seedCategoryRows(cache.store, 'ekonomiya', 45, 10)
      const resp = await worker.fetch(
        purgeRequest({ category: 'ekonomiya', slug: 'kak-sekonomit-na-vode' }, 's3cret'),
        makeEnv('s3cret'),
      )
      assert.equal(resp.status, 200)
      const body = await resp.json() as {
        purged: string[]
        purge_all_colos: boolean
        hub_pages_source: string
        note: string
      }

      const expected = [
        'https://1001sovet.ru/ekonomiya/kak-sekonomit-na-vode/?render=13',
        'https://1001sovet.ru/__internal/cat-rows/ekonomiya?render=13',
        'https://1001sovet.ru/stati//1?render=13',
        'https://1001sovet.ru/stati/ekonomiya/1?render=13',
        'https://1001sovet.ru/stati/ekonomiya/2?render=13',
        'https://1001sovet.ru/stati/ekonomiya/3?render=13',
        'https://1001sovet.ru/sitemap-dynamic.xml?generator=v3',
        'https://1001sovet.ru/zen.xml?generator=v4',
      ]
      assert.deepEqual(sorted(cache.deleted), sorted(expected))
      assert.deepEqual(sorted(body.purged), sorted(expected))
      assert.equal(body.purge_all_colos, false)
      assert.equal(body.hub_pages_source, 'rows')
      assert.match(body.note, /per-datacenter/)

      // cat-rows entry was actually evicted from the cache
      assert.equal(cache.store.has('https://1001sovet.ru/__internal/cat-rows/ekonomiya?render=13'), false)
    } finally {
      cache.restore()
    }
  })

  it('category-only purge skips the article key and deletes only page 1..2 of a small hub', async () => {
    const cache = installFakeCache()
    try {
      // 5 dynamic rows → ceil(5/40) = 1 hub page → delete pages 1..2
      seedCategoryRows(cache.store, 'kulinaria', 5, 100)
      const resp = await worker.fetch(purgeRequest({ category: 'kulinaria' }, 's3cret'), makeEnv('s3cret'))
      assert.equal(resp.status, 200)
      const body = await resp.json() as { purged: string[] }

      const expected = [
        'https://1001sovet.ru/__internal/cat-rows/kulinaria?render=13',
        'https://1001sovet.ru/stati//1?render=13',
        'https://1001sovet.ru/stati/kulinaria/1?render=13',
        'https://1001sovet.ru/stati/kulinaria/2?render=13',
        'https://1001sovet.ru/sitemap-dynamic.xml?generator=v3',
        'https://1001sovet.ru/zen.xml?generator=v4',
      ]
      assert.deepEqual(sorted(cache.deleted), sorted(expected))
      assert.deepEqual(sorted(body.purged), sorted(expected))
      assert.ok(!cache.deleted.some((key) => key.includes('/kulinaria/kulinaria/')))
    } finally {
      cache.restore()
    }
  })
})
