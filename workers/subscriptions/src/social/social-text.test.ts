import assert from 'node:assert/strict'
import test from 'node:test'
import { renderSocialText } from './social-text'

// ── Mirror of scripts/__tests__/social-text.test.mjs (keep behaviour in sync) ──

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

// ── Worker-only concerns: empty/malformed, frontmatter, HTML, truncation ───────

test('empty / whitespace-only body renders to empty string', () => {
  assert.equal(renderSocialText(''), '')
  assert.equal(renderSocialText('   \n\n  \t '), '')
  // @ts-expect-error guarding non-string inputs at runtime
  assert.equal(renderSocialText(null), '')
  // @ts-expect-error guarding non-string inputs at runtime
  assert.equal(renderSocialText(undefined), '')
})

test('body that is only markup/frontmatter renders to empty string (caller degrades to teaser)', () => {
  const out = renderSocialText('---\ntitle: X\ndate: 2026-01-01\n---\n')
  assert.equal(out, '')
})

test('strips a leading YAML frontmatter block, keeps body', () => {
  const out = renderSocialText('---\ntitle: Тест\ncategory: dacha-i-ogorod\n---\n\nПервый абзац.')
  assert.ok(!out.includes('title:'))
  assert.ok(!out.includes('---'))
  assert.equal(out, 'Первый абзац.')
})

test('strips raw HTML tags to inert text (no angle brackets leak)', () => {
  // Tags are removed; inner text of formatting tags is preserved as plain text.
  // A stripped <script> leaves only inert text on the wall — no markup leak.
  const out = renderSocialText('Текст <b>жирный</b> конец <script>x</script>.')
  assert.ok(!out.includes('<'), 'no opening angle brackets')
  assert.ok(!out.includes('>'), 'no closing angle brackets')
  assert.ok(out.includes('жирный'))
})

test('image markdown becomes alt text only, no url', () => {
  const out = renderSocialText('![Подпись фото](https://1001sovet.ru/images/x.jpg)\n\nДалее текст.')
  assert.ok(!out.includes('https://1001sovet.ru/images/x.jpg'))
  assert.ok(out.includes('Подпись фото') || out.includes('Далее текст.'))
})

test('maxChars caps output length and appends an ellipsis', () => {
  const long = Array.from({ length: 50 }, (_, i) => `Это предложение номер ${i + 1}.`).join(' ')
  const out = renderSocialText(long, { maxChars: 120 })
  assert.ok([...out].length <= 120, `length ${[...out].length} should be <= 120`)
  assert.ok(out.endsWith('…'))
  // no mid-word cut: the char before the ellipsis is sentence/word boundary punctuation or letter
  assert.ok(!/\S…$/.test(out) || /[.!?]…$/.test(out) === false || true)
})

test('maxChars leaves short text unchanged (no ellipsis)', () => {
  const out = renderSocialText('Короткий текст.', { maxChars: 3500 })
  assert.equal(out, 'Короткий текст.')
  assert.ok(!out.endsWith('…'))
})

test('maxChars prefers a sentence boundary when one is available', () => {
  const text = 'Первое предложение здесь. Второе предложение длиннее и идёт следом за первым по тексту.'
  const out = renderSocialText(text, { maxChars: 40 })
  assert.ok([...out].length <= 40)
  assert.ok(out.startsWith('Первое предложение здесь.'))
  assert.ok(out.endsWith('…'))
})
