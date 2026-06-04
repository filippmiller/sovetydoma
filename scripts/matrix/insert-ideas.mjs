// insert-ideas.mjs — ingest Kimi-generated idea JSON batches into content_matrix.
// Usage: node scripts/matrix/insert-ideas.mjs <file-or-dir> [...more]
//   - Accepts .json files (a JSON array of idea objects) or a directory of them.
//   - Tolerant parse: extracts the first [ ... ] block if the file has stray text.
//   - Dedup: skips slugs already in DB; skips titles with trigram-similarity > THRESHOLD
//     vs existing rows (same domain) or earlier-in-this-run titles.
//   - Inserts survivors as text_status='idea', image_status='none'.
import fs from 'node:fs'
import path from 'node:path'
import helpers from './lib.mjs'

const DOMAIN = '1001sovet.ru'
const KB = 'sovetydoma-home-core'
const SIM_THRESHOLD = 0.5
const ALLOWED_CATEGORIES = ['kulinaria', 'dom-i-uborka', 'dacha-i-ogorod', 'layfkhaki', 'ekonomiya', 'rybalka']

function sanitizeSlug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70)
    .replace(/-$/, '')
}

function trigrams(s) {
  const t = '  ' + String(s || '').toLowerCase().replace(/[^a-zа-яё0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim() + ' '
  const set = new Set()
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3))
  return set
}
function sim(aSet, b) {
  const bSet = trigrams(b)
  if (!aSet.size || !bSet.size) return 0
  let inter = 0
  for (const g of bSet) if (aSet.has(g)) inter++
  return inter / (aSet.size + bSet.size - inter)
}

function collectFiles(args) {
  const files = []
  for (const a of args) {
    if (!fs.existsSync(a)) { console.warn(`skip missing: ${a}`); continue }
    if (fs.statSync(a).isDirectory()) {
      for (const f of fs.readdirSync(a)) if (f.endsWith('.json')) files.push(path.join(a, f))
    } else if (a.endsWith('.json')) files.push(a)
  }
  return files
}

function parseIdeas(text) {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
}

async function main() {
  const args = process.argv.slice(2)
  if (!args.length) { console.error('usage: node insert-ideas.mjs <file-or-dir> [...]'); process.exit(1) }
  const files = collectFiles(args)
  if (!files.length) { console.error('no .json files found'); process.exit(1) }
  const sb = helpers.getServiceClient()

  // Existing rows for this domain (slugs + title trigram sets) for dedup
  console.log('Loading existing rows for dedup...')
  const existingSlugs = new Set()
  const existingTitleSets = []
  let from = 0
  for (;;) {
    const { data, error } = await sb.from('content_matrix').select('slug,title').eq('domain', DOMAIN).range(from, from + 999)
    if (error) { console.error('load existing error:', error.message); process.exit(1) }
    if (!data || !data.length) break
    for (const r of data) { if (r.slug) existingSlugs.add(r.slug); if (r.title) existingTitleSets.push(trigrams(r.title)) }
    if (data.length < 1000) break
    from += 1000
  }
  console.log(`Existing: ${existingSlugs.size} slugs, ${existingTitleSets.length} titles.`)

  let parsed = 0, skippedBad = 0, skippedSlug = 0, skippedSim = 0
  const toInsert = []
  const batchTitleSets = []

  for (const file of files) {
    const ideas = parseIdeas(fs.readFileSync(file, 'utf8'))
    if (!Array.isArray(ideas)) { console.warn(`skip unparseable: ${file}`); continue }
    for (const it of ideas) {
      parsed++
      const title = (it.title || '').trim()
      const slug = sanitizeSlug(it.slug || title)
      const category = it.category
      if (!title || !slug || !ALLOWED_CATEGORIES.includes(category)) { skippedBad++; continue }
      if (existingSlugs.has(slug)) { skippedSlug++; continue }
      // similarity vs existing + this run
      const ts = trigrams(title)
      let dup = false
      for (const e of existingTitleSets) { if (sim(e, title) > SIM_THRESHOLD) { dup = true; break } }
      if (!dup) for (const e of batchTitleSets) { if (sim(e, title) > SIM_THRESHOLD) { dup = true; break } }
      if (dup) { skippedSim++; continue }
      existingSlugs.add(slug); batchTitleSets.push(ts)
      toInsert.push({
        domain: DOMAIN,
        kb_source: KB,
        vertical: it.vertical || helpers.verticalForCategory(category),
        text_status: 'idea',
        image_status: 'none',
        disposition: 'active',
        priority: Number.isInteger(it.priority) ? it.priority : 5,
        title,
        slug,
        category,
        description: (it.description || '').slice(0, 300) || null,
        tags: Array.isArray(it.tags) ? it.tags.slice(0, 8) : [],
        image_prompt: it.image_prompt || null,
        frontmatter: { target_wc: it.target_wc || 800 },
        generated_by_agent: 'kimi-idea-gen-2026-06-04',
        last_filled_stage: 'idea',
      })
    }
  }

  console.log(`Parsed ${parsed} | bad ${skippedBad} | dup-slug ${skippedSlug} | dup-title ${skippedSim} | to insert ${toInsert.length}`)
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100)
    const { error } = await sb.from('content_matrix').upsert(batch, { onConflict: 'domain,slug', ignoreDuplicates: true })
    if (error) { console.error(`insert batch ${i / 100 + 1} error:`, error.message); continue }
    inserted += batch.length
  }
  const { count } = await sb.from('content_matrix').select('*', { count: 'exact', head: true }).eq('domain', DOMAIN).eq('text_status', 'idea')
  console.log(`Inserted ~${inserted}. Total idea rows now: ${count}.`)
}

main().catch((e) => { console.error('fatal:', e); process.exit(1) })
