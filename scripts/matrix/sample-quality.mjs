// sample-quality.mjs — QA gate for generated drafts. Samples 1-in-N draft rows
// and flags mechanical quality problems; prints heads of flagged rows for review.
// Usage:
//   node scripts/matrix/sample-quality.mjs                 (1/10 sample of kimi-draft rows)
//   node scripts/matrix/sample-quality.mjs --every 5 --agent kimi-draft
//   node scripts/matrix/sample-quality.mjs --every 10 --show-ok
import helpers from './lib.mjs'

const DOMAIN = '1001sovet.ru'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const every = Math.max(1, parseInt(arg('--every', '10'), 10))
const agent = arg('--agent', 'kimi-draft')
const minWords = parseInt(arg('--min-words', '300'), 10)
const showOk = process.argv.includes('--show-ok')

const sb = helpers.getServiceClient()

function checkBody(body) {
  const issues = []
  const w = helpers.wordCount(body)
  if (w < minWords) issues.push(`short(${w}w)`)
  if (!/##/.test(body)) issues.push('no-headings')
  if (helpers.hasMojibake(body) || /�/.test(body)) issues.push('mojibake')
  if (/[一-龥]|[ぁ-ゖ]|[가-힣]/.test(body)) issues.push('foreign-script')
  if (/нейросет|languag(e)? model|как ии\b|искусственн(ый|ого) интеллект/i.test(body)) issues.push('ai-mention')
  if (/^\s*(я не могу|извините, но|как (ассистент|ии|языковая))/i.test(body)) issues.push('refusal')
  if (/^#\s/m.test(body.split('\n')[0] || '')) issues.push('has-h1')
  if (/```/.test(body)) issues.push('code-fence')
  return { w, issues }
}

async function main() {
  // Pull all matching draft rows (id+slug+body) ordered stably, then sample every Nth.
  const all = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb.from('content_matrix')
      .select('slug,category,body_md,image_generated_at')
      .eq('domain', DOMAIN).eq('text_status', 'draft').eq('review_agent', agent)
      .order('image_generated_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || !data.length) break
    all.push(...data)
    if (data.length < pageSize) break
  }
  console.log(`Total ${agent} drafts: ${all.length}. Sampling 1/${every} = ${Math.ceil(all.length / every)} rows.`)
  const sample = all.filter((_, i) => i % every === 0)
  let clean = 0
  const flagged = []
  for (const row of sample) {
    const { w, issues } = checkBody(row.body_md || '')
    if (issues.length) { flagged.push({ slug: row.slug, w, issues }) }
    else { clean++; if (showOk) console.log(`  OK   ${row.slug} (${w}w)`) }
  }
  console.log(`\nSample result: ${clean}/${sample.length} clean, ${flagged.length} flagged.`)
  if (flagged.length) {
    console.log('\nFLAGGED (review these):')
    for (const f of flagged) console.log(`  ${f.slug} — ${f.issues.join(', ')}`)
    const pct = ((flagged.length / sample.length) * 100).toFixed(0)
    console.log(`\nFlag rate: ${pct}%. ${pct >= 15 ? 'HIGH — inspect prompt/model.' : 'within tolerance.'}`)
  } else {
    console.log('All sampled drafts pass mechanical checks. ✅')
  }
}
main().catch((e) => { console.error('fatal:', e); process.exit(1) })
