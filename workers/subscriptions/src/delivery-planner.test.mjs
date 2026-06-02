import assert from 'node:assert/strict'
import test from 'node:test'
import { getDeliveryPeriod, planDigestArticles } from './delivery-planner.mjs'

const articles = [
  { article_slug: 'old', category_slug: 'kulinaria', title: 'Old', canonical_path: '/kulinaria/old/', first_seen_at: '2026-05-01T00:00:00.000Z' },
  { article_slug: 'a', category_slug: 'kulinaria', title: 'A', canonical_path: '/kulinaria/a/', first_seen_at: '2026-06-02T00:00:00.000Z' },
  { article_slug: 'b', category_slug: 'kulinaria', title: 'B', canonical_path: '/kulinaria/b/', first_seen_at: '2026-06-03T00:00:00.000Z' },
  { article_slug: 'c', category_slug: 'dom-i-uborka', title: 'C', canonical_path: '/dom-i-uborka/c/', first_seen_at: '2026-06-04T00:00:00.000Z' },
  { article_slug: 'd', category_slug: 'rybalka', title: 'D', canonical_path: '/rybalka/d/', first_seen_at: '2026-06-05T00:00:00.000Z' },
]

test('daily_one returns one article across subscribed categories', () => {
  const planned = planDigestArticles({
    frequency: 'daily_one',
    subscribedCategories: ['kulinaria', 'dom-i-uborka'],
    articles,
    deliveredSlugs: [],
    confirmedAt: '2026-06-01T00:00:00.000Z',
    now: new Date('2026-06-06T00:00:00.000Z'),
  })

  assert.deepEqual(planned.map((article) => article.article_slug), ['c'])
})

test('daily_digest_3 skips old and already delivered articles', () => {
  const planned = planDigestArticles({
    frequency: 'daily_digest_3',
    subscribedCategories: ['kulinaria', 'dom-i-uborka'],
    articles,
    deliveredSlugs: ['b'],
    confirmedAt: '2026-06-01T00:00:00.000Z',
    now: new Date('2026-06-06T00:00:00.000Z'),
  })

  assert.deepEqual(planned.map((article) => article.article_slug), ['c', 'a'])
})

test('skips backlog older than 14 days', () => {
  const planned = planDigestArticles({
    frequency: 'weekly_digest_7',
    subscribedCategories: ['kulinaria'],
    articles,
    deliveredSlugs: [],
    confirmedAt: '2026-04-01T00:00:00.000Z',
    now: new Date('2026-06-06T00:00:00.000Z'),
  })

  assert.deepEqual(planned.map((article) => article.article_slug), ['b', 'a'])
})

test('delivery period is stable for day and week frequencies', () => {
  assert.equal(getDeliveryPeriod('daily_one', new Date('2026-06-02T12:00:00.000Z')), '2026-06-02')
  assert.match(getDeliveryPeriod('weekly_digest_3', new Date('2026-06-02T12:00:00.000Z')), /^2026-W\d{2}$/)
})
