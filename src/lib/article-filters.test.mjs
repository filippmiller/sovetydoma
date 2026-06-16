import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  parseTimeMinutes,
  parseCostRubles,
  matchesDifficulty,
  matchesTime,
  matchesCost,
} from './article-filters.mjs'

function article(overrides) {
  return {
    title: 'Title',
    slug: 'title',
    category: 'dom-i-uborka',
    tags: [],
    wordCount: 500,
    description: 'Desc',
    date: '2026-06-01',
    ...overrides,
  }
}

describe('parseTimeMinutes', () => {
  it('parses minutes', () => {
    assert.strictEqual(parseTimeMinutes('15 минут'), 15)
  })
  it('parses hours', () => {
    assert.strictEqual(parseTimeMinutes('2 часа'), 120)
  })
  it('parses hour ranges', () => {
    assert.strictEqual(parseTimeMinutes('2–3 часа'), 150)
  })
  it('returns null for missing value', () => {
    assert.strictEqual(parseTimeMinutes(undefined), null)
  })
})

describe('parseCostRubles', () => {
  it('parses free', () => {
    assert.strictEqual(parseCostRubles('бесплатно'), 0)
  })
  it('parses approximate cost', () => {
    assert.strictEqual(parseCostRubles('~300 ₽'), 300)
  })
  it('parses spaced thousands', () => {
    assert.strictEqual(parseCostRubles('1 500 ₽'), 1500)
  })
})

describe('matchesDifficulty', () => {
  it('matches exact difficulty', () => {
    assert.strictEqual(matchesDifficulty(article({ difficulty: 'Легко' }), 'Легко'), true)
  })
  it('allows all when filter is empty', () => {
    assert.strictEqual(matchesDifficulty(article({ difficulty: 'Сложно' }), ''), true)
  })
})

describe('matchesTime', () => {
  it('filters short tasks', () => {
    assert.strictEqual(matchesTime(article({ time: '10 минут' }), 'short'), true)
    assert.strictEqual(matchesTime(article({ time: '1 час' }), 'short'), false)
  })
  it('treats missing time as no match', () => {
    assert.strictEqual(matchesTime(article({}), 'short'), false)
  })
})

describe('matchesCost', () => {
  it('filters free items', () => {
    assert.strictEqual(matchesCost(article({ cost: 'бесплатно' }), 'free'), true)
    assert.strictEqual(matchesCost(article({ cost: '300 ₽' }), 'free'), false)
  })
})
