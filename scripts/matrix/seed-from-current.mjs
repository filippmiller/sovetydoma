import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import helpers from './lib.mjs'
import { QUERY_MAP, CATEGORY_QUERY } from '../image-audit-utils.mjs'

const ARTICLES_DIR = path.join(process.cwd(), 'src/content/articles')

async function main() {
  const isDry = process.argv.includes('--dry')
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error(`Articles dir not found: ${ARTICLES_DIR}`)
    process.exit(1)
  }
  const files = fs.readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .sort()
  const totalMdx = files.length
  console.log(`Found ${totalMdx} .mdx files in ${ARTICLES_DIR}.`)
  const rows = []
  let skippedNoSlug = 0
  for (const file of files) {
    const fullPath = path.join(ARTICLES_DIR, file)
    let fileText
    try {
      fileText = fs.readFileSync(fullPath, 'utf8')
    } catch (e) {
      console.warn(`SKIP read fail ${file}: ${e.message}`)
      skippedNoSlug++
      continue
    }
    const { data: fm, content } = matter(fileText)
    const body_md = content.trim()
    const wc = helpers.wordCount(body_md)
    const slug = fm && fm.slug
    if (!slug) {
      console.warn(`SKIP: missing slug in ${file} (title=${(fm && fm.title) || 'n/a'})`)
      skippedNoSlug++
      continue
    }
    const image_filename = fm.image ? fm.image.split('/').pop() : (slug ? slug + '.jpg' : null)
    const image_prompt = QUERY_MAP[slug] || CATEGORY_QUERY[fm.category] || null
    const mojibake = helpers.hasMojibake(fm.title || '') || helpers.hasMojibake(fm.description || '') || helpers.hasMojibake(body_md)
    const isShort = wc < 300
    const row = {
      domain: '1001sovet.ru',
      kb_source: 'sovetydoma-home-core',
      vertical: helpers.verticalForCategory(fm.category),
      text_status: 'published',
      image_status: 'approved',          // legacy articles already have a committed image
      disposition: (isShort || mojibake) ? 'needs_rework' : 'active',
      needs_human_review: (isShort || mojibake),
      title: fm.title ?? null,
      slug,
      category: fm.category ?? null,
      description: fm.description ?? null,
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      body_md,
      word_count: wc,
      frontmatter: fm,                    // LOSSLESS: store the full parsed frontmatter as jsonb for perfect MDX reconstruction
      image_prompt,
      image_filename,
      image_source: 'legacy-seed',
      image_generated_at: null,
      published_at: fm.date ? new Date(fm.date + 'T00:00:00Z').toISOString() : null,
      generated_by_agent: 'legacy-mdx-seed-2026-06-04',
      last_filled_stage: 'seed',
      review_notes: isShort ? 'short body (<300 words) from legacy import — re-gen recommended'
                    : mojibake ? 'mojibake detected in legacy import — repair recommended' : null,
    }
    rows.push(row)
  }
  const processed = rows.length
  console.log(`Built ${processed} rows (skipped ${skippedNoSlug} without slug).`)
  if (isDry) {
    const pubCountLocal = rows.filter((r) => r.text_status === 'published').length
    const reworkCountLocal = rows.filter((r) => r.disposition === 'needs_rework').length
    console.log(`[DRY] Seeded/updated ${processed} rows | published=${pubCountLocal} | needs_rework=${reworkCountLocal} | mdx files read=${totalMdx}`)
    if (pubCountLocal + skippedNoSlug !== totalMdx) {
      console.warn(`Warning: local published ${pubCountLocal} + skipped ${skippedNoSlug} != mdx read ${totalMdx}`)
    }
    console.log('First 3 rows (title, slug, vertical, wc, needs_rework, image_prompt!=null):')
    rows.slice(0, 3).forEach((r) => {
      console.log({
        title: r.title,
        slug: r.slug,
        vertical: r.vertical,
        wc: r.word_count,
        needs_rework: r.needs_human_review,
        image_prompt: r.image_prompt != null,
      })
    })
    return
  }
  // non-dry
  let supabase
  try {
    supabase = helpers.getServiceClient()
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
  console.log('Supabase client ready. Upserting in batches of 100 with onConflict: domain,slug ...')
  const batchSize = 100
  const batchErrors = []
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    console.log(`  batch ${batchNum}/${Math.ceil(rows.length / batchSize)}: ${batch.length} rows`)
    const { error } = await supabase.from('content_matrix').upsert(batch, { onConflict: 'domain,slug' })
    if (error) {
      console.error(`  Batch ${batchNum} error:`, error)
      batchErrors.push(error)
    }
  }
  if (batchErrors.length > 0) {
    console.error(`Collected ${batchErrors.length} batch error(s).`)
  }
  // after upsert: query counts
  const domain = '1001sovet.ru'
  let publishedX = 0
  let needsY = 0
  try {
    const { count: p, error: pe } = await supabase
      .from('content_matrix')
      .select('id', { count: 'exact', head: true })
      .eq('domain', domain)
      .eq('text_status', 'published')
    if (pe) console.error('published count query error:', pe)
    else publishedX = p || 0
  } catch (e) {
    console.error('published count query failed:', e)
  }
  try {
    const { count: r, error: re } = await supabase
      .from('content_matrix')
      .select('id', { count: 'exact', head: true })
      .eq('domain', domain)
      .eq('disposition', 'needs_rework')
    if (re) console.error('needs_rework count query error:', re)
    else needsY = r || 0
  } catch (e) {
    console.error('needs_rework count query failed:', e)
  }
  console.log(`Seeded/updated ${processed} rows | published=${publishedX} | needs_rework=${needsY} | mdx files read=${totalMdx}`)
  if (publishedX + skippedNoSlug !== totalMdx) {
    console.warn(`Warning: published ${publishedX} + skipped ${skippedNoSlug} does not match mdx files read ${totalMdx} (pre-existing rows or partial run).`)
  }
  if (batchErrors.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Unhandled error in seeder:', err)
  process.exit(1)
})
