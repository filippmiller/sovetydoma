// gen-drafts-kimi.mjs — draft full Russian articles with the Kimi CLI (Windows, print mode).
// Image-first: only drafts rows with image_status in (generated,approved) and text_status='idea'.
// Captures the article body straight from Kimi stdout (no file roundtrip). Parallelized.
//
// Requires: `kimi` CLI on PATH (Windows pip install) with credentials in ~/.kimi.
// Usage:
//   node scripts/matrix/gen-drafts-kimi.mjs --limit 5                 (smoke)
//   node scripts/matrix/gen-drafts-kimi.mjs --limit 500 --concurrency 4
//   node scripts/matrix/gen-drafts-kimi.mjs --verticals dacha,recepty --limit 100
//   node scripts/matrix/gen-drafts-kimi.mjs --slug zapah-iz-obuvi    (single row)
import { spawn } from 'node:child_process'
import helpers from './lib.mjs'

const DOMAIN = '1001sovet.ru'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const limit = parseInt(arg('--limit', '50'), 10)
const concurrency = Math.max(1, parseInt(arg('--concurrency', '4'), 10))
const minWords = parseInt(arg('--min-words', '250'), 10)
const onlySlug = arg('--slug', '')
const verticals = (arg('--verticals', '') || '').split(',').filter(Boolean)
const REPO = process.cwd()

const sb = helpers.getServiceClient()

async function pick() {
  if (onlySlug) {
    const { data, error } = await sb.from('content_matrix')
      .select('id,slug,title,description,category,frontmatter')
      .eq('domain', DOMAIN).eq('slug', onlySlug).limit(1)
    if (error) throw new Error(error.message)
    return data || []
  }
  let q = sb.from('content_matrix')
    .select('id,slug,title,description,category,frontmatter')
    .eq('domain', DOMAIN).eq('disposition', 'active')
    .eq('text_status', 'idea').in('image_status', ['generated', 'approved'])
    .order('priority', { ascending: false }).order('image_generated_at', { ascending: true })
  if (verticals.length) q = q.in('vertical', verticals)
  const { data, error } = await q.limit(limit)
  if (error) throw new Error(error.message)
  return data || []
}

function buildPrompt(row) {
  const wc = row.frontmatter?.target_wc || 800
  return `Напиши ПОЛНУЮ практичную статью на русском языке для портала бытовых советов SovetyDoma (1001sovet.ru).

ЗАГОЛОВОК: ${row.title}
О ЧЁМ: ${row.description || ''}
КАТЕГОРИЯ: ${row.category}
ПРИМЕРНЫЙ ОБЪЁМ: ${wc} слов.

ТРЕБОВАНИЯ К СОДЕРЖАНИЮ:
- Выведи ТОЛЬКО тело статьи в формате Markdown. БЕЗ frontmatter, БЕЗ заголовка H1, без комментариев, без \`\`\`.
- Короткий вводный абзац (1-2 предложения), затем несколько подзаголовков ## с практичным содержанием.
- Списки, конкретные числа, шаги, пропорции, сроки — где уместно.
- НЕ ищи в интернете, не читай репозиторий, не запускай инструменты — просто напиши текст и заверши.

СТИЛЬ — ПИШИ КАК ЖИВОЙ ЧЕЛОВЕК, НЕ КАК НЕЙРОСЕТЬ:
- Разнообразь длину предложений: короткие и длинные вперемешку. Не делай все предложения одинаковыми.
- ЗАПРЕЩЕНЫ штампы: «важно отметить», «стоит учитывать», «несомненно», «актуально», «в современном мире», «давайте рассмотрим», «не забудьте», «в заключение можно сказать».
- ЗАПРЕЩЕНЫ тройные перечисления ради красоты: «быстро, удобно и эффективно» — выбери одно нужное слово.
- ЗАПРЕЩЕНО раздувать значимость: «это поможет вам», «это очень важно», «это сыграет ключевую роль» — просто дай факт или совет.
- Избегай пассивного залога там, где можно сказать активно.
- Конкретика вместо расплывчатости: «подожди 10 минут» вместо «подождите некоторое время».
- Начни сразу с пользы — без вступлений о том, «как важна эта тема».
- ЗАПРЕЩЕНО использовать иероглифы, китайские, японские, корейские или любые не-кириллические/не-латинские символы. Только русский текст.`
}

function runKimi(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn('kimi', ['--print', '--input-format', 'text', '--output-format', 'text', '--final-message-only', '-w', REPO], {
      shell: true, windowsHide: true,
      // Force Python (Kimi CLI) to read stdin / write stdout as UTF-8 — otherwise
      // Cyrillic piped via stdin is mangled into surrogates on Windows code pages.
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    })
    let out = Buffer.alloc(0), err = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout')) }, 360000)
    child.stdout.on('data', (d) => { out = Buffer.concat([out, d]) })
    child.stderr.on('data', (d) => { err += d.toString() })
    child.on('error', (e) => { clearTimeout(timer); reject(e) })
    child.on('close', (code) => {
      clearTimeout(timer)
      const text = out.toString('utf8')
      if (code !== 0 && !text.trim()) return reject(new Error(`exit ${code}: ${err.slice(0, 200)}`))
      resolve(text)
    })
    child.stdin.write(Buffer.from(prompt, 'utf8'))
    child.stdin.end()
  })
}

function clean(raw) {
  let body = String(raw || '').replace(/^﻿/, '').trim()
  // strip a leading fenced block wrapper if the model added one
  body = body.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/i, '')
  // drop a stray H1
  body = body.replace(/^#\s+.*\n+/, '')
  return body.trim()
}

async function draftRow(row) {
  const raw = await runKimi(buildPrompt(row))
  const body = clean(raw)
  const w = helpers.wordCount(body)
  if (w < minWords) throw new Error(`too short (${w}w)`)
  if (helpers.hasMojibake(body)) throw new Error('mojibake detected')
  // Reject if Kimi leaked CJK characters into the Russian text
  const cjkChars = [...body].filter(c => { const cp = c.codePointAt(0); return cp >= 0x4E00 && cp <= 0x9FFF || cp >= 0x3000 && cp <= 0x303F })
  if (cjkChars.length > 0) throw new Error(`foreign-script: CJK chars detected (${[...new Set(cjkChars)].slice(0,5).join('')})`)
  await sb.from('content_matrix').update({
    body_md: body, word_count: w, text_status: 'draft',
    last_filled_stage: 'draft', review_agent: 'kimi-human',
  }).eq('id', row.id)
  await sb.from('content_matrix_events').insert({
    matrix_id: row.id, axis: 'text', from_value: 'idea', to_value: 'draft',
    agent: 'kimi-draft', notes: `${w} words`,
  })
  return w
}

async function runPool(rows) {
  let ok = 0, fail = 0, idx = 0
  async function worker(wid) {
    while (idx < rows.length) {
      const row = rows[idx++]
      const n = idx
      try {
        const w = await draftRow(row)
        ok++
        console.log(`  [w${wid}] (${n}/${rows.length}) ${row.slug} OK (${w}w)`)
      } catch (e) {
        fail++
        console.log(`  [w${wid}] (${n}/${rows.length}) ${row.slug} FAILED: ${e.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)))
  return { ok, fail }
}

async function main() {
  const rows = await pick()
  console.log(`Picked ${rows.length} image-ready row(s) to draft with Kimi. concurrency=${concurrency}`)
  if (!rows.length) return
  const { ok, fail } = await runPool(rows)
  const { count } = await sb.from('content_matrix')
    .select('*', { count: 'exact', head: true }).eq('domain', DOMAIN).eq('text_status', 'draft')
  console.log(`Done. drafted=${ok} failed=${fail} | total drafts now: ${count}`)
}
main().catch((e) => { console.error('fatal:', e); process.exit(1) })
