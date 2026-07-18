import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildQualityContext,
  checkArticleQuality,
  MIN_WORDS,
} from '../matrix/quality-gate.mjs'

function row(overrides = {}) {
  return {
    slug: 'test-article',
    title: 'Как правильно проверить качество статьи перед публикацией',
    description: 'Подробное описание статьи о проверке качества контента перед тем, как опубликовать материал на сайте.',
    body_md: Array.from({ length: 40 }, (_, i) => `Уникальный абзац номер ${i} с полезным содержанием для читателя сайта советов.`).join('\n\n'),
    word_count: 600,
    image_filename: 'test-article.jpg',
    tags: ['проверка', 'качество'],
    ...overrides,
  }
}

describe('quality gate', () => {
  it('passes a healthy article', () => {
    const { ok, issues } = checkArticleQuality(row(), buildQualityContext([]))
    assert.equal(ok, true)
    assert.deepEqual(issues, [])
  })

  it('blocks too-short articles', () => {
    const { ok, issues } = checkArticleQuality(row({ word_count: MIN_WORDS - 1 }), null)
    assert.equal(ok, false)
    assert.ok(issues.some((i) => i.code === 'too_short' && i.severity === 'block'))
  })

  it('blocks bad title/description lengths', () => {
    const shortTitle = checkArticleQuality(row({ title: 'Коротко' }), null)
    assert.ok(shortTitle.issues.some((i) => i.code === 'title_short'))
    const longDesc = checkArticleQuality(row({ description: 'д'.repeat(200) }), null)
    assert.ok(longDesc.issues.some((i) => i.code === 'desc_long'))
    const shortDesc = checkArticleQuality(row({ description: 'слишком коротко' }), null)
    assert.ok(shortDesc.issues.some((i) => i.code === 'desc_short'))
  })

  it('blocks missing image', () => {
    const { ok, issues } = checkArticleQuality(row({ image_filename: null }), null)
    assert.equal(ok, false)
    assert.ok(issues.some((i) => i.code === 'no_image'))
  })

  it('blocks duplicate titles and descriptions against published context', () => {
    const existing = row({ slug: 'other-article' })
    const ctx = buildQualityContext([existing])
    const dup = checkArticleQuality(row({ slug: 'new-article' }), ctx)
    assert.equal(dup.ok, false)
    assert.ok(dup.issues.some((i) => i.code === 'dup_title'))
    assert.ok(dup.issues.some((i) => i.code === 'dup_description'))
    // The article itself in context must not flag itself
    const self = checkArticleQuality(existing, ctx)
    assert.equal(self.issues.some((i) => i.code === 'dup_title'), false)
  })

  it('blocks boilerplate intros shared by several articles', () => {
    // Intro must exceed the 160-char comparison window so the key is pure boilerplate
    const intro = 'В этом материале мы собрали самые полезные советы для вашего дома и дачи, читайте внимательно и применяйте на практике каждый день. Все рекомендации проверены редакцией и подходят даже для начинающих хозяев без опыта.'
    const ctx = buildQualityContext([
      row({ slug: 'a', body_md: `${intro}\n\nтекст а` }),
      row({ slug: 'b', body_md: `${intro}\n\nтекст б` }),
    ])
    const { ok, issues } = checkArticleQuality(row({ slug: 'c', body_md: `${intro}\n\nтекст в` }), ctx)
    assert.equal(ok, false)
    assert.ok(issues.some((i) => i.code === 'boilerplate_intro'))
  })

  it('warns on risky topics without a disclaimer', () => {
    const risky = row({
      title: 'Как сбить высокое давление таблетками в домашних условиях',
      body_md: 'Лечение давления в домашних условиях. '.repeat(60),
    })
    const noDisclaimer = checkArticleQuality(risky, null)
    assert.ok(noDisclaimer.issues.some((i) => i.code === 'risky_no_disclaimer' && i.severity === 'warn'))
    assert.equal(noDisclaimer.ok, true) // warning, not a block
    const withDisclaimer = checkArticleQuality(row({
      ...risky,
      body_md: `${risky.body_md}\n\nОбратитесь к врачу за точной дозировкой.`,
    }), null)
    assert.equal(withDisclaimer.issues.some((i) => i.code === 'risky_no_disclaimer'), false)
  })

  it('does not flag safe topics', () => {
    const safe = checkArticleQuality(row({ title: 'Как помыть окна без разводов весной' }), null)
    assert.equal(safe.issues.some((i) => i.code === 'risky_no_disclaimer'), false)
  })
})
