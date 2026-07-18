// Content quality gate for the dynamic (NO-REDEPLOY) publish path.
//
// Two uses:
//  1. Library: checkArticleQuality(row, ctx) — called by publish-dynamic.mjs
//     before a row is marked published. Blocking issues stop the publish
//     unless --force is given.
//  2. CLI report: node scripts/matrix/quality-gate.mjs --report
//     Scans ALL published dynamic articles, writes a dated markdown report to
//     reports/ with issue counts. Read-only, never rewrites articles.
//
// Context (existing published titles/descriptions/intros/outros) is built by
// buildQualityContext(rows) from a content_matrix dump — callers must paginate
// PostgREST explicitly (1,000-row cap), see fetchAllPublishedForContext below.

const DOMAIN = '1001sovet.ru'
const PAGE = 1000

export const MIN_WORDS = 300
export const TITLE_MIN = 20
export const TITLE_MAX = 95
export const DESC_MIN = 70
export const DESC_MAX = 180

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function wordCount(row) {
  if (row.word_count) return row.word_count
  return String(row.body_md ?? '').split(/\s+/).filter(Boolean).length
}

function edgeKey(text) {
  return normalize(text).slice(0, 160)
}

// Risky-topic detection: medical / legal / financial / dangerous household
// advice must carry a visible disclaimer or professional-referral marker.
// JS \b does not work for Cyrillic, so use explicit non-letter boundaries.
const wb = (src) => new RegExp(`(^|[^а-яёa-z0-9])(?:${src})(?=[^а-яёa-z0-9]|$)`, 'i')
const RISKY_PATTERNS = [
  wb('лечить|лечение|лекарств|таблетк|антибиотик|дозировк|диабет|от[её]к|ушиб|травм[а-яё]*|первая помощь|обморок|отравлени|(высокое|низкое|артериальное) давление'),
  wb('штраф[а-яё]*|налог[а-яё]*|исков|судебн|в суде|наследств[а-яё]*|пристав[а-яё]*'),
  wb('кредит[а-яё]*|ипотек[а-яё]*|инвестиц[а-яё]*|вклад под|субсиди[а-яё]*|льгот[а-яё]*|пенси[а-яё]*'),
  wb('газов(ая|ой|ую|ое) (плит|колонк|оборудован|труб)[а-яё]*|электропроводк[а-яё]*|сварк[а-яё]*|самогон[а-яё]*'),
]
const DISCLAIMER_PATTERNS = [
  /обратитесь к (врачу|специалисту|мастеру|юристу|профессионал)/i,
  /проконсультируйтесь/i,
  /не является (медицинск|юридическ|финансов)/i,
  /вызовите (мастера|специалиста|газовую службу)/i,
  /точную дозировку (назначит|подбер[её]т) врач/i,
  /информаци[яию] носит ознакомительный характер/i,
]

/**
 * Check one article row against quality rules.
 * @param {object} row content_matrix row (slug,title,description,body_md,word_count,image_filename,tags)
 * @param {object} ctx from buildQualityContext()
 * @returns {{ok: boolean, issues: Array<{code: string, severity: 'block'|'warn', message: string}>}}
 */
export function checkArticleQuality(row, ctx) {
  const issues = []
  const block = (code, message) => issues.push({ code, severity: 'block', message })
  const warn = (code, message) => issues.push({ code, severity: 'warn', message })

  const words = wordCount(row)
  if (words < MIN_WORDS) block('too_short', `${words} слов (< ${MIN_WORDS})`)

  const title = String(row.title ?? '').trim()
  if (title.length < TITLE_MIN) block('title_short', `title ${title.length} симв. (< ${TITLE_MIN})`)
  if (title.length > TITLE_MAX) block('title_long', `title ${title.length} симв. (> ${TITLE_MAX})`)

  const description = String(row.description ?? '').trim()
  if (description.length < DESC_MIN) block('desc_short', `description ${description.length} симв. (< ${DESC_MIN})`)
  if (description.length > DESC_MAX) block('desc_long', `description ${description.length} симв. (> ${DESC_MAX})`)

  if (!row.image_filename) block('no_image', 'нет image_filename')

  if (!Array.isArray(row.tags) || row.tags.length < 2) warn('few_tags', 'меньше 2 тегов')

  if (ctx) {
    const titleOwner = ctx.titles.get(normalize(title))
    if (titleOwner && titleOwner !== row.slug) block('dup_title', `title совпадает с ${titleOwner}`)

    const descOwner = ctx.descriptions.get(normalize(description))
    if (descOwner && descOwner !== row.slug) block('dup_description', `description совпадает с ${descOwner}`)

    const body = String(row.body_md ?? '')
    const introCount = ctx.intros.get(edgeKey(body.slice(0, 400))) ?? 0
    if (introCount >= 2) block('boilerplate_intro', `вступление совпадает с ${introCount} другими статьями`)
    const outroCount = ctx.outros.get(edgeKey(body.slice(-400))) ?? 0
    if (outroCount >= 2) warn('boilerplate_outro', `заключение совпадает с ${outroCount} другими статьями`)
  }

  const haystack = `${title}\n${String(row.body_md ?? '').slice(0, 4000)}`
  if (RISKY_PATTERNS.some((re) => re.test(haystack))) {
    const hasDisclaimer = DISCLAIMER_PATTERNS.some((re) => re.test(String(row.body_md ?? '')))
    if (!hasDisclaimer) {
      warn('risky_no_disclaimer', 'медицинская/юридическая/финансовая/опасная тема без дисклеймера')
    }
  }

  return { ok: !issues.some((i) => i.severity === 'block'), issues }
}

/**
 * Build the duplicate/boilerplate context from existing published rows.
 * @param {Array<{slug:string,title:string,description:string,body_md:string}>} rows
 */
export function buildQualityContext(rows) {
  const titles = new Map()
  const descriptions = new Map()
  const intros = new Map()
  const outros = new Map()
  for (const r of rows) {
    const t = normalize(r.title)
    if (t && !titles.has(t)) titles.set(t, r.slug)
    const d = normalize(r.description)
    if (d && !descriptions.has(d)) descriptions.set(d, r.slug)
    const body = String(r.body_md ?? '')
    const ik = edgeKey(body.slice(0, 400))
    if (ik.length >= 60) intros.set(ik, (intros.get(ik) ?? 0) + 1)
    const ok = edgeKey(body.slice(-400))
    if (ok.length >= 60) outros.set(ok, (outros.get(ok) ?? 0) + 1)
  }
  return { titles, descriptions, intros, outros }
}

/** Fetch every published row needed for the context, paginating explicitly. */
export async function fetchAllPublishedForContext(sb, { dynamicOnly = false } = {}) {
  const rows = []
  for (;;) {
    let q = sb
      .from('content_matrix')
      .select('slug,title,description,body_md,word_count,image_filename,tags,category,published_at')
      .eq('domain', DOMAIN)
      .eq('text_status', 'published')
      .order('published_at', { ascending: false })
      .range(rows.length, rows.length + PAGE - 1)
    if (dynamicOnly) q = q.eq('frontmatter->>published_via', 'dynamic')
    const { data, error } = await q
    if (error) throw new Error(`content_matrix context query: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

// ---------------------------------------------------------------------------
// CLI: --report scans all published dynamic articles (read-only)
// ---------------------------------------------------------------------------

const isMain = process.argv[1] && process.argv[1].endsWith('quality-gate.mjs')
if (isMain) {
  const { default: helpers } = await import('./lib.mjs')
  const fs = await import('node:fs')
  const path = await import('node:path')

  const sb = helpers.getServiceClient()
  const rows = await fetchAllPublishedForContext(sb, { dynamicOnly: true })
  const ctx = buildQualityContext(rows)

  const counts = {}
  const samples = {}
  let fullyOk = 0
  let blocked = 0
  let riskyNoDisclaimer = 0
  const wordCounts = []

  for (const row of rows) {
    wordCounts.push(wordCount(row))
    const { ok, issues } = checkArticleQuality(row, ctx)
    if (ok && issues.length === 0) fullyOk++
    if (!ok) blocked++
    for (const issue of issues) {
      counts[issue.code] = (counts[issue.code] ?? 0) + 1
      if (!samples[issue.code]) samples[issue.code] = []
      if (samples[issue.code].length < 10) samples[issue.code].push(`${row.slug} — ${issue.message}`)
      if (issue.code === 'risky_no_disclaimer') riskyNoDisclaimer++
    }
  }

  wordCounts.sort((a, b) => a - b)
  const median = wordCounts[Math.floor(wordCounts.length / 2)] ?? 0

  const today = new Date().toISOString().slice(0, 10)
  const lines = [
    `# Content quality gate report — ${today}`,
    '',
    `Проверено динамических опубликованных статей: **${rows.length}**`,
    `Без единой проблемы: ${fullyOk}`,
    `С блокирующими проблемами: ${blocked}`,
    `Медианный объём: ${median} слов`,
    '',
    '## Проблемы по типам',
    '',
    '| Код | Кол-во |',
    '| --- | ---: |',
    ...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([code, n]) => `| ${code} | ${n} |`),
    '',
    '## Примеры (до 10 на тип)',
    '',
    ...Object.entries(samples).flatMap(([code, list]) => [`### ${code}`, '', ...list.map((s) => `- ${s}`), '']),
    '## Примечания',
    '',
    '- Отчёт read-only: статьи не переписываются автоматически.',
    '- Блокирующие коды: too_short, title_short/long, desc_short/long, no_image, dup_title, dup_description, boilerplate_intro.',
    '- risky_no_disclaimer — предупреждение: тема требует дисклеймера/отсылки к специалисту.',
  ]

  const outPath = path.join('reports', `content-quality-gate-${today}.md`)
  fs.mkdirSync('reports', { recursive: true })
  fs.writeFileSync(outPath, lines.join('\n'))
  console.log(`scanned: ${rows.length}, blocked: ${blocked}, risky w/o disclaimer: ${riskyNoDisclaimer}`)
  console.log(`report: ${outPath}`)
  console.log(counts)
}
