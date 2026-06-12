// humanize-articles.mjs — run published articles through Kimi to remove AI artifacts.
// Rewrites body_md in-place in the DB. Marks processed rows with review_agent='kimi-human-v2'.
// Safe to re-run: skips already processed rows unless --force.
//
// Usage:
//   node scripts/matrix/humanize-articles.mjs --dry-run --limit 5        (smoke test)
//   node scripts/matrix/humanize-articles.mjs --category dacha-i-ogorod --limit 50
//   node scripts/matrix/humanize-articles.mjs --limit 100 --concurrency 4
//   node scripts/matrix/humanize-articles.mjs --slugs a,b,c              (specific articles)
import { spawn } from 'node:child_process'
import helpers from './lib.mjs'

const DOMAIN = '1001sovet.ru'
const AGENT_TAG = 'kimi-human-v2'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const has = (k) => process.argv.includes(k)

const limit = parseInt(arg('--limit', '20'), 10)
const concurrency = Math.max(1, parseInt(arg('--concurrency', '3'), 10))
const category = arg('--category', '')
const slugsArg = arg('--slugs', '')
const dryRun = has('--dry-run')
const force = has('--force') // re-process even if already tagged kimi-human-v2
const REPO = process.cwd()

const sb = helpers.getServiceClient()

async function pick() {
  const slugFilter = slugsArg ? slugsArg.split(',').map(s => s.trim()).filter(Boolean) : []

  let q = sb.from('content_matrix')
    .select('id,slug,title,body_md,category,word_count,review_agent')
    .eq('domain', DOMAIN)
    .eq('disposition', 'active')
    .eq('text_status', 'published')
    .not('body_md', 'is', null)
    .order('updated_at', { ascending: true })

  if (category) q = q.eq('category', category)
  if (slugFilter.length) q = q.in('slug', slugFilter)
  if (!force) q = q.neq('review_agent', AGENT_TAG) // skip already processed

  const { data, error } = await q.limit(limit)
  if (error) throw new Error(error.message)
  return data || []
}

function buildPrompt(row) {
  return `Ты редактор портала бытовых советов на русском языке. Твоя задача — переписать статью так, чтобы она звучала как живой человек, а не нейросеть. Сохрани все факты, структуру разделов и форматирование Markdown.

ЗАГОЛОВОК СТАТЬИ: ${row.title}

ПРАВИЛА ПЕРЕПИСЫВАНИЯ:
- Разнообразь длину предложений: вперемешку короткие и длинные.
- УБЕРИ штампы: «важно отметить», «стоит учитывать», «несомненно», «актуально», «в современном мире», «давайте рассмотрим», «не забудьте», «в заключение можно сказать», «это поможет вам», «это очень важно».
- УБЕРИ тройные перечисления красоты ради: «быстро, удобно и эффективно» → выбери одно слово.
- УБЕРИ пассивный залог там, где можно сказать активно.
- Конкретика: «10 минут» вместо «некоторое время», «раз в неделю» вместо «регулярно».
- Не начинай с вступления о важности темы — сразу к делу.
- Сохрани все цифры, сроки, пропорции, названия продуктов/инструментов — не выдумывай.
- Выведи ТОЛЬКО переписанное тело статьи в формате Markdown (без H1, без frontmatter, без комментариев, без \`\`\`).
- ЗАПРЕЩЕНО использовать иероглифы, китайские, японские, корейские символы. Только русский текст.

ИСХОДНЫЙ ТЕКСТ:
${row.body_md}`
}

function runKimi(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn('kimi', ['--print', '--input-format', 'text', '--output-format', 'text', '--final-message-only', '-w', REPO], {
      shell: true, windowsHide: true,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    })
    let out = Buffer.alloc(0), err = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout')) }, 480000)
    child.stdout.on('data', d => { out = Buffer.concat([out, d]) })
    child.stderr.on('data', d => { err += d.toString() })
    child.on('error', e => { clearTimeout(timer); reject(e) })
    child.on('close', code => {
      clearTimeout(timer)
      const text = out.toString('utf8')
      if (code !== 0 && !text.trim()) return reject(new Error(`exit ${code}: ${err.slice(0, 200)}`))
      resolve(text)
    })
    child.stdin.write(Buffer.from(prompt, 'utf8'))
    child.stdin.end()
  })
}

function cleanBody(raw) {
  let body = String(raw || '').replace(/^﻿/, '').trim()
  body = body.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/i, '')
  body = body.replace(/^#\s+.*\n+/, '')
  return body.trim()
}

function hasCJK(text) {
  return [...text].some(c => { const cp = c.codePointAt(0); return (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3000 && cp <= 0x303F) })
}

async function processRow(row) {
  const raw = await runKimi(buildPrompt(row))
  const body = cleanBody(raw)
  const w = helpers.wordCount(body)

  if (w < 200) throw new Error(`too short after humanize (${w}w)`)
  if (helpers.hasMojibake(body)) throw new Error('mojibake in output')
  if (hasCJK(body)) throw new Error('CJK chars in output')

  // Sanity: output should be roughly similar length to input (±40%)
  const origW = row.word_count || helpers.wordCount(row.body_md)
  if (w < origW * 0.6 || w > origW * 1.4) throw new Error(`word count drift: ${origW}→${w}`)

  if (!dryRun) {
    const { error } = await sb.from('content_matrix')
      .update({ body_md: body, word_count: w, review_agent: AGENT_TAG, review_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) throw new Error(error.message)
  }
  return { slug: row.slug, before: origW, after: w }
}

async function main() {
  const rows = await pick()
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Humanizing ${rows.length} articles (concurrency=${concurrency})`)
  if (!rows.length) { console.log('Nothing to process.'); return }

  let done = 0, failed = 0
  const queue = [...rows]
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const row = queue.shift()
      try {
        const res = await processRow(row)
        done++
        console.log(`  ✓ ${res.slug} (${res.before}w→${res.after}w)`)
      } catch (e) {
        failed++
        console.log(`  ✗ ${row.slug}: ${e.message}`)
      }
    }
  })
  await Promise.all(workers)

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Done. Humanized: ${done}  Failed: ${failed}`)
}
main().catch(e => { console.error('fatal:', e); process.exit(1) })
