import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildCommentsHtml, buildQuestionsHtml } from './ugc'

describe('dynamic UGC server rendering', () => {
  it('renders honest question empty and unavailable states without a loading placeholder', () => {
    assert.match(buildQuestionsHtml([]), /Пока вопросов нет/)
    assert.match(buildQuestionsHtml(null), /временно недоступны/)
    assert.doesNotMatch(buildQuestionsHtml([]), /Загрузка/)
  })

  it('escapes question content and links to the indexable question page', () => {
    const html = buildQuestionsHtml([{ slug: 'bezopasnyj-vopros', title: '<script>alert(1)</script>', answers_count: 2 }])
    assert.match(html, /\/q\/bezopasnyj-vopros\//)
    assert.match(html, /2 ответа/)
    assert.doesNotMatch(html, /<script>/)
  })

  it('renders comment counts, replies and escaped reader content', () => {
    const html = buildCommentsHtml([
      { id: '1', content: 'Полезно & понятно', parent_id: null, created_at: '2026-07-18T00:00:00Z', profiles: { display_name: 'Анна' } },
      { id: '2', content: '<b>Спасибо</b>', parent_id: '1', created_at: '2026-07-18T01:00:00Z', profiles: null },
    ])
    assert.match(html, />2<\/span>/)
    assert.match(html, /Анна/)
    assert.match(html, /Читатель/)
    assert.match(html, /Полезно &amp; понятно/)
    assert.doesNotMatch(html, /<b>Спасибо<\/b>/)
  })
})
