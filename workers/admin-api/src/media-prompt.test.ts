import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildImagePrompt,
  makeStorageKey,
  publicImageUrl,
  sanitizeImagePrompt,
} from './media-prompt'

describe('media-prompt', () => {
  it('strips people/hands subjects from prompts', () => {
    const out = sanitizeImagePrompt('Close-up of hands washing a glass jar')
    assert.match(out.toLowerCase(), /glass jar/)
    assert.doesNotMatch(out.toLowerCase(), /\bhands?\b/)
  })

  it('buildImagePrompt appends no-people style suffix', () => {
    const p = buildImagePrompt('fresh cucumber salad', 'Салат', 'kulinaria')
    assert.match(p, /No people/)
    assert.match(p, /Photorealistic/)
  })

  it('makeStorageKey is immutable-versioned and URL-safe', () => {
    const key = makeStorageKey('Rulet-Lavash!!', 3, 'Ab12CD')
    assert.equal(key, 'rulet-lavash-v3-ab12cd.jpg')
    assert.match(key, /^[a-z0-9][a-z0-9-]*\.(jpe?g|png|webp)$/i)
  })

  it('publicImageUrl joins site + /images/', () => {
    assert.equal(
      publicImageUrl('https://1001sovet.ru/', 'foo-v2-abc.jpg'),
      'https://1001sovet.ru/images/foo-v2-abc.jpg',
    )
  })
})
