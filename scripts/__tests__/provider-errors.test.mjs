import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EXIT_PROVIDER_BALANCE,
  classifyProviderBalanceError,
} from '../factory/provider-errors.mjs'

describe('classifyProviderBalanceError', () => {
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

  it('uses the documented exit code 42', () => {
    assert.equal(EXIT_PROVIDER_BALANCE, 42)
  })
})
