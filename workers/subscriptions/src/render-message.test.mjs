import assert from 'node:assert/strict'
import test from 'node:test'
import { renderDigestMessage } from './render-message.mjs'

const articles = [
  {
    article_slug: 'salat',
    title: 'Салат <быстрый>',
    description: 'Описание',
    canonical_path: '/kulinaria/salat/',
  },
]

test('renders email-safe text and html digest', () => {
  const message = renderDigestMessage({
    channel: 'email',
    articles,
    siteUrl: 'https://1001sovet.ru',
    manageUrl: 'https://1001sovet.ru/podpiski/?manage_token=x',
  })

  assert.equal(message.subject, 'Новая статья по вашей подписке')
  assert.match(message.text, /https:\/\/1001sovet\.ru\/kulinaria\/salat\//)
  assert.match(message.html, /&lt;быстрый&gt;/)
})

test('rejects unsafe article paths in digest links', () => {
  const message = renderDigestMessage({
    channel: 'email',
    articles: [{
      article_slug: 'bad',
      title: 'Bad',
      description: 'x',
      canonical_path: 'https://evil.example/phish',
    }],
    siteUrl: 'https://1001sovet.ru',
    manageUrl: 'javascript:alert(1)',
  })

  assert.match(message.text, /https:\/\/1001sovet\.ru\//)
  assert.doesNotMatch(message.text, /evil\.example/)
  assert.match(message.html, /https:\/\/1001sovet\.ru\/podpiski\//)
})

test('renders short SMS digest', () => {
  const message = renderDigestMessage({
    channel: 'sms',
    articles,
    siteUrl: 'https://1001sovet.ru',
    manageUrl: 'https://1001sovet.ru/podpiski/',
  })

  assert.equal(message.html, undefined)
  assert.match(message.text, /Отписка:/)
  assert(message.text.length < 240)
})
