import assert from 'node:assert/strict'
import test from 'node:test'
import { renderSocialText } from '../lib/social-text.mjs'

test('headings become emoji-prefixed, no raw hashes', () => {
  const out = renderSocialText('## Какое агроволокно выбрать\n\nТекст абзаца.')
  assert.ok(!out.includes('##'), 'no raw markdown hashes')
  assert.ok(out.includes('🔹 Какое агроволокно выбрать'))
  assert.ok(out.includes('\n\nТекст абзаца.'))
})

test('bullet lists get a bullet character', () => {
  const out = renderSocialText('Вступление.\n\n- Первый пункт\n- Второй пункт')
  assert.ok(out.includes('• Первый пункт'))
  assert.ok(out.includes('• Второй пункт'))
  // items stay on adjacent lines, no blank line between them
  assert.ok(out.includes('• Первый пункт\n• Второй пункт'))
})

test('numbered lists keep numbering', () => {
  const out = renderSocialText('1. Шаг один\n2. Шаг два')
  assert.ok(out.includes('1. Шаг один'))
  assert.ok(out.includes('2. Шаг два'))
})

test('blank line separates paragraphs', () => {
  const out = renderSocialText('Первый абзац.\n\nВторой абзац.')
  assert.equal(out, 'Первый абзац.\n\nВторой абзац.')
})

test('strips bold/italic/link/code markers to plain text', () => {
  const out = renderSocialText('Это **жирный** и _курсив_ и `код` и [ссылка](https://x.ru).')
  assert.ok(!out.includes('**'))
  assert.ok(!out.includes('`'))
  assert.ok(out.includes('жирный'))
  assert.ok(out.includes('курсив'))
  assert.ok(out.includes('ссылка'))
  assert.ok(!out.includes('https://x.ru'))
})

test('drops MDX imports and JSX', () => {
  const out = renderSocialText('import X from "./x"\n\n<Callout>hi</Callout>\n\nОбычный текст.')
  assert.equal(out, 'Обычный текст.')
})

test('no triple blank lines', () => {
  const out = renderSocialText('А.\n\n\n\n\nБ.')
  assert.ok(!out.includes('\n\n\n'))
})
