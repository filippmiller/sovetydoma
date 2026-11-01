import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mdToHtml } from './md'

describe('mdToHtml', () => {
  it('demotes a body # heading to h2 instead of looping forever', () => {
    assert.equal(mdToHtml('# Белок из чечевицы\n\nТекст.'), '<h2 id="белок-из-чечевицы">Белок из чечевицы</h2>\n<p>Текст.</p>\n')
  })

  it('keeps ## and ### and collapses deeper headings to h3', () => {
    assert.equal(mdToHtml('## Два\n### Три\n#### Четыре'), '<h2 id="два">Два</h2>\n<h3 id="три">Три</h3>\n<h3 id="четыре">Четыре</h3>\n')
  })

  it('always advances on a line no block rule consumes', () => {
    assert.equal(mdToHtml('#\n##\nабзац'), '<p>#</p>\n<p>##</p>\n<p>абзац</p>\n')
  })
})
