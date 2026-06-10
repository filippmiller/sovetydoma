// promote-drafts.mjs — QA gate between drafting and publishing.
// Promotes content_matrix rows text_status 'draft' -> 'approved' ONLY when the
// body passes mechanical quality checks. Approved + image-ready rows are what
// auto-publish.mjs exports to MDX and ships (publish-without-rebuild pipeline).
//
// Usage:
//   node scripts/matrix/promote-drafts.mjs --limit 50 --dry-run
//   node scripts/matrix/promote-drafts.mjs --limit 500
//   node scripts/matrix/promote-drafts.mjs --min-words 300 --slug some-slug
import helpers from './lib.mjs'
import { CATEGORIES } from '../../src/lib/categories.mjs'

const DOMAIN = '1001sovet.ru'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const has = (k) => process.argv.includes(k)
const limit = parseInt(arg('--limit', '100'), 10)
const minWords = parseInt(arg('--min-words', '300'), 10)
const maxWords = parseInt(arg('--max-words', '2500'), 10)
const dryRun = has('--dry-run')
const onlySlug = arg('--slug', '')

const sb = helpers.getServiceClient()

// Mechanical quality gate — mirrors scripts/matrix/sample-quality.mjs.
function qaIssues(row) {
  const body = String(row.body_md || '')
  const issues = []
  const w = helpers.wordCount(body)
  if (w < minWords) issues.push(`short(${w}w)`)
  if (w > maxWords) issues.push(`long(${w}w)`)
  if (!/##/.test(body)) issues.push('no-headings')
  if (helpers.hasMojibake(body) || /�/.test(body)) issues.push('mojibake')
  if (/[一-鿿]|[぀-ヿ]|[가-힯]/.test(body)) issues.push('foreign-script')
  if (/нейросет|как ии\b|искусственн(ый|ого) интеллект|language model/i.test(body)) issues.push('ai-mention')
  if (/^\s*(я не могу|извините,? но|как (ассистент|ии|языковая))/i.test(body)) issues.push('refusal')
  if (/```/.test(body)) issues.push('code-fence')
  if (/^#\s/.test(body.split('\n')[0] || '')) issues.push('has-h1')
  if (!row.title || helpers.hasMojibake(row.title)) issues.push('bad-title')
  if (!CATEGORIES[row.category]) issues.push(`bad-category(${row.category})`)
  return { w, issues }
}

async function pick() {
  let q = sb.from('content_matrix')
    .select('id,slug,title,category,body_md,image_status')
    .eq('domain', DOMAIN).eq('disposition', 'active')
    .eq('text_status', 'draft').in('image_status', ['generated', 'approved'])
    .not('body_md', 'is', null)
    .order('updated_at', { ascending: true })
  if (onlySlug) q = q.eq('slug', onlySlug)
  const { data, error } = await q.limit(limit)
  if (error) throw new Error(error.message)
  return data || []
}

async function main() {
  const rows = await pick()
  console.log(`Picked ${rows.length} draft row(s)${dryRun ? ' [DRY RUN]' : ''}. Gate: ${minWords}-${maxWords} words, structure + cleanliness.`)
  let approved = 0, held = 0
  const heldList = []
  for (const row of rows) {
    const { w, issues } = qaIssues(row)
    if (issues.length) {
      held++; heldList.push(`${row.slug} — ${issues.join(', ')}`)
      continue
    }
    if (!dryRun) {
      await sb.from('content_matrix').update({
        text_status: 'approved', last_filled_stage: 'approved',
      }).eq('id', row.id)
      await sb.from('content_matrix_events').insert({
        matrix_id: row.id, axis: 'text', from_value: 'draft', to_value: 'approved',
        agent: 'promote-drafts-qa', notes: `${w} words, passed QA`,
      })
    }
    approved++
  }
  console.log(`\n${dryRun ? 'WOULD APPROVE' : 'APPROVED'}: ${approved} | HELD (need review): ${held}`)
  if (heldList.length) {
    console.log('\nHELD drafts (stay in draft for manual review):')
    for (const h of heldList.slice(0, 40)) console.log(`  ${h}`)
    if (heldList.length > 40) console.log(`  ... and ${heldList.length - 40} more`)
  }
  if (!dryRun) {
    const { count } = await sb.from('content_matrix')
      .select('*', { count: 'exact', head: true })
      .eq('domain', DOMAIN).eq('text_status', 'approved')
    console.log(`\nTotal approved (ready to publish): ${count}`)
  }
}
main().catch((e) => { console.error('fatal:', e); process.exit(1) })
