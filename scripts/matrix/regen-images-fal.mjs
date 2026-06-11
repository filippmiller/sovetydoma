// regen-images-fal.mjs — regenerate EXISTING article images with the cleaned,
// no-people/no-hands prompt (lib.buildImagePrompt) at >=1200px. Targets published
// rows whose on-disk image is < MIN_WIDTH OR whose prompt referenced people/hands
// (the "goblin" risk). Overwrites public/images/<slug>.jpg in place. Does NOT
// touch the matrix status. Run the preview generator + commit afterwards.
//
// Usage: node scripts/matrix/regen-images-fal.mjs [--limit N] [--concurrency 4]
//        [--slugs a,b,c] [--min-width 1200] [--people-only] [--dry-run]
import fs from 'node:fs'
import path from 'node:path'
import helpers from './lib.mjs'

const DOMAIN = '1001sovet.ru'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const has = (k) => process.argv.includes(k)
const limit = parseInt(arg('--limit', '500'), 10)
const concurrency = Math.max(1, parseInt(arg('--concurrency', '4'), 10))
const minWidth = parseInt(arg('--min-width', '1200'), 10)
const model = arg('--model', 'fal-ai/flux/schnell')
const steps = parseInt(arg('--steps', '4'), 10)
const size = arg('--size', '1280x960')
const imageSize = { width: Number(size.split('x')[0]), height: Number(size.split('x')[1]) }
const onlySlugs = (arg('--slugs', '') || '').split(',').map((s) => s.trim()).filter(Boolean)
const peopleOnly = has('--people-only')
const skipPeople = has('--skip-people')
const dryRun = has('--dry-run')

const REPO = process.cwd()
const IMG_DIR = path.join(REPO, 'public', 'images')
const env = helpers.loadEnv()
const FAL_KEY = env.FAL_KEY || env.FAL_API_KEY || process.env.FAL_KEY
if (!FAL_KEY) { console.error('Missing FAL_KEY in .env.local'); process.exit(1) }
const sb = helpers.getServiceClient()

const PEOPLE_RE = /челов|люд|жен|мужч|девуш|ребен|\bдет|лицо|\bрук|woman|\bman\b|men\b|person|people|child|\bkid|\bhand|finger|face|girl|boy|angler|fisherman|gardener|cook|chef|housewife|worker|homeowner/i

// Minimal JPEG dimension reader (SOF marker).
function jpegWidth(buf) {
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xFF) { i++; continue }
    const m = buf[i + 1]
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return buf.readUInt16BE(i + 7)
    i += 2 + buf.readUInt16BE(i + 2)
  }
  return 0
}

async function pickTargets() {
  let q = sb.from('content_matrix')
    .select('id,slug,title,image_prompt,image_filename,category')
    .eq('domain', DOMAIN)
    .not('image_filename', 'is', null)
  // Default to published; with an explicit --slugs/--status, target those instead
  // (so we can also pre-fix queued/approved articles before they auto-publish).
  if (onlySlugs.length) q = q.in('slug', onlySlugs)
  else q = q.eq('text_status', arg('--status', 'published'))
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const targets = []
  for (const r of data || []) {
    const file = path.join(IMG_DIR, r.image_filename)
    // With explicit --slugs we also generate images that never existed on disk
    // (pre-publish fill for the dynamic publish path); default mode only fixes existing.
    if (!fs.existsSync(file) && !onlySlugs.length) continue
    const hasPeople = PEOPLE_RE.test(r.image_prompt || '')
    let small = false
    try { small = jpegWidth(fs.readFileSync(file)) < minWidth } catch { small = true }
    const include = onlySlugs.length ? true
      : peopleOnly ? hasPeople
      : skipPeople ? (small && !hasPeople)
      : (hasPeople || small)
    if (include) targets.push({ ...r, file, reason: [hasPeople && 'people', small && 'small'].filter(Boolean).join('+') || 'forced' })
  }
  return targets.slice(0, limit)
}

async function regenOne(row, attempt = 1) {
  const prompt = helpers.buildImagePrompt(row.image_prompt, row.title, row.category)
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: imageSize, num_images: 1, num_inference_steps: steps, enable_safety_checker: true }),
  })
  if (!res.ok) {
    const body = await res.text()
    if ((res.status === 429 || res.status >= 500) && attempt <= 4) {
      await new Promise((r) => setTimeout(r, 2000 * attempt))
      return regenOne(row, attempt + 1)
    }
    throw new Error(`fal ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json()
  const url = json?.images?.[0]?.url
  if (!url) throw new Error('no image url in response')
  let buf
  if (url.startsWith('data:')) {
    buf = Buffer.from(url.split(',')[1], 'base64')
  } else {
    const img = await fetch(url)
    buf = Buffer.from(await img.arrayBuffer())
  }
  fs.writeFileSync(row.file, buf)
  return buf.length
}

const targets = await pickTargets()
console.log(`Regen targets: ${targets.length}${dryRun ? ' [dry-run]' : ''} (min-width ${minWidth}, ${peopleOnly ? 'people-only' : 'people+small'})`)
for (const t of targets.slice(0, 12)) console.log(`  - ${t.slug} (${t.reason})`)
if (dryRun || targets.length === 0) process.exit(0)

let ok = 0, fail = 0, idx = 0
async function worker() {
  while (idx < targets.length) {
    const t = targets[idx++]
    try { const n = await regenOne(t); ok++; console.log(`[${ok + fail}/${targets.length}] ${t.slug} OK (${(n / 1024).toFixed(0)} KB)`) }
    catch (e) { fail++; console.error(`[${ok + fail}/${targets.length}] ${t.slug} FAIL: ${e.message}`) }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker))
console.log(`Done. ${ok} regenerated, ${fail} failed.`)
