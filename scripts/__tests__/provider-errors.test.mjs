import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EXIT_OPERATOR_PAUSE,
  EXIT_PROVIDER_BALANCE,
  ProviderFailureError,
  asProviderError,
  buildFailure,
  classifyProviderBalanceError,
  classifyProviderFailure,
} from '../factory/provider-errors.mjs'

describe('classifyProviderBalanceError (legacy API)', () => {
  it('classifies the Anthropic relay credit-balance error as exhaustion', () => {
    const err = new Error('400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}')
    err.status = 400
    assert.equal(classifyProviderBalanceError(err), 'anthropic')
  })

  it('classifies insufficient-quota and HTTP 402 as exhaustion', () => {
    const quota = new Error('429 insufficient_quota: You exceeded your current quota')
    quota.status = 429
    assert.equal(classifyProviderBalanceError(quota), 'anthropic')
    assert.equal(classifyProviderBalanceError(new Error('fal 402: {"detail":"payment required"}')), 'fal')
  })

  it('does not classify generic errors', () => {
    assert.equal(classifyProviderBalanceError(new Error('mojibake in generated text')), null)
    assert.equal(classifyProviderBalanceError(new Error('matrix insert: duplicate key value')), null)
    assert.equal(classifyProviderBalanceError(new Error('fal 500: upstream timeout')), null)
    assert.equal(classifyProviderBalanceError(new Error('fal: exhausted retries')), null)
  })

  it('uses the documented exit codes 42 and 43', () => {
    assert.equal(EXIT_PROVIDER_BALANCE, 42)
    assert.equal(EXIT_OPERATOR_PAUSE, 43)
  })
})

describe('classifyProviderFailure (structured)', () => {
  const rawCreditBody = 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'

  it('classifies text-stage anthropic credit balance (HTTP 400 body) with call-site attribution', () => {
    const err = new Error(`400 {"error":{"message":"${rawCreditBody}"}}`)
    err.status = 400
    const f = classifyProviderFailure(err, { provider: 'anthropic', stage: 'text' })
    assert.equal(f.kind, 'balance')
    assert.equal(f.provider, 'anthropic')
    assert.equal(f.stage, 'text')
    assert.equal(f.reason, 'anthropic_balance')
    assert.match(f.action, /top up/i)
    assert.equal(f.retryable, false)
  })

  it('never leaks the raw provider response into the structured result', () => {
    const err = new Error(`402 ${rawCreditBody}`)
    err.status = 402
    const f = classifyProviderFailure(err, { provider: 'anthropic', stage: 'text' })
    const serialized = JSON.stringify(f)
    assert.ok(!serialized.includes('credit balance is too low'), 'raw payload must not appear')
    assert.ok(!serialized.includes('message'), 'no raw message field')
  })

  it('classifies quota-bearing 429 as balance, plain 429 as rate_limited', () => {
    const quota = new Error('429 insufficient_quota: You exceeded your current quota')
    quota.status = 429
    assert.equal(classifyProviderFailure(quota, { provider: 'anthropic', stage: 'text' }).kind, 'balance')
    const plain = new Error('429 too many requests')
    plain.status = 429
    const f = classifyProviderFailure(plain, { provider: 'fal', stage: 'image' })
    assert.equal(f.kind, 'rate_limited')
    assert.equal(f.provider, 'fal')
    assert.equal(f.stage, 'image')
    assert.equal(f.retryable, true)
  })

  it('classifies fal image payment required (402) at the image call site', () => {
    const err = new Error('fal 402: {"detail":"payment required"}')
    const f = classifyProviderFailure(err, { provider: 'fal', stage: 'image' })
    assert.equal(f.kind, 'balance')
    assert.equal(f.provider, 'fal')
    assert.equal(f.stage, 'image')
    assert.equal(f.reason, 'fal_balance')
  })

  it('classifies auth/config separately from balance', () => {
    const badKey = new Error('401 {"error":{"type":"authentication_error","message":"invalid x-api-key"}}')
    badKey.status = 401
    assert.equal(classifyProviderFailure(badKey, { provider: 'anthropic', stage: 'text' }).kind, 'auth')
    const forbidden = new Error('403 forbidden')
    forbidden.status = 403
    const f = classifyProviderFailure(forbidden, { provider: 'fal', stage: 'image' })
    assert.equal(f.kind, 'auth')
    assert.match(f.action, /credentials/i)
  })

  it('classifies transient unavailable/timeout separately (incl. HTTP 524 relay timeout)', () => {
    const five = new Error('fal 500: upstream error')
    five.status = 500
    assert.equal(classifyProviderFailure(five, { provider: 'fal', stage: 'image' }).kind, 'unavailable')
    const relay = new Error('524 relay timeout')
    relay.status = 524
    const f = classifyProviderFailure(relay, { provider: 'anthropic', stage: 'text' })
    assert.equal(f.kind, 'timeout')
    assert.equal(f.reason, 'anthropic_timeout')
    assert.match(f.action, /524|timed/i)
    const net = new Error('fetch failed')
    assert.equal(classifyProviderFailure(net, { provider: 'anthropic', stage: 'text' }).kind, 'timeout')
    const sdkConnection = new Error('Connection error.')
    sdkConnection.name = 'APIConnectionError'
    const connectionFailure = classifyProviderFailure(sdkConnection, { provider: 'anthropic', stage: 'text' })
    assert.equal(connectionFailure.kind, 'unavailable')
    assert.equal(connectionFailure.provider, 'anthropic')
    assert.equal(connectionFailure.stage, 'text')
  })

  it('does NOT attribute a generic DB error to the text provider even when quota is mentioned elsewhere', () => {
    // A DB error mentioning nothing provider-specific must stay unknown even
    // when the call-site provider/stage are passed in.
    const db = new Error('matrix insert: duplicate key value violates unique constraint "content_matrix_pkey"')
    const f = classifyProviderFailure(db, { provider: 'anthropic', stage: 'text' })
    assert.equal(f.kind, 'unknown')
    assert.equal(f.provider, null)
    assert.equal(f.reason, 'unclassified_failure')
  })

  it('asProviderError wraps every provider-call failure with safe provider context', () => {
    const credit = new Error(`400 ${rawCreditBody}`)
    credit.status = 400
    const wrapped = asProviderError(credit, { provider: 'anthropic', stage: 'text' })
    assert.ok(wrapped instanceof ProviderFailureError)
    assert.equal(wrapped.message, 'anthropic_balance')
    assert.equal(wrapped.failure.kind, 'balance')
    const generic = new Error('upstream response contained synthetic-secret-payload')
    const wrappedGeneric = asProviderError(generic, { provider: 'anthropic', stage: 'text' })
    assert.ok(wrappedGeneric instanceof ProviderFailureError)
    assert.equal(wrappedGeneric.failure.provider, 'anthropic')
    assert.equal(wrappedGeneric.failure.stage, 'text')
    assert.ok(!JSON.stringify(wrappedGeneric.failure).includes('synthetic-secret-payload'))
  })

  it('buildFailure emits stable reason codes per provider/stage kind', () => {
    assert.equal(buildFailure('balance', 'fal', 'image').reason, 'fal_balance')
    assert.equal(buildFailure('timeout', 'fal', 'image').reason, 'fal_timeout')
    assert.equal(buildFailure('balance', 'anthropic', 'text').reason, 'anthropic_balance')
    assert.equal(buildFailure('unknown', 'anthropic', 'text').provider, null)
  })
})
