// generate-article.mjs — API-based content factory (Claude text + fal.ai image).
//
// Replaces the local `kimi` CLI (which cannot run unattended in CI). For each
// requested category it: asks Claude for ONE genuinely-useful, human-sounding
// Russian article (already "humanized" — written as a real person, not generic
// AI filler), generates a matching photo with fal.ai, and inserts an APPROVED
// content_matrix row. publish-dynamic.mjs then ships it live (DB+R2, no rebuild)
// and the subscriptions worker autoposts it to the per-category VK/FB groups.
//
// Cadence target: ONE article per category per day (safe for SEO + social caps).
//
// Env: ANTHROPIC_API_KEY, FAL_KEY, SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//      (or MATRIX_SUPABASE_URL / MATRIX_SUPABASE_SERVICE_ROLE_KEY).
// Usage:
//   node scripts/factory/generate-article.mjs --category dacha-i-ogorod
//   node scripts/factory/generate-article.mjs --all            (1 per category)
//   node scripts/factory/generate-article.mjs --all --dry-run  (no writes/cost)
// Exit codes: 0 ok · 1 generic failure · 42 provider balance/quota exhausted
// (prints `PROVIDER_BALANCE_EXHAUSTED provider=<name>` on stderr; see provider-errors.mjs).
import fs from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import helpers from '../matrix/lib.mjs'
import { EXIT_PROVIDER_BALANCE, classifyProviderBalanceError } from './provider-errors.mjs'

export { EXIT_PROVIDER_BALANCE, classifyProviderBalanceError }

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const has = (k) => process.argv.includes(k)

// Local runs read .env.local; CI provides real env vars which take priority.
for (const [k, v] of Object.entries(helpers.loadEnv())) {
  if (process.env[k] === undefined) process.env[k] = v
}

const DOMAIN = '1001sovet.ru'
const ROOT = process.cwd()
const IMAGES_DIR = path.join(ROOT, 'public', 'images')
const dryRun = has('--dry-run')
const MODEL = arg('--model', process.env.FACTORY_MODEL || 'claude-sonnet-4-6')
const FAL_MODEL = process.env.FAL_MODEL || 'fal-ai/flux/schnell'

// Category slug -> human name + persona voice. Mirrors src/lib/categories + personas.
const CATEGORIES = {
  'kulinaria': 'Кулинария',
  'dom-i-uborka': 'Дом и уборка',
  'dacha-i-ogorod': 'Дача и огород',
  'layfkhaki': 'Лайфхаки',
  'ekonomiya': 'Экономия',
  'rybalka': 'Рыбалка',
  'zdorovie-i-bezopasnost': 'Здоровье и безопасность',
  'semya-i-deti': 'Семья и дети',
  'krasota-i-uhod': 'Красота и уход',
  'otdyh-i-puteshestviya': 'Отдых и путешествия',
  'pokupki-i-tehnika': 'Покупки и техника',
  'avto': 'Авто',
}

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

function fail(msg) { console.error(msg); process.exit(1) }

if (!dryRun && !ANTHROPIC_API_KEY) fail('Missing ANTHROPIC_API_KEY (set it as a secret/env to run the factory).')
if (!dryRun && !FAL_KEY) fail('Missing FAL_KEY (fal.ai image generation).')

const categories = has('--all')
  ? Object.keys(CATEGORIES)
  : [arg('--category', '')].filter(Boolean)
if (categories.length === 0) fail('Specify --category <slug> or --all.')
for (const c of categories) if (!CATEGORIES[c]) fail(`Unknown category: ${c}`)

const sb = dryRun ? null : helpers.getServiceClient()
// Relay-aware: if ANTHROPIC_BASE_URL points at an egress relay (the prod/CI IP
// may be geo-blocked by Anthropic), route through it with the shared
// X-Relay-Token header; the real key still rides in x-api-key. Falls back to a
// direct api.anthropic.com call when no base URL/relay token is set.
const anthropic = dryRun ? null : new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
  ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
  ...(process.env.ANTHROPIC_RELAY_TOKEN ? { defaultHeaders: { 'X-Relay-Token': process.env.ANTHROPIC_RELAY_TOKEN } } : {}),
})

// Pull recent titles/slugs in this category so Claude picks a genuinely NEW topic.
async function recentForCategory(category) {
  if (dryRun) return { titles: [], slugs: new Set() }
  const { data } = await sb.from('content_matrix')
    .select('title,slug')
    .eq('domain', DOMAIN).eq('category', category)
    .order('created_at', { ascending: false })
    .limit(120)
  const titles = (data || []).map((r) => r.title).filter(Boolean)
  const slugs = new Set((data || []).map((r) => r.slug).filter(Boolean))
  return { titles, slugs }
}

const SYSTEM = `Ты — опытный русскоязычный автор практических бытовых статей для сайта СоветыДома (1001sovet.ru).
Пиши как живой человек, который реально делал это руками: конкретno, по делу, с цифрами, без воды и канцелярита, без «в современном мире» и «как известно».
Запрещено: маркетинговые штампы, общие фразы, выдуманные факты, опасные советы.
Каждая статья — самостоятельная, полезная, с практическими шагами.`

function buildUserPrompt(category, categoryName, recentTitles) {
  return `Категория: ${categoryName} (${category}).
Уже есть такие статьи (НЕ повторяй темы, выбери НОВУЮ конкретную тему):
${recentTitles.slice(0, 60).map((t) => `- ${t}`).join('\n') || '(пока нет)'}

Напиши ОДНУ новую статью. Верни СТРОГО валидный JSON (без markdown-обёртки) с полями:
{
  "title": "цепкий конкретный заголовок (50-70 символов)",
  "slug": "latin-kebab-case-slug (только a-z, 0-9, дефис; транслит заголовка)",
  "description": "1-2 предложения, 120-160 символов",
  "tags": ["3-6 тегов на русском"],
  "quickAnswer": "краткий ответ 40-60 слов — суть статьи сразу",
  "difficulty": "Легко | Средне | Сложно",
  "time": "человеческое время, напр. '30 минут' или '1-2 часа'",
  "cost": "напр. 'бесплатно' или 'от 300 ₽'",
  "image_prompt": "english prompt for a realistic photo illustrating the article (no text, no people's faces close-up)",
  "body_md": "тело статьи в Markdown: вводный абзац, затем 3-5 разделов с ## заголовками, практические шаги/списки, 600-900 слов. Без H1 (заголовок отдельно). Реальные, безопасные, проверяемые советы."
}`
}

function extractJson(text) {
  // Claude should return raw JSON; be tolerant of ```json fences.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{'); const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON object in model output')
  return JSON.parse(raw.slice(start, end + 1))
}

function cleanSlug(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

async function genImage(imagePrompt, title, category, slug) {
  const prompt = helpers.buildImagePrompt(imagePrompt, title, category)
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, image_size: 'landscape_4_3', num_images: 1, num_inference_steps: 4, enable_safety_checker: true }),
    })
    if (!res.ok) {
      if ((res.status === 429 || res.status >= 500) && attempt < 4) { await new Promise((r) => setTimeout(r, 2000 * attempt)); continue }
      throw new Error(`fal ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }
    const json = await res.json()
    const url = json?.images?.[0]?.url
    if (!url) throw new Error('fal: no image url')
    const buf = url.startsWith('data:')
      ? Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
      : Buffer.from(await (await fetch(url)).arrayBuffer())
    const filename = `${slug}.jpg`
    fs.mkdirSync(IMAGES_DIR, { recursive: true })
    fs.writeFileSync(path.join(IMAGES_DIR, filename), buf)
    return filename
  }
  throw new Error('fal: exhausted retries')
}

async function generateForCategory(category) {
  const categoryName = CATEGORIES[category]
  const { titles, slugs } = await recentForCategory(category)

  if (dryRun) {
    console.log(`[dry-run] ${category}: would call Claude(${MODEL}) + fal(${FAL_MODEL}), insert 1 approved row.`)
    return { category, ok: true, dryRun: true }
  }

  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: 4000, system: SYSTEM,
    messages: [{ role: 'user', content: buildUserPrompt(category, categoryName, titles) }],
  })
  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  const art = extractJson(text)

  let slug = cleanSlug(art.slug || art.title)
  if (!slug) throw new Error('empty slug')
  if (slugs.has(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}` // collision guard

  const body = String(art.body_md || '').trim()
  if (helpers.hasMojibake(art.title) || helpers.hasMojibake(body)) throw new Error('mojibake in generated text')
  if (helpers.wordCount(body) < 250) throw new Error(`body too short (${helpers.wordCount(body)} words)`)

  const imageFilename = await genImage(art.image_prompt, art.title, category, slug)

  const frontmatter = {
    quickAnswer: art.quickAnswer || undefined,
    difficulty: art.difficulty || undefined,
    time: art.time || undefined,
    cost: art.cost || undefined,
  }

  const row = {
    domain: DOMAIN, category, slug,
    title: art.title, description: art.description,
    body_md: body, tags: Array.isArray(art.tags) ? art.tags : [],
    image_filename: imageFilename, image_prompt: art.image_prompt,
    image_status: 'generated', text_status: 'approved', disposition: 'active',
    vertical: helpers.verticalForCategory(category),
    frontmatter, review_agent: 'claude-factory',
  }
  const { error } = await sb.from('content_matrix').insert(row)
  if (error) throw new Error(`matrix insert: ${error.message}`)

  console.log(`✓ ${category}: "${art.title}" (${helpers.wordCount(body)}w, img ${imageFilename}) -> approved`)
  return { category, ok: true, slug, title: art.title }
}

const results = []
let balanceProvider = null
for (const c of categories) {
  try { results.push(await generateForCategory(c)) }
  catch (e) {
    console.error(`✗ ${c}: ${e.message}`)
    balanceProvider = balanceProvider || classifyProviderBalanceError(e)
    results.push({ category: c, ok: false, error: e.message })
  }
}
const ok = results.filter((r) => r.ok).length
console.log(`\nFactory: ${ok}/${results.length} categories generated${dryRun ? ' [dry-run]' : ''}.`)
if (balanceProvider) {
  console.error(`PROVIDER_BALANCE_EXHAUSTED provider=${balanceProvider}`)
  process.exit(EXIT_PROVIDER_BALANCE)
}
process.exit(results.some((r) => !r.ok) ? 1 : 0)
