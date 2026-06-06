import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildVkArticlePost,
  findArticleRecord,
  MAX_VK_MESSAGE_CHARS,
  publishArticleToVk,
  validateVkConfig,
} from './vk'
import type { Env } from '../types'

const baseEnv: Env = {
  PUBLIC_SITE_URL: 'https://1001sovet.ru',
  VK_ACCESS_TOKEN: 'test-token',
  VK_GROUP_ID: '123456',
  VK_API_VERSION: '5.199',
}

test('validateVkConfig throws when token missing', () => {
  assert.throws(() => validateVkConfig({ ...baseEnv, VK_ACCESS_TOKEN: undefined }), /vk_access_token_not_configured/)
})

test('validateVkConfig throws when group id missing', () => {
  assert.throws(() => validateVkConfig({ ...baseEnv, VK_GROUP_ID: undefined }), /vk_group_id_not_configured/)
})

test('validateVkConfig returns config', () => {
  const config = validateVkConfig(baseEnv)
  assert.equal(config.accessToken, 'test-token')
  assert.equal(config.groupId, '123456')
  assert.equal(config.apiVersion, '5.199')
})

test('findArticleRecord returns existing article', () => {
  const record = findArticleRecord('agrovolokno-pod-klubniku-vesnoy')
  assert.ok(record)
  assert.equal(record?.article_slug, 'agrovolokno-pod-klubniku-vesnoy')
  assert.ok(record?.plain_text.length > 0)
})

test('findArticleRecord returns undefined for unknown slug', () => {
  const record = findArticleRecord('nonexistent-article-12345')
  assert.equal(record, undefined)
})

test('buildVkArticlePost includes title, text, source url and category', () => {
  const record = findArticleRecord('agrovolokno-pod-klubniku-vesnoy')!
  const result = buildVkArticlePost({ record, siteUrl: 'https://1001sovet.ru' })
  assert.ok(result.message.includes(record.title))
  assert.ok(result.message.includes(record.plain_text.slice(0, 100)))
  assert.ok(result.message.includes('Источник:'))
  assert.ok(result.message.includes('https://1001sovet.ru/dacha-i-ogorod/agrovolokno-pod-klubniku-vesnoy/'))
  assert.ok(result.message.includes('СоветыДома'))
  assert.ok(result.message.includes('dacha-i-ogorod'))
  assert.ok(result.imageUrl.includes('.jpg'))
  assert.equal(result.messageLength, [...result.message].length)
})

test('buildVkArticlePost throws message_too_long when exceeding limit', () => {
  const record = findArticleRecord('agrovolokno-pod-klubniku-vesnoy')!
  const longText = 'x'.repeat(MAX_VK_MESSAGE_CHARS + 100)
  assert.throws(() => {
    buildVkArticlePost({ record: { ...record, title: longText, plain_text: '' }, siteUrl: 'https://1001sovet.ru' })
  }, (err: unknown) => {
    return (err as Error & { code?: string }).code === 'message_too_long'
  })
})

test('publishArticleToVk returns article_not_found for unknown slug', async () => {
  const result = await publishArticleToVk(baseEnv, 'nonexistent-article-12345', { dryRun: true })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'article_not_found')
})

test('publishArticleToVk dry-run succeeds for known article', async () => {
  const result = await publishArticleToVk(baseEnv, 'agrovolokno-pod-klubniku-vesnoy', { dryRun: true })
  assert.equal(result.ok, true)
  assert.equal(result.dryRun, true)
  assert.ok(result.bodyHash)
  assert.ok(result.messageLength > 0)
})

test('publishArticleToVk returns provider_unconfigured when env missing', async () => {
  const result = await publishArticleToVk({ PUBLIC_SITE_URL: 'https://1001sovet.ru' }, 'agrovolokno-pod-klubniku-vesnoy', { dryRun: true })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'provider_unconfigured')
  assert.ok(result.error?.includes('vk_access_token_not_configured') || result.error?.includes('vk_group_id_not_configured'))
})
