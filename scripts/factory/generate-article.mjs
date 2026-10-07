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
//      (or MATRIX_SUPABASE_URL / MATRIX_SUPABASE_SERVICE_ROLE_KEY),
//      FACTORY_TEXT_PROVIDER (default anthropic — the ONLY supported provider),
//      FACTORY_MODEL, FAL_MODEL, FACTORY_RESULT_PATH (machine-readable result).
// Usage:
//   node scripts/factory/generate-article.mjs --category dacha-i-ogorod
//   node scripts/factory/generate-article.mjs --all            (1 per category)
//   node scripts/factory/generate-article.mjs --all --dry-run  (no writes/cost)
// Exit codes: 0 ok · 1 generic failure · 42 provider balance/quota exhausted
// (prints `PROVIDER_BALANCE_EXHAUSTED provider=<name>` on stderr; see provider-errors.mjs).
//
// This module is import-safe: importing it reads NO env/secrets and performs NO
// API/DB calls. Everything happens inside runFactory(argv, deps) so tests can
// inject fakes; only the CLI main() path builds real clients.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import helpers from '../matrix/lib.mjs'
import {
  EXIT_PROVIDER_BALANCE,
  ProviderFailureError,
  asProviderError,
  buildFailure,
  classifyProviderBalanceError,
  classifyProviderFailure,
  isProviderWide,
} from './provider-errors.mjs'
import {
  CATEGORIES,
  DEFAULT_FAL_MODEL,
  DEFAULT_TEXT_MODEL,
  DEFAULT_TEXT_PROVIDER,
  DOMAIN,
  IMAGE_PROVIDER,
  SUPPORTED_TEXT_PROVIDERS,
} from './factory-config.mjs'

export { EXIT_PROVIDER_BALANCE, classifyProviderBalanceError, classifyProviderFailure }

const TEXT_TIMEOUT_MS = 120_000
const IMAGE_TIMEOUT_MS = 60_000
const MAX_IMAGE_ATTEMPTS = 4

const SYSTEM = `Ты — опытный русскоязычный автор практических бытовых статей для сайта СоветыДома (1001sovet.ru).
Пиши как живой человек, который реально делал это руками: конкретno, по делу, с цифрами, без воды и канцелярита, без «в современном мире» и «как известно».
Запрещено: маркетинговые штампы, общие фразы, выдуманные факты, опасные советы.
Каждая статья — самостоятельная, полезная, с практическими шагами.`

function parseArgs(argv) {
  const arg = (k, d) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : d }
  const has = (k) => argv.includes(k)
  const all = has('--all')
  const categories = all ? Object.keys(CATEGORIES) : [arg('--category', '')].filter(Boolean)
  return { all, categories, dryRun: has('--dry-run'), model: arg('--model', null) }
}

// Rejects an unknown text provider BEFORE any API/DB work — even in dry-run.
// FAL_KEY is image config and is never counted as text config.
export function resolveTextProvider(env) {
  const raw = String(env.FACTORY_TEXT_PROVIDER ?? '').trim().toLowerCase()
  const provider = raw || DEFAULT_TEXT_PROVIDER
  if (!SUPPORTED_TEXT_PROVIDERS.includes(provider)) {
    const err = new Error(
      `Unsupported FACTORY_TEXT_PROVIDER "${raw || '(empty)'}" (supported: ${SUPPORTED_TEXT_PROVIDERS.join(', ')}). No fallback provider exists.`,
    )
    err.failure = buildFailure('config', null, 'config', null)
    err.failure.reason = 'unsupported_text_provider'
    err.failure.action = 'Set the FACTORY_TEXT_PROVIDER repo var to a supported provider (anthropic). No fallback exists.'
    throw err
  }
  return provider
}

function resolveModels(args, env) {
  return {
    textModel: args.model || env.FACTORY_MODEL || DEFAULT_TEXT_MODEL,
    imageModel: env.FAL_MODEL || DEFAULT_FAL_MODEL,
  }
}

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

// Pull recent titles/slugs in this category so Claude picks a genuinely NEW topic.
async function recentForCategory(sb, category) {
  const { data, error } = await sb.from('content_matrix')
    .select('title,slug')
    .eq('domain', DOMAIN).eq('category', category)
    .order('created_at', { ascending: false })
    .limit(120)
  if (error) throw new Error('matrix recent-title query failed')
  const titles = (data || []).map((r) => r.title).filter(Boolean)
  const slugs = new Set((data || []).map((r) => r.slug).filter(Boolean))
  return { titles, slugs }
}

async function genImage(imagePrompt, title, category, slug, deps) {
  const prompt = helpers.buildImagePrompt(imagePrompt, title, category)
  for (let attempt = 1; attempt <= MAX_IMAGE_ATTEMPTS; attempt++) {
    let res
    try {
      res = await deps.fetchImpl(`https://fal.run/${deps.imageModel}`, {
        method: 'POST',
        headers: { Authorization: `Key ${deps.falKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, image_size: 'landscape_4_3', num_images: 1, num_inference_steps: 4, enable_safety_checker: true }),
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      })
    } catch (e) {
      // Network-level failure — classify (balance first) before deciding to retry.
      const failure = classifyProviderFailure(e, { provider: IMAGE_PROVIDER, stage: 'image' })
      if (attempt < MAX_IMAGE_ATTEMPTS && failure.retryable) { await sleep(2000 * attempt); continue }
      throw new ProviderFailureError(failure.kind === 'unknown' ? asProviderError(e, { provider: IMAGE_PROVIDER, stage: 'image' }).failure : failure)
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      const err = new Error(`fal ${res.status}: ${body.slice(0, 300)}`)
      err.status = res.status
      const failure = classifyProviderFailure(err, { provider: IMAGE_PROVIDER, stage: 'image' })
      // Balance/auth (incl. quota-bearing 429) NEVER retries — fail fast with exit 42.
      if (failure.kind === 'balance' || failure.kind === 'auth') throw new ProviderFailureError(failure)
      if ((res.status === 429 || res.status >= 500 || failure.retryable) && attempt < MAX_IMAGE_ATTEMPTS) {
        await sleep(2000 * attempt)
        continue
      }
      // Never leak the raw provider payload into logs — status only.
      throw new ProviderFailureError(failure)
    }
    const json = await res.json().catch(() => null)
    const url = json?.images?.[0]?.url
    if (!url) throw new ProviderFailureError(buildFailure('request', IMAGE_PROVIDER, 'image', null))
    let buf
    try {
      if (url.startsWith('data:')) buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
      else {
        const imageRes = await deps.fetchImpl(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) })
        if (!imageRes.ok) {
          const err = new Error(`fal image download HTTP ${imageRes.status}`)
          err.status = imageRes.status
          throw new ProviderFailureError(classifyProviderFailure(err, { provider: IMAGE_PROVIDER, stage: 'image' }))
        }
        buf = Buffer.from(await imageRes.arrayBuffer())
      }
    } catch (e) {
      if (e instanceof ProviderFailureError) throw e
      const failure = classifyProviderFailure(e, { provider: IMAGE_PROVIDER, stage: 'image' })
      throw new ProviderFailureError(failure.kind === 'unknown' ? asProviderError(e, { provider: IMAGE_PROVIDER, stage: 'image' }).failure : failure)
    }
    const filename = `${slug}.jpg`
    fs.mkdirSync(deps.imagesDir, { recursive: true })
    fs.writeFileSync(path.join(deps.imagesDir, filename), buf)
    return filename
  }
  throw new ProviderFailureError(buildFailure('unavailable', IMAGE_PROVIDER, 'image', 503))
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function generateForCategory(category, ctx) {
  const { sb, deps, dryRun, models, textProvider } = ctx
  const categoryName = CATEGORIES[category]
  // Dry run never touches the DB (or any side effect) — no recent-titles pull.
  const { titles, slugs } = dryRun ? { titles: [], slugs: new Set() } : await recentForCategory(sb, category)

  if (dryRun) {
    deps.logger.log(`[dry-run] ${category}: would call ${textProvider}(${models.textModel}) + ${IMAGE_PROVIDER}(${models.imageModel}), insert 1 approved row.`)
    return { category, ok: true, dryRun: true }
  }

  // Text provider call site — attribution is by CALL SITE, not message guessing.
  let msg
  try {
    msg = await deps.anthropic.messages.create({
      model: models.textModel, max_tokens: 4000, system: SYSTEM,
      messages: [{ role: 'user', content: buildUserPrompt(category, categoryName, titles) }],
    })
  } catch (e) {
    throw asProviderError(e, { provider: textProvider, stage: 'text' })
  }
  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  const art = extractJson(text)

  let slug = cleanSlug(art.slug || art.title)
  if (!slug) throw new Error('empty slug')
  if (slugs.has(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}` // collision guard

  const body = String(art.body_md || '').trim()
  if (helpers.hasMojibake(art.title) || helpers.hasMojibake(body)) throw new Error('mojibake in generated text')
  if (helpers.wordCount(body) < 250) throw new Error(`body too short (${helpers.wordCount(body)} words)`)

  // Image provider call site.
  const imageFilename = await genImage(art.image_prompt, art.title, category, slug, deps)

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

  deps.logger.log(`✓ ${category}: "${art.title}" (${helpers.wordCount(body)}w, img ${imageFilename}) -> approved`)
  return { category, ok: true, slug, title: art.title, imageFilename }
}

// Run the factory. deps injects every side effect so tests need no network/DB:
//   env        — environment map (defaults to process.env ONLY in the CLI main path)
//   anthropic  — client with .messages.create (SDK retries disabled: maxRetries 0)
//   fetchImpl  — fetch implementation (fal.ai image calls)
//   sb         — Supabase service client (null in dry-run)
//   logger     — { log, error }
//   resultPath — where the machine-readable result JSON is written
export async function runFactory(argv, rawDeps) {
  // Normalize optional deps once, so downstream helpers can rely on them.
  const deps = { logger: console, ...rawDeps }
  const logger = deps.logger
  const env = deps.env || {}
  const requested = parseArgs(argv)
  const dryRun = requested.dryRun

  // 1) Text provider gate — before ANY API/DB work, even dry-run. No fallback.
  let textProvider
  try {
    textProvider = resolveTextProvider(env)
  } catch (e) {
    const result = baseResult({ env, argv: requested, textProvider: null, dryRun })
    result.ok = false
    result.exitCode = 1
    result.failure = e.failure
    result.categories = requested.categories.map((category) => ({
      category, ok: false, reason: e.failure.reason, action: e.failure.action,
    }))
    writeResult(deps, result)
    logger.error(e.failure.action)
    return result
  }
  const models = resolveModels(requested, env)

  logger.log(`[factory] text provider=${textProvider} model=${models.textModel} | image provider=${IMAGE_PROVIDER} model=${models.imageModel}${dryRun ? ' [dry-run]' : ''}`)

  // 2) Validate categories.
  if (requested.categories.length === 0) {
    const failure = buildFailure('config', null, 'config', null)
    failure.reason = 'missing_category'
    failure.action = 'Specify --category <slug> or --all.'
    const result = baseResult({ env, argv: requested, textProvider, dryRun })
    result.ok = false; result.exitCode = 1; result.failure = failure
    writeResult(deps, result)
    logger.error(failure.action)
    return result
  }
  for (const c of requested.categories) {
    if (!CATEGORIES[c]) {
      const failure = buildFailure('config', null, 'config', null)
      failure.reason = 'unknown_category'
      failure.action = `Unknown category: ${c}.`
      const result = baseResult({ env, argv: requested, textProvider, dryRun })
      result.ok = false; result.exitCode = 1; result.failure = failure
      writeResult(deps, result)
      logger.error(failure.action)
      return result
    }
  }

  // 3) Dry run — zero side effects: no text/image calls, no DB, no writes.
  if (dryRun) {
    const result = baseResult({ env, argv: requested, textProvider, dryRun })
    result.categories = []
    for (const category of requested.categories) {
      const categoryResult = await generateForCategory(category, {
        sb: null, deps: { ...deps, anthropic: null, fetchImpl: null }, dryRun: true, models, textProvider,
      }).catch(() => ({ category, ok: false, reason: 'dry_run_failed', action: 'Inspect dry-run input and logger configuration.' }))
      result.categories.push(categoryResult)
    }
    result.ok = result.categories.every((c) => c.ok)
    result.exitCode = result.ok ? 0 : 1
    if (!result.ok) result.failure = { kind: 'unknown', provider: null, stage: 'pipeline', reason: 'dry_run_failed', action: 'Inspect dry-run input and logger configuration.' }
    result.counts.attempted = 0
    result.counts.generated = result.categories.filter((c) => c.ok && !c.dryRun).length
    writeResult(deps, result)
    logger.log(`\nFactory: ${result.categories.filter((c) => c.ok).length}/${result.categories.length} categories [dry-run].`)
    return result
  }

  // 4) Real run — require provider credentials (FAL_KEY is image-only config).
  const falKey = env.FAL_KEY || env.FAL_API_KEY
  const anthropicKey = env.ANTHROPIC_API_KEY
  if (!anthropicKey || !falKey) {
    const missing = [!anthropicKey && 'ANTHROPIC_API_KEY', !falKey && 'FAL_KEY'].filter(Boolean).join(', ')
    const failure = buildFailure('config', null, 'config', null)
    failure.reason = 'missing_config'
    failure.action = `Missing required env: ${missing}.`
    const result = baseResult({ env, argv: requested, textProvider, dryRun })
    result.ok = false; result.exitCode = 1; result.failure = failure
    writeResult(deps, result)
    logger.error(failure.action)
    return result
  }

  let sb
  let anthropic
  try {
    sb = deps.sb || helpers.getServiceClient()
    anthropic = deps.anthropic || new Anthropic({
    apiKey: anthropicKey,
    maxRetries: 0, // no hidden SDK retries — retries are ours, classified first
    timeout: TEXT_TIMEOUT_MS,
    ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
    ...(env.ANTHROPIC_RELAY_TOKEN ? { defaultHeaders: { 'X-Relay-Token': env.ANTHROPIC_RELAY_TOKEN } } : {}),
    })
  } catch {
    const result = baseResult({ env, argv: requested, textProvider, dryRun })
    result.failure = buildFailure('unknown', null, 'setup', null)
    result.failure.reason = 'client_setup_failed'
    result.failure.action = 'Check service credentials and client configuration in the environment; CI reads repository secrets and does not load local .env files.'
    result.exitCode = 1
    writeResult(deps, result)
    logger.error(result.failure.action)
    return result
  }
  const deps2 = { ...deps, anthropic, fetchImpl: deps.fetchImpl || fetch, falKey, imagesDir: deps.imagesDir || path.join(process.cwd(), 'public', 'images') }

  // 5) Batch loop — stop IMMEDIATELY on a provider-wide outage (balance/auth/
  //    unavailable/timeout/rate_limited). Partial rows never signal publish:
  //    the exit code stays non-zero and the workflow gates publish on exit 0.
  const result = baseResult({ env, argv: requested, textProvider, dryRun })
  let haltFailure = null
  for (const category of requested.categories) {
    if (haltFailure) break
    result.counts.attempted++
    try {
      const r = await generateForCategory(category, { sb, deps: deps2, dryRun: false, models, textProvider })
      result.counts.generated++
      result.generated.push({ category, slug: r.slug, title: r.title, imageFilename: r.imageFilename })
      result.categories.push({ category, ok: true, slug: r.slug, title: r.title, imageFilename: r.imageFilename })
    } catch (e) {
      if (e instanceof ProviderFailureError) {
        result.categories.push({ category, ok: false, ...safeOutcome(e.failure) })
        if (isProviderWide(e.failure)) haltFailure = e.failure
      } else {
        // Generic per-category failure (validation, DB, …) — keep going, exit 1.
        const isDb = String(e?.message || '').startsWith('matrix') || String(e?.message || '').includes('Supabase')
        const failure = buildFailure('unknown', null, isDb ? 'database' : 'validation', null)
        failure.reason = isDb ? 'database_operation_failed' : 'content_validation_failed'
        failure.action = isDb ? 'Inspect the Supabase query or insert logs, then retry after correcting the database issue.' : 'Inspect generated content validation and category input; correct the cause before retrying.'
        result.categories.push({ category, ok: false, ...safeOutcome(failure) })
      }
    }
  }

  const balance = haltFailure?.kind === 'balance' ? haltFailure : null
  result.failure = haltFailure || result.categories.find((c) => !c.ok) || null
  if (result.failure && !result.failure.reason) result.failure = { kind: 'unknown', provider: null, stage: 'pipeline', reason: result.failure.reason || 'category_failed', action: result.failure.action || 'Inspect the failed category and workflow logs.' }
  result.halted = !!haltFailure
  result.ok = result.categories.every((c) => c.ok)
  result.exitCode = balance ? EXIT_PROVIDER_BALANCE : (result.ok ? 0 : 1)

  logger.log(`\nFactory: ${result.counts.generated}/${result.counts.attempted} attempted (${result.counts.requested} requested).`)
  if (haltFailure) {
    logger.error(`Provider-wide outage: provider=${haltFailure.provider} stage=${haltFailure.stage} reason=${haltFailure.reason}`)
    logger.error(`Operator action: ${haltFailure.action}`)
  }

  writeResult(deps, result)
  return result
}

function safeOutcome(failure) {
  // Stable, machine-readable — never the raw provider payload.
  return {
    kind: failure.kind,
    provider: failure.provider,
    stage: failure.stage,
    reason: failure.reason,
    action: failure.action,
  }
}

function baseResult({ env, argv, textProvider, dryRun }) {
  const models = textProvider ? resolveModels(argv, env) : { textModel: null, imageModel: env.FAL_MODEL || DEFAULT_FAL_MODEL }
  return {
    schema: 1,
    ok: false,
    exitCode: 1,
    dryRun,
    halted: false,
    textProvider,
    textModel: models.textModel,
    imageProvider: IMAGE_PROVIDER,
    imageModel: models.imageModel,
    counts: { requested: argv.categories.length, attempted: 0, generated: 0 },
    failure: null,
    categories: [],
    generated: [],
  }
}

function writeResult(deps, result) {
  const resultPath = deps.resultPath || process.env.FACTORY_RESULT_PATH || path.join(os.tmpdir(), 'sovetydoma-factory-result.json')
  try {
    fs.mkdirSync(path.dirname(resultPath), { recursive: true })
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2))
    ;(deps.logger || console).log(`[factory] result JSON -> ${resultPath}`)
  } catch (e) {
    ;(deps.logger || console).error(`[factory] failed to write result JSON: ${e.message}`)
  }
}

// CLI main — the ONLY path that reads .env.local / process.env and builds
// real clients. Importing this module never does.
async function main() {
  // Local runs read .env.local; CI provides real env vars which take priority.
  for (const [k, v] of Object.entries(helpers.loadEnv())) {
    if (process.env[k] === undefined) process.env[k] = v
  }
  const result = await runFactory(process.argv.slice(2), { env: process.env })
  if (result.exitCode === EXIT_PROVIDER_BALANCE) {
    const provider = result.failure?.provider || 'unknown'
    console.error(`PROVIDER_BALANCE_EXHAUSTED provider=${provider}`)
  }
  process.exit(result.exitCode)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  main().catch(() => {
    const result = baseResult({ env: process.env, argv: parseArgs(process.argv.slice(2)), textProvider: null, dryRun: process.argv.includes('--dry-run') })
    result.failure = { kind: 'unknown', provider: null, stage: 'setup', reason: 'startup_failed', action: 'Inspect factory startup configuration and runtime logs.' }
    result.exitCode = 1
    writeResult({ env: process.env }, result)
    console.error(result.failure.action)
    process.exit(1)
  })
}
