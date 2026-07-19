import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildFavoriteHtml,
  buildHeaderAuthHtml,
  buildPushHtml,
  buildRatingHtml,
  buildReactionsHtml,
} from './pe-islands'

describe('auth-gated PE islands for dynamic pages', () => {
  it('reactions island talks to Supabase REST and keeps a typed script', () => {
    const html = buildReactionsHtml('idealnyy-borshch')
    assert.match(html, /data-dynamic-widget="reactions"/)
    assert.match(html, /Полезно/)
    assert.match(html, /Нравится/)
    assert.match(html, /api\.1001sovet\.ru\/rest\/v1/)
    assert.match(html, /\/reactions/)
    assert.match(html, /peGetSession/)
    assert.match(html, /idealnyy-borshch/)
    assert.match(html, /<script type="text\/javascript">/)
    assert.match(html, /Войдите/)
  })

  it('rating island upserts on article_slug,user_id and loads aggregate', () => {
    const html = buildRatingHtml('test-article')
    assert.match(html, /data-dynamic-widget="rating"/)
    assert.match(html, /Оцените статью/)
    assert.match(html, /on_conflict=article_slug,user_id/)
    assert.match(html, /\/ratings/)
    assert.match(html, /resolution=merge-duplicates/)
    assert.match(html, /test-article/)
    assert.match(html, /<script type="text\/javascript">/)
  })

  it('favorite island uses saved_articles upsert/delete and localStorage', () => {
    const html = buildFavoriteHtml('my-slug')
    assert.match(html, /data-dynamic-widget="favorite"/)
    assert.match(html, /Добавить в избранное/)
    assert.match(html, /saved_articles/)
    assert.match(html, /on_conflict=user_id,article_slug/)
    assert.match(html, /favorites/)
    assert.match(html, /my-slug/)
    assert.match(html, /<script type="text\/javascript">/)
  })

  it('push island wires subscriptions worker and service worker', () => {
    const html = buildPushHtml('ekonomiya')
    assert.match(html, /data-dynamic-widget="push"/)
    assert.match(html, /Уведомлять о новых статьях/)
    assert.match(html, /sovetydoma-subscriptions\.filippmiller\.workers\.dev/)
    assert.match(html, /\/push\/subscribe/)
    assert.match(html, /\/push\/unsubscribe/)
    assert.match(html, /\/sw\.js/)
    assert.match(html, /ekonomiya/)
    assert.match(html, /<script type="text\/javascript">/)
  })

  it('header auth island reflects the session and links to the cabinet', () => {
    const html = buildHeaderAuthHtml()
    assert.match(html, /<script type="text\/javascript">/)
    assert.match(html, /Войти или зарегистрироваться/) // targets the header button
    assert.match(html, /\/moy-kabinet\//)
    assert.match(html, /-auth-token/) // reads the GoTrue session
  })

  it('escapes category/slug into HTML attributes safely', () => {
    const html = buildPushHtml('a"onclick="alert(1)')
    assert.doesNotMatch(html, /data-category="a"onclick="/)
    assert.match(html, /&quot;/)
  })

  // Guardrail: every emitted inline script must be syntactically valid JS.
  // A stray token (e.g. a `;` inside an object literal) silently breaks the
  // island on ~1700 dynamic pages AND pollutes the console. Compile each
  // script body with `new Function` (compiles, does not execute).
  it('every emitted inline script parses as valid JavaScript', () => {
    const htmls: Array<[string, string]> = [
      ['reactions', buildReactionsHtml('idealnyy-borshch')],
      ['rating', buildRatingHtml('idealnyy-borshch')],
      ['favorite', buildFavoriteHtml('idealnyy-borshch')],
      ['push', buildPushHtml('kulinaria')],
      ['headerAuth', buildHeaderAuthHtml()],
    ]
    const re = /<script type="text\/javascript">([\s\S]*?)<\/script>/g
    for (const [name, html] of htmls) {
      let m: RegExpExecArray | null
      let count = 0
      while ((m = re.exec(html)) !== null) {
        count += 1
        const body = m[1]
        assert.doesNotThrow(() => {
          // eslint-disable-next-line no-new-func
          new Function(body)
        }, `${name} inline script #${count} must be valid JS`)
      }
      assert.ok(count >= 1, `${name} should emit at least one inline script`)
    }
  })
})
