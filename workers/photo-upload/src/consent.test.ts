import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hashIp, insertConsentEvent, isValidUuid } from './consent'

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
})
