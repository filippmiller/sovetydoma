import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildCommentsHtml, buildQuestionsHtml } from './ugc'

describe('dynamic UGC server rendering', () => {
  it('renders honest question empty and unavailable states without a loading placeholder', () => {
    assert.match(buildQuestionsHtml([], 'test-article'), /Пока вопросов нет/)
    assert.match(buildQuestionsHtml(null, 'test-article'), /временно недоступны/)
    assert.doesNotMatch(buildQuestionsHtml([], 'test-article'), /Загрузка/)
  })

  it('always renders a working ask-question form wired to the worker', () => {
    for (const rows of [null, [], [{ slug: 's', title: 't', answers_count: 0 }]] as const) {
      const html = buildQuestionsHtml(rows, 'idealnyy-borshch')
      assert.match(html, /Есть вопрос по теме\?/)
      assert.match(html, /\/article-question/)
      // The submit script carries a type so the renderer's typeless-inline strip keeps it.
      assert.match(html, /<script type="text\/javascript">/)
      // The article slug is passed to the POST body.
      assert.match(html, /idealnyy-borshch/)
    }
  })

  it('escapes question content and links to the indexable question page', () => {
    const html = buildQuestionsHtml([{ slug: 'bezopasnyj-vopros', title: '<script>alert(1)</script>', answers_count: 2 }], 'a')
    assert.match(html, /\/q\/bezopasnyj-vopros\//)
    assert.match(html, /2 ответа/)
    // User content is escaped — no executable script injected from the title.
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
    assert.match(html, /&lt;script&gt;/)
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
