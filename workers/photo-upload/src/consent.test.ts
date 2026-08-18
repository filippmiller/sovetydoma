import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hashEmailSubject, hasConsentEvent, hashIp, insertConsentEvent, isValidUuid } from './consent'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role', PII_HASH_SECRET: 'pepper' }

describe('consent_events writer (152-FZ evidence)', () => {
  it('hashes IPs with the configured pepper, not in the clear', async () => {
    const hashed = await hashIp(ENV, '203.0.113.10')
    assert.equal(typeof hashed, 'string')
    assert.equal(hashed?.includes('203.0.113.10'), false)
    assert.match(hashed || '', /^[0-9a-f]{64}$/)
  })

  it('fails closed (refuses to hash) when no pepper is configured', async () => {
    const hashed = await hashIp({ ...ENV, PII_HASH_SECRET: undefined }, '203.0.113.10')
    assert.equal(hashed, null)
  })

  it('validates UUIDs before treating a client-supplied subject as trustworthy', () => {
    assert.equal(isValidUuid('11111111-2222-3333-4444-555555555555'), true)
    assert.equal(isValidUuid('not-a-uuid'), false)
    assert.equal(isValidUuid(''), false)
  })

  it('inserts a new row via POST only — never PATCH/PUT/DELETE (append-only contract)', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const result = await insertConsentEvent(ENV, {
      subjectUserId: '11111111-2222-3333-4444-555555555555',
      purpose: 'terms',
      documentVersion: '2026-08-18',
      granted: true,
      method: 'signup',
      ip: '203.0.113.10',
      userAgent: 'test-agent',
    }, async (url, init) => {
      calls.push({ url: String(url), init: init || {} })
      return new Response(null, { status: 201 })
    })

    assert.equal(result.ok, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/consent_events')
    assert.equal(calls[0].init.method, 'POST')
    const body = JSON.parse(String(calls[0].init.body))
    assert.equal(body.purpose, 'terms')
    assert.equal(body.document_version, '2026-08-18')
    assert.equal(body.granted, true)
    assert.equal(body.method, 'signup')
    assert.equal(body.ip_hash.includes('203.0.113.10'), false)
    assert.equal(body.subject_user_id, '11111111-2222-3333-4444-555555555555')
  })

  it('rejects a syntactically-invalid subject user id rather than forwarding it to Postgres', async () => {
    const result = await insertConsentEvent(ENV, {
      subjectUserId: 'not-a-real-uuid',
      purpose: 'terms',
      documentVersion: '2026-08-18',
      granted: true,
      method: 'signup',
      ip: '203.0.113.10',
      userAgent: 'test-agent',
    }, async () => { throw new Error('must not call fetch for a bad subject') })

    assert.deepEqual(result, { ok: false, error: 'bad_subject' })
  })

  it('requires at least one subject identifier (user, lead, or anon)', async () => {
    const result = await insertConsentEvent(ENV, {
      purpose: 'pd_processing_general',
      documentVersion: '2026-08-18',
      granted: true,
      method: 'lead_form',
      ip: '203.0.113.10',
      userAgent: 'test-agent',
    }, async () => { throw new Error('must not call fetch with no subject') })

    assert.deepEqual(result, { ok: false, error: 'bad_subject' })
  })

  it('fails closed when the service role or pepper is not configured', async () => {
    const noRole = await insertConsentEvent({ SUPABASE_URL: 'https://example.supabase.co' }, {
      subjectAnonId: 'anon-123',
      purpose: 'pd_processing_general',
      documentVersion: '2026-08-18',
      granted: true,
      method: 'lead_form',
      ip: '203.0.113.10',
      userAgent: 'test-agent',
    })
    assert.deepEqual(noRole, { ok: false, error: 'not_configured' })

    const noPepper = await insertConsentEvent({ ...ENV, PII_HASH_SECRET: undefined }, {
      subjectAnonId: 'anon-123',
      purpose: 'pd_processing_general',
      documentVersion: '2026-08-18',
      granted: true,
      method: 'lead_form',
      ip: '203.0.113.10',
      userAgent: 'test-agent',
    })
    assert.deepEqual(noPepper, { ok: false, error: 'not_configured' })
  })

  it('hashEmailSubject is stable (no timestamp) and salted (not a plain hash of the email) — 152-FZ audit 2026-08-18', async () => {
    const first = await hashEmailSubject(ENV, 'user@example.com')
    const second = await hashEmailSubject(ENV, 'USER@example.com') // case-insensitive
    assert.equal(first, second, 'must be recomputable/lookupable from the same email later')
    assert.match(first || '', /^[0-9a-f]{64}$/)

    const differentPepper = await hashEmailSubject({ ...ENV, PII_HASH_SECRET: 'other-pepper' }, 'user@example.com')
    assert.notEqual(first, differentPepper, 'must depend on the server-side pepper, not just the email')
  })

  it('hashEmailSubject fails closed without a configured pepper', async () => {
    const hashed = await hashEmailSubject({ ...ENV, PII_HASH_SECRET: undefined }, 'user@example.com')
    assert.equal(hashed, null)
  })

  it('hasConsentEvent reports whether a (user, purpose) row already exists — used to allow the fresh-signup /consent fallback at most once', async () => {
    const found = await hasConsentEvent(ENV, '11111111-2222-3333-4444-555555555555', 'terms', async (url) => {
      assert.match(String(url), /consent_events\?subject_user_id=eq\.11111111-2222-3333-4444-555555555555&purpose=eq\.terms&select=id&limit=1/)
      return new Response(JSON.stringify([{ id: 'row-1' }]), { status: 200 })
    })
    assert.deepEqual(found, { ok: true, exists: true })

    const notFound = await hasConsentEvent(ENV, '11111111-2222-3333-4444-555555555555', 'privacy_policy', async () => new Response(JSON.stringify([]), { status: 200 }))
    assert.deepEqual(notFound, { ok: true, exists: false })
  })

  it('hasConsentEvent fails closed (ok: false) on a lookup error rather than treating an outage as "nothing recorded yet"', async () => {
    const result = await hasConsentEvent(ENV, '11111111-2222-3333-4444-555555555555', 'terms', async () => new Response('boom', { status: 500 }))
    assert.deepEqual(result, { ok: false, exists: false })
  })
})
