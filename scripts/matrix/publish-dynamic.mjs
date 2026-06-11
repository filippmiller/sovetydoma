// publish-dynamic.mjs — NO-REDEPLOY publish path: writes DB+R2 only.
// Never commits, never pushes, never triggers a rebuild. See docs/NO-REDEPLOY-PUBLISHING.md
//
// Takes approved articles from the Supabase content_matrix table and publishes them
// WITHOUT touching git/MDX/builds. Instead: uploads article image to Cloudflare R2,
// then marks the row published in DB. The article instantly becomes live via the
// renderer worker.
//
// Usage: node scripts/matrix/publish-dynamic.mjs [--limit N] [--category cat] [--slugs a,b,c] [--dry-run]
// Default limit 10.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import helpers from './lib.mjs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const has = (k) => process.argv.includes(k)

const limit = parseInt(arg('--limit', '10'), 10)
const category = arg('--category', '')
const slugsArg = arg('--slugs', '')
const dryRun = has('--dry-run')
const agent = 'publish-dynamic'

const DOMAIN = '1001sovet.ru'
const IMAGE_URL_PREFIX = `https://${DOMAIN}/images`
const R2_BUCKET = 'sovetydoma-article-images'

const ROOT = process.cwd()
const IMAGES_DIR = path.join(ROOT, 'public', 'images')
const PREVIEWS_DIR = path.join(IMAGES_DIR, 'previews')
const TODAY = new Date().toISOString().slice(0, 10)

const sb = helpers.getServiceClient()

// Parse slugs filter if provided
const slugFilter = slugsArg ? slugsArg.split(',').map((s) => s.trim()).filter(Boolean) : []

// Build query: select candidates like auto-publish does
let query = sb.from('content_matrix')
  .select('*')
  .eq('domain', DOMAIN)
  .eq('disposition', 'active')
  .eq('text_status', 'approved')
  .in('image_status', ['generated', 'approved'])
  .not('body_md', 'is', null)
  .not('image_filename', 'is', null)
  .not('title', 'is', null)
  .not('description', 'is', null)

if (category) query = query.eq('category', category)
if (slugFilter.length > 0) query = query.in('slug', slugFilter)

const { data, error } = await query
  .order('updated_at', { ascending: true })
  .limit(limit * 2) // slight overfetch in case some are skipped

if (error) {
  console.error('matrix query error:', error.message)
  process.exit(1)
}

const picked = []
for (const r of data || []) {
  if (picked.length >= limit) break

  // Apply slug filter if provided
  if (slugFilter.length > 0 && !slugFilter.includes(r.slug)) continue

  // Skip if already published
  if (r.text_status === 'published' || r.published_at) {
    console.warn(`skip ${r.slug}: already published`)
    continue
  }

  // Validate image exists locally
  const imagePath = path.join(IMAGES_DIR, r.image_filename)
  if (!fs.existsSync(imagePath)) {
    console.warn(`skip ${r.slug}: image missing at public/images/${r.image_filename}`)
    continue
  }

  // Check preview exists; we'll generate if missing during publish
  const previewPath = path.join(PREVIEWS_DIR, `${r.slug}.jpg`)
  if (!fs.existsSync(previewPath)) {
    console.warn(`skip ${r.slug}: preview missing at public/images/previews/${r.slug}.jpg (will be generated during publish)`)
  }

  // Detect mojibake
  if (helpers.hasMojibake(r.title) || helpers.hasMojibake(r.body_md)) {
    console.warn(`skip ${r.slug}: mojibake detected`)
    continue
  }

  picked.push(r)
}

if (picked.length === 0) {
  console.log('Nothing ready to publish.')
  process.exit(0)
}

console.log(`Publishing ${picked.length} article(s): ${picked.map((r) => r.slug).join(', ')}${dryRun ? ' [dry-run]' : ''}`)

if (dryRun) {
  console.log('\n[DRY-RUN] Would perform:')
  for (const r of picked) {
    const imagePath = path.join(IMAGES_DIR, r.image_filename)
    const previewPath = path.join(PREVIEWS_DIR, `${r.slug}.jpg`)
    const previewExists = fs.existsSync(previewPath)
    console.log(`  - ${r.slug}:`)
    console.log(`      image: ${imagePath} → ${R2_BUCKET}/${r.image_filename}`)
    if (!previewExists) {
      console.log(`      preview: (generate then upload) → ${R2_BUCKET}/previews/${r.slug}.jpg`)
    } else {
      console.log(`      preview: ${previewPath} → ${R2_BUCKET}/previews/${r.slug}.jpg`)
    }
    console.log(`      db: mark text_status='published', published_at=now, image_url='${IMAGE_URL_PREFIX}/${r.image_filename}'`)
    console.log(`      event: axis='text', from='approved', to='published', agent='${agent}'`)
  }
  process.exit(0)
}

// Helper to run wrangler r2 upload
const uploadToR2 = (filePath, r2Key) => {
  try {
    const result = execFileSync('npx', [
      'wrangler', 'r2', 'object', 'put',
      `${R2_BUCKET}/${r2Key}`,
      '--file', filePath,
      '--content-type', 'image/jpeg',
      '--remote'
    ], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
      shell: process.platform === 'win32'
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// Helper to generate preview using Python script (same as auto-publish does)
const generatePreview = (imageFilename, slug) => {
  try {
    // Direct single-slug mode: dynamic articles have no MDX, so the default
    // (MDX-scanning) mode never sees them.
    execFileSync('python', [
      'scripts/generate-image-previews.py',
      '--slug', slug
    ], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

let published = 0
let skipped = 0
const skipReasons = []

for (const r of picked) {
  const imagePath = path.join(IMAGES_DIR, r.image_filename)
  const previewPath = path.join(PREVIEWS_DIR, `${r.slug}.jpg`)
  let previewExists = fs.existsSync(previewPath)

  console.log(`\nPublishing ${r.slug}...`)

  // Generate preview if missing
  if (!previewExists) {
    console.log(`  Generating preview...`)
    const genResult = generatePreview(r.image_filename, r.slug)
    if (!genResult.success) {
      console.error(`  Preview generation failed: ${genResult.error}`)
      skipReasons.push(`${r.slug}: preview generation failed`)
      skipped++
      continue
    }
    // Check if it now exists
    previewExists = fs.existsSync(previewPath)
    if (!previewExists) {
      console.error(`  Preview still missing after generation`)
      skipReasons.push(`${r.slug}: preview missing after generation`)
      skipped++
      continue
    }
  }

  // Upload main image to R2
  console.log(`  Uploading image to R2...`)
  const uploadResult = uploadToR2(imagePath, r.image_filename)
  if (!uploadResult.success) {
    console.error(`  Image upload failed: ${uploadResult.error}`)
    skipReasons.push(`${r.slug}: image upload failed`)
    skipped++
    continue
  }

  // Upload preview to R2
  console.log(`  Uploading preview to R2...`)
  const previewUploadResult = uploadToR2(previewPath, `previews/${r.slug}.jpg`)
  if (!previewUploadResult.success) {
    console.error(`  Preview upload failed: ${previewUploadResult.error}`)
    skipReasons.push(`${r.slug}: preview upload failed`)
    skipped++
    continue
  }

  // Build frontmatter update: preserve existing, add published_via and date
  const fm = r.frontmatter && typeof r.frontmatter === 'object' ? { ...r.frontmatter } : {}
  fm.published_via = 'dynamic'
  fm.date = TODAY

  // Update DB row
  console.log(`  Updating database...`)
  const imageUrl = `${IMAGE_URL_PREFIX}/${r.image_filename}`
  const { error: updErr } = await sb.from('content_matrix')
    .update({
      text_status: 'published',
      published_at: new Date().toISOString(),
      image_url: imageUrl,
      frontmatter: fm
    })
    .eq('id', r.id)

  if (updErr) {
    console.error(`  Database update failed: ${updErr.message}`)
    skipReasons.push(`${r.slug}: database update failed`)
    skipped++
    continue
  }

  // Insert event log
  const { error: evtErr } = await sb.from('content_matrix_events')
    .insert({
      matrix_id: r.id,
      axis: 'text',
      from_value: r.text_status,
      to_value: 'published',
      agent,
      notes: 'published-dynamic (DB+R2, no rebuild)',
      payload: {
        image_url: imageUrl,
        published_via: 'dynamic'
      }
    })

  if (evtErr) {
    console.error(`  Event log insert failed: ${evtErr.message}`)
    // Non-fatal: continue
  }

  console.log(`  ✓ Published ${r.slug}`)
  published++
}

console.log(`\n${'='.repeat(60)}`)
console.log(`Done. Published ${published}, skipped ${skipped}.`)
if (skipReasons.length > 0) {
  console.log(`\nSkip reasons:`)
  for (const reason of skipReasons) {
    console.log(`  - ${reason}`)
  }
}

process.exit(published > 0 && skipped === 0 ? 0 : skipped > 0 ? 1 : 0)
