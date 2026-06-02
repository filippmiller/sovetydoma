import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeSubscriptionRequest,
  validateSubscriptionRequest,
} from '../src/lib/subscriptions/validation.mjs'

test('requires at least one valid category', () => {
  const result = validateSubscriptionRequest({
    categories: [],
    channels: ['email'],
    frequency: 'daily_one',
    contacts: { email: 'a@b.com' },
    consent: true,
  })

  assert.equal(result.valid, false)
  assert.equal(result.errors.categories, 'Выберите хотя бы одну категорию')
})

test('keeps only known category slugs and channels', () => {
  const normalized = normalizeSubscriptionRequest({
    categories: ['kulinaria', 'bad'],
    channels: ['email', 'unknown'],
    frequency: 'daily_digest_3',
    contacts: { email: ' USER@Example.COM ' },
    consent: true,
  })

  assert.deepEqual(normalized.categories, ['kulinaria'])
  assert.deepEqual(normalized.channels, ['email'])
  assert.equal(normalized.contacts.email, 'user@example.com')
})

test('requires matching contacts for selected direct channels', () => {
  const result = validateSubscriptionRequest({
    categories: ['rybalka'],
    channels: ['email', 'telegram', 'sms'],
    frequency: 'weekly_digest_3',
    contacts: { email: 'reader@example.com' },
    consent: true,
  })

  assert.equal(result.valid, false)
  assert.equal(result.errors.telegram, undefined)
  assert.equal(result.errors.sms, 'Укажите телефон для SMS')
})
