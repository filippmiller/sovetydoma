import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ANONYMIZED_COMMENT_TEXT,
  ANONYMIZED_DISPLAY_NAME,
  cancelErasure,
  finalizeErasureRequests,
  getErasureStatus,
  requestErasure,
} from './erasure'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role' }
const USER_ID = '11111111-2222-3333-4444-555555555555'

function fakeFetcher(handler: (url: string, init: RequestInit) => Response) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init: init || {} })
    return handler(url, init || {})
  }
  return { fetcher, calls }
}

describe('erasure_requests — two-phase soft-delete (152-FZ)', () => {
  it('requestErasure creates a pending row with a 30-day grace period', async () => {
    const { fetcher, calls } = fakeFetcher((url) => {
      if (url.includes('status=eq.pending') && !url.includes('user_id=eq.')) throw new Error('unexpected')
      if (calls_isLookup(url)) return new Response(JSON.stringify([]), { status: 200 })
      return new Response(JSON.stringify([{
        id: 'req-1', user_id: USER_ID, status: 'pending',
        requested_at: new Date().toISOString(),
        grace_period_ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        completed_at: null, cancelled_at: null,
      }]), { status: 201 })
    })

    const result = await requestErasure(ENV, USER_ID, 'hashed-ip', 'test-agent', fetcher)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.request.status, 'pending')
    assert.equal(result.request.user_id, USER_ID)

    const insertCall = calls.find((c) => c.init.method === 'POST')
    assert.ok(insertCall, 'expected a POST insert call')
    const body = JSON.parse(String(insertCall!.init.body))
    assert.equal(body.status, 'pending')
    assert.equal(body.ip_hash, 'hashed-ip')
    const grace = new Date(body.grace_period_ends_at).getTime()
    const expected = Date.now() + 30 * 86400000
    assert.ok(Math.abs(grace - expected) < 5000, 'grace period should be ~30 days out')
  })

  it('requestErasure is idempotent — returns the existing pending request instead of duplicating', async () => {
    const existing = {
      id: 'req-existing', user_id: USER_ID, status: 'pending',
      requested_at: new Date().toISOString(),
      grace_period_ends_at: new Date(Date.now() + 10 * 86400000).toISOString(),
      completed_at: null, cancelled_at: null,
    }
    const { fetcher, calls } = fakeFetcher(() => new Response(JSON.stringify([existing]), { status: 200 }))

    const result = await requestErasure(ENV, USER_ID, 'hashed-ip', 'test-agent', fetcher)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.request.id, 'req-existing')
    assert.equal(calls.every((c) => c.init.method !== 'POST'), true, 'must not insert a second pending row')
  })

  it('rejects a malformed user id without calling Supabase', async () => {
    const { fetcher, calls } = fakeFetcher(() => { throw new Error('must not call fetch') })
    const result = await requestErasure(ENV, 'not-a-uuid', 'hashed-ip', 'test-agent', fetcher)
    assert.deepEqual(result, { ok: false, error: 'bad_user' })
    assert.equal(calls.length, 0)
  })

  it('cancelErasure flips a pending row to cancelled', async () => {
    const { fetcher, calls } = fakeFetcher(() => new Response(JSON.stringify([{ id: 'req-1' }]), { status: 200 }))
    const result = await cancelErasure(ENV, USER_ID, fetcher)
    assert.deepEqual(result, { ok: true })
    assert.equal(calls[0].init.method, 'PATCH')
    const body = JSON.parse(String(calls[0].init.body))
    assert.equal(body.status, 'cancelled')
    assert.ok(body.cancelled_at)
  })

  it('cancelErasure reports not_found when there is nothing pending to cancel', async () => {
    const { fetcher } = fakeFetcher(() => new Response(JSON.stringify([]), { status: 200 }))
    const result = await cancelErasure(ENV, USER_ID, fetcher)
    assert.deepEqual(result, { ok: false, error: 'not_found' })
  })

  it('getErasureStatus returns null when there is no pending request', async () => {
    const { fetcher } = fakeFetcher(() => new Response(JSON.stringify([]), { status: 200 }))
    const result = await getErasureStatus(ENV, USER_ID, fetcher)
    assert.deepEqual(result, { ok: true, request: null })
  })

  // Helper: every finalize test now needs to answer the atomic claim PATCH
  // (status=eq.pending → 'processing') that runs before any PII is touched —
  // see erasure.ts's claimErasureRequest (152-FZ audit 2026-08-18 P1 fix).
  function claimHandler(url: string, init: RequestInit, claimed: string[]): Response | null {
    if (init.method === 'PATCH' && url.includes('status=eq.pending') && /erasure_requests\?id=eq\.[^&]+&status=eq\.pending/.test(url)) {
      claimed.push(url)
      return new Response(JSON.stringify([{ id: 'req-1' }]), { status: 200 })
    }
    return null
  }

  it('finalizeErasureRequests claims the row, anonymizes profiles/comments/saved_articles for each due request, and marks it completed', async () => {
    const due = [{ id: 'req-1', user_id: USER_ID }]
    const patchedTables: string[] = []
    const deletedTables: string[] = []
    const claimed: string[] = []
    let completedPatchBody: unknown = null

    const { fetcher } = fakeFetcher((url, init) => {
      if (url.includes('erasure_requests?status=eq.pending&grace_period_ends_at=lte.')) {
        return new Response(JSON.stringify(due), { status: 200 })
      }
      const claim = claimHandler(url, init, claimed)
      if (claim) return claim
      if (init.method === 'PATCH' && url.includes('/profiles?')) {
        patchedTables.push('profiles')
        const body = JSON.parse(String(init.body))
        assert.equal(body.display_name, ANONYMIZED_DISPLAY_NAME)
        assert.equal(body.bio, '')
        assert.equal(body.avatar_url, '')
        return new Response(null, { status: 204 })
      }
      if (init.method === 'PATCH' && url.includes('/comments?')) {
        patchedTables.push('comments')
        const body = JSON.parse(String(init.body))
        assert.equal(body.content, ANONYMIZED_COMMENT_TEXT)
        assert.equal(body.is_deleted, true)
        assert.equal(body.photo_path, null)
        return new Response(null, { status: 204 })
      }
      if (init.method === 'DELETE' && url.includes('/saved_articles?')) {
        deletedTables.push('saved_articles')
        return new Response(null, { status: 204 })
      }
      if (init.method === 'PATCH' && url === 'https://example.supabase.co/rest/v1/erasure_requests?id=eq.req-1') {
        completedPatchBody = JSON.parse(String(init.body))
        return new Response(null, { status: 204 })
      }
      throw new Error(`unexpected call: ${init.method} ${url}`)
    })

    const summary = await finalizeErasureRequests(ENV, fetcher, new Date())
    assert.deepEqual(summary, { processed: 1, completed: 1, failed: 0 })
    assert.equal(claimed.length, 1, 'must atomically claim the row before touching PII')
    assert.deepEqual(patchedTables.sort(), ['comments', 'profiles'])
    assert.deepEqual(deletedTables, ['saved_articles'])
    assert.equal((completedPatchBody as { status: string }).status, 'completed')
  })

  it('finalizeErasureRequests does NOT mark the request completed if any table anonymize call fails', async () => {
    const due = [{ id: 'req-1', user_id: USER_ID }]
    let erasureRequestsPatched = false
    const claimed: string[] = []

    const { fetcher } = fakeFetcher((url, init) => {
      if (url.includes('erasure_requests?status=eq.pending&grace_period_ends_at=lte.')) {
        return new Response(JSON.stringify(due), { status: 200 })
      }
      const claim = claimHandler(url, init, claimed)
      if (claim) return claim
      if (init.method === 'PATCH' && url.includes('/profiles?')) return new Response(null, { status: 204 })
      if (init.method === 'PATCH' && url.includes('/comments?')) return new Response('boom', { status: 500 })
      if (init.method === 'DELETE' && url.includes('/saved_articles?')) return new Response(null, { status: 204 })
      if (url === 'https://example.supabase.co/rest/v1/erasure_requests?id=eq.req-1') { erasureRequestsPatched = true; return new Response(null, { status: 204 }) }
      throw new Error(`unexpected call: ${init.method} ${url}`)
    })

    const summary = await finalizeErasureRequests(ENV, fetcher, new Date())
    assert.deepEqual(summary, { processed: 1, completed: 0, failed: 1 })
    assert.equal(erasureRequestsPatched, false, 'must not mark completed when a table anonymize failed')
  })

  it('finalizeErasureRequests skips a row untouched if it was cancelled between the SELECT and the claim attempt (TOCTOU fix)', async () => {
    const due = [{ id: 'req-1', user_id: USER_ID }]
    let anyPiiTouched = false

    const { fetcher } = fakeFetcher((url, init) => {
      if (url.includes('erasure_requests?status=eq.pending&grace_period_ends_at=lte.')) {
        return new Response(JSON.stringify(due), { status: 200 })
      }
      if (init.method === 'PATCH' && /erasure_requests\?id=eq\.[^&]+&status=eq\.pending/.test(url)) {
        // Simulate: the user's own cancel already flipped this row away from
        // 'pending', so the conditional claim affects zero rows.
        return new Response(JSON.stringify([]), { status: 200 })
      }
      if (url.includes('/profiles?') || url.includes('/comments?') || url.includes('/saved_articles?')) {
        anyPiiTouched = true
        return new Response(null, { status: 204 })
      }
      throw new Error(`unexpected call: ${init.method} ${url}`)
    })

    const summary = await finalizeErasureRequests(ENV, fetcher, new Date())
    assert.deepEqual(summary, { processed: 1, completed: 0, failed: 0 })
    assert.equal(anyPiiTouched, false, 'a lost claim must never anonymize or re-complete the row')
  })

  it('finalizeErasureRequests isolates a thrown network error to one request instead of aborting the whole batch', async () => {
    const SECOND_USER_ID = '22222222-3333-4444-5555-666666666666'
    const due = [{ id: 'req-1', user_id: USER_ID }, { id: 'req-2', user_id: SECOND_USER_ID }]
    const claimed: string[] = []

    const { fetcher } = fakeFetcher((url, init) => {
      if (url.includes('erasure_requests?status=eq.pending&grace_period_ends_at=lte.')) {
        return new Response(JSON.stringify(due), { status: 200 })
      }
      const claim = claimHandler(url, init, claimed)
      if (claim) return claim
      // req-1's own anonymize step (not the claim) throws — this must fail
      // ONLY req-1, not abort req-2's processing (152-FZ audit 2026-08-18 P1
      // fix: this loop used to have no try/catch at all around anonymizeUser).
      if (init.method === 'PATCH' && url.includes(`/profiles?id=eq.${USER_ID}`)) throw new Error('simulated network error')
      if (init.method === 'PATCH' && url.includes('/profiles?')) return new Response(null, { status: 204 })
      if (init.method === 'PATCH' && url.includes('/comments?')) return new Response(null, { status: 204 })
      if (init.method === 'DELETE' && url.includes('/saved_articles?')) return new Response(null, { status: 204 })
      if (url === 'https://example.supabase.co/rest/v1/erasure_requests?id=eq.req-2') return new Response(null, { status: 204 })
      throw new Error(`unexpected call: ${init.method} ${url}`)
    })

    const summary = await finalizeErasureRequests(ENV, fetcher, new Date())
    assert.deepEqual(summary, { processed: 2, completed: 1, failed: 1 })
  })

  it('finalizeErasureRequests deletes R2-stored comment photos for the erased user before anonymizing', async () => {
    const due = [{ id: 'req-1', user_id: USER_ID }]
    const claimed: string[] = []
    const deletedKeys: string[] = []
    const fakeBucket = {
      delete: async (key: string) => { deletedKeys.push(key) },
    } as unknown as R2Bucket

    const { fetcher } = fakeFetcher((url, init) => {
      if (url.includes('erasure_requests?status=eq.pending&grace_period_ends_at=lte.')) {
        return new Response(JSON.stringify(due), { status: 200 })
      }
      const claim = claimHandler(url, init, claimed)
      if (claim) return claim
      if (init.method === 'GET' && url.includes('/comments?') && url.includes('photo_path=not.is.null')) {
        return new Response(JSON.stringify([{ photo_path: 'misc/user-photo.jpg' }, { photo_path: null }]), { status: 200 })
      }
      if (init.method === 'PATCH' && url.includes('/profiles?')) return new Response(null, { status: 204 })
      if (init.method === 'PATCH' && url.includes('/comments?')) return new Response(null, { status: 204 })
      if (init.method === 'DELETE' && url.includes('/saved_articles?')) return new Response(null, { status: 204 })
      if (url === 'https://example.supabase.co/rest/v1/erasure_requests?id=eq.req-1') return new Response(null, { status: 204 })
      throw new Error(`unexpected call: ${init.method} ${url}`)
    })

    const summary = await finalizeErasureRequests({ ...ENV, PHOTOS: fakeBucket }, fetcher, new Date())
    assert.deepEqual(summary, { processed: 1, completed: 1, failed: 0 })
    assert.deepEqual(deletedKeys, ['misc/user-photo.jpg'])
  })

  it('finalizeErasureRequests is a no-op when nothing is due', async () => {
    const { fetcher } = fakeFetcher((url) => {
      if (url.includes('erasure_requests?status=eq.pending')) return new Response(JSON.stringify([]), { status: 200 })
      throw new Error(`unexpected call: ${url}`)
    })
    const summary = await finalizeErasureRequests(ENV, fetcher, new Date())
    assert.deepEqual(summary, { processed: 0, completed: 0, failed: 0 })
  })
})

function calls_isLookup(url: string): boolean {
  return url.includes('erasure_requests?user_id=eq.') && url.includes('status=eq.pending') && url.includes('limit=1')
}
