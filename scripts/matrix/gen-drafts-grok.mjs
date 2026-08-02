// gen-drafts-grok.mjs — draft full Russian articles with Grok (WSL) for image-ready rows.
// Image-first: only drafts rows with image_status in (generated,approved) and text_status='idea'.
// Usage: node scripts/matrix/gen-drafts-grok.mjs --limit 100 [--verticals dacha,ogorod]
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import helpers from './lib.mjs'

const DOMAIN = '1001sovet.ru'

// House style (2026-08-02, owner request): every article opens with a warm
// greeting and closes with a warm sign-off, rotated so the same pair never
// repeats back-to-back. Mirrors gen-drafts-kimi.mjs — keep both in sync.
const GREETINGS = [
  'Приветствуем вас, дорогие читатели!',
  'Здравствуйте, дорогие друзья!',
  'Приветствуем вас, любимые читатели!',
  'С добрым днём, наши читатели!',
  'Рады снова видеть вас, дорогие друзья!',
  'Здравствуйте, уважаемые читатели!',
  'Добро пожаловать, дорогие гости нашего сайта!',
  'Приветствуем всех, кто заглянул к нам сегодня!',
  'Здравствуйте, наши верные читатели!',
  'Рады приветствовать вас на страницах «1001 совета»!',
]
const FAREWELLS = [
  'С наилучшими пожеланиями, ваша редакция.',
  'С наилучшими пожеланиями, ваша редакция сайта «1001 совет».',
  'Желаем вам всего самого доброго, удачи и хорошего настроения!',
  'Берегите себя и своих близких — до новых встреч!',
  'Желаем вам здоровья, удачи и хорошего урожая!',
  'До новых встреч на страницах нашего сайта!',
  'Пусть всё получится с первого раза — удачи вам!',
  'Ваша редакция «1001 совета» всегда рада помочь!',
  'Желаем тепла в доме и порядка во всех делах!',
  'Всего доброго и до скорых встреч, дорогие читатели!',
]

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const limit = parseInt(arg('--limit', '50'), 10)
const verticals = (arg('--verticals', '') || '').split(',').filter(Boolean)
const REPO = 'C:/DEV/sovetydoma'
const WSL_REPO = '/mnt/c/DEV/sovetydoma'
const PROMPT_DIR = path.join(REPO, '.matrix-ideas', 'draftprompts')
const DRAFT_DIR = path.join(REPO, '.matrix-ideas', 'drafts')
fs.mkdirSync(PROMPT_DIR, { recursive: true }); fs.mkdirSync(DRAFT_DIR, { recursive: true })
const sb = helpers.getServiceClient()

async function pick() {
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

function grokDraft(row, idx = 0) {
  const wc = row.frontmatter?.target_wc || 800
  const mdRel = `.matrix-ideas/drafts/${row.slug}.md`
  const greeting = GREETINGS[idx % GREETINGS.length]
  const farewell = FAREWELLS[idx % FAREWELLS.length]
  const prompt = `Напиши ПОЛНУЮ практичную статью на русском языке для портала бытовых советов SovetyDoma (1001sovet.ru).

ЗАГОЛОВОК: ${row.title}
О ЧЁМ: ${row.description || ''}
КАТЕГОРИЯ: ${row.category}
ПРИМЕРНЫЙ ОБЪЁМ: ${wc} слов.

ТРЕБОВАНИЯ:
- Только тело статьи в формате Markdown. БЕЗ frontmatter, БЕЗ заголовка H1.
- Первая строка — ровно эта фраза-приветствие, отдельным абзацем: "${greeting}"
- Сразу после неё — короткий вводный абзац (1-2 предложения) по теме, затем несколько подзаголовков ## с практичным содержанием.
- Списки, конкретные числа, шаги, пропорции, сроки — где уместно.
- Последний абзац статьи — ровно эта фраза-прощание, отдельным абзацем: "${farewell}"
- Тема бытовая — пиши тёплым, человеческим, разговорным языком, как для соседа, а не сухим наукообразным тоном.
- Живой русский язык, без воды, без рекламы, без упоминания ИИ/нейросетей.

Запиши ТОЛЬКО markdown-текст статьи (без комментариев) в файл ${mdRel} в этом репозитории с помощью инструмента записи файла. Не ищи в интернете, не исследуй репозиторий, не запускай другие команды. После записи выведи: SAVED ${row.slug}`
  const pf = path.join(PROMPT_DIR, `${row.slug}.txt`)
  fs.writeFileSync(pf, prompt, 'utf8')
  const wslPf = `${WSL_REPO}/.matrix-ideas/draftprompts/${row.slug}.txt`
  const cmd = `export PATH="$HOME/.grok/bin:$PATH"; cd ${WSL_REPO}; grok --prompt-file "${wslPf}" --cwd ${WSL_REPO} --permission-mode bypassPermissions --no-subagents --disable-web-search --max-turns 6 --output-format plain`
  spawnSync('wsl.exe', ['-d', 'Ubuntu-24.04', '-u', 'root', '--', 'bash', '-lc', cmd], { timeout: 300000, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 })
  const mdFull = path.join(DRAFT_DIR, `${row.slug}.md`)
  return fs.existsSync(mdFull) ? mdFull : null
}

async function main() {
  const rows = await pick()
  console.log(`Picked ${rows.length} image-ready rows to draft with Grok.`)
  let ok = 0, fail = 0
  for (const [idx, row] of rows.entries()) {
    process.stdout.write(`  [${row.slug}] drafting... `)
    let md = null
    try { md = grokDraft(row, idx) } catch (e) { console.log('error ' + e.message) }
    if (!md) { fail++; console.log('FAILED (no file)'); continue }
    let body = fs.readFileSync(md, 'utf8').replace(/^﻿/, '').trim()
    body = body.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/i, '').replace(/^#\s+.*\n+/, '').trim()
    const w = helpers.wordCount(body)
    if (w < 250) { fail++; console.log(`too short (${w}w)`); continue }
    await sb.from('content_matrix').update({ body_md: body, word_count: w, text_status: 'draft', last_filled_stage: 'draft', review_agent: 'grok-draft' }).eq('id', row.id)
    await sb.from('content_matrix_events').insert({ matrix_id: row.id, axis: 'text', from_value: 'idea', to_value: 'draft', agent: 'grok-draft', notes: `${w} words` })
    ok++; console.log(`OK (${w}w)`)
  }
  const { count } = await sb.from('content_matrix').select('*', { count: 'exact', head: true }).eq('domain', DOMAIN).eq('text_status', 'draft')
  console.log(`Done. drafted=${ok} failed=${fail} | total drafts now: ${count}`)
}
main().catch((e) => { console.error('fatal:', e); process.exit(1) })
